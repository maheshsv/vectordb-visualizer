import { useEffect, useState } from 'react';
import type { Metric, VectorDoc } from '../types';
import type { AnnGraph } from '../lib/annGraph';
import { formatScore, metricLabel } from '../lib/similarity';

interface PointCloudProps {
  docs: VectorDoc[];
  queryCoord: { x: number; y: number } | null;
  topIds: Set<string>;
  focusedId: string | null;
  graph: AnnGraph;
  showGraph: boolean;
  traversal: number[];
  scoresByIndex: number[];
  metric: Metric;
  onFocus: (id: string) => void;
}

const VIEW = 100;
const PAD = 10;
const SPAN = (VIEW - PAD * 2) / 2;
const STEP_MS = 450;

const toX = (x: number) => VIEW / 2 + x * SPAN;
const toY = (y: number) => VIEW / 2 - y * SPAN; // invert: +y is up

const prefersReducedMotion = () =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function PointCloud({
  docs,
  queryCoord,
  topIds,
  focusedId,
  graph,
  showGraph,
  traversal,
  scoresByIndex,
  metric,
  onFocus,
}: PointCloudProps) {
  const [revealed, setRevealed] = useState(0);
  const [hover, setHover] = useState<number | null>(null);

  // Animate the greedy traversal one hop at a time.
  useEffect(() => {
    if (!showGraph || traversal.length === 0) {
      setRevealed(0);
      return;
    }
    if (prefersReducedMotion()) {
      setRevealed(traversal.length);
      return;
    }
    setRevealed(1);
    const timer = setInterval(() => {
      setRevealed((r) => {
        if (r >= traversal.length) {
          clearInterval(timer);
          return r;
        }
        return r + 1;
      });
    }, STEP_MS);
    return () => clearInterval(timer);
  }, [showGraph, traversal]);

  const visited = new Set(traversal.slice(0, revealed));

  return (
    <div className="cloud">
      <div className="cloud__plot">
      <svg
        viewBox={`0 0 ${VIEW} ${VIEW}`}
        className="cloud__svg"
        role="img"
        aria-label="2D projection of document vectors"
      >
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id="queryGrad">
            <stop offset="0%" stopColor="var(--color-amber)" />
            <stop offset="100%" stopColor="var(--color-violet)" />
          </radialGradient>
        </defs>

        <g className="cloud__grid">
          {[25, 50, 75].map((p) => (
            <line key={`h${p}`} x1={PAD} y1={p} x2={VIEW - PAD} y2={p} />
          ))}
          {[25, 50, 75].map((p) => (
            <line key={`v${p}`} x1={p} y1={PAD} x2={p} y2={VIEW - PAD} />
          ))}
        </g>

        {/* ANN graph mode: navigable graph + animated greedy walk */}
        {showGraph && (
          <g>
            {graph.edges.map(([i, j], idx) => (
              <line
                key={`g-${idx}`}
                className="cloud__graphedge"
                x1={toX(docs[i].x)}
                y1={toY(docs[i].y)}
                x2={toX(docs[j].x)}
                y2={toY(docs[j].y)}
              />
            ))}
            {traversal.slice(0, Math.max(0, revealed - 1)).map((from, k) => {
              const to = traversal[k + 1];
              return (
                <line
                  key={`t-${k}`}
                  className="cloud__hop"
                  x1={toX(docs[from].x)}
                  y1={toY(docs[from].y)}
                  x2={toX(docs[to].x)}
                  y2={toY(docs[to].y)}
                />
              );
            })}
          </g>
        )}

        {/* Result mode: query → top matches */}
        {!showGraph &&
          queryCoord &&
          docs
            .filter((d) => topIds.has(d.id))
            .map((d) => (
              <line
                key={`edge-${d.id}`}
                className="cloud__edge"
                x1={toX(queryCoord.x)}
                y1={toY(queryCoord.y)}
                x2={toX(d.x)}
                y2={toY(d.y)}
              />
            ))}

        {/* document points */}
        {docs.map((d, i) => {
          const isMatch = topIds.has(d.id);
          const isFocused = focusedId === d.id;
          const isVisited = showGraph && visited.has(i);
          const r = isFocused ? 2.6 : isMatch || isVisited ? 2.2 : 1.7;
          const cls = [
            'cloud__pt',
            isMatch ? 'is-match' : '',
            isFocused ? 'is-focused' : '',
            isVisited ? 'is-visited' : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <circle
              key={d.id}
              className={cls}
              cx={toX(d.x)}
              cy={toY(d.y)}
              r={r}
              filter={isMatch || isFocused || isVisited ? 'url(#glow)' : undefined}
              onClick={() => onFocus(d.id)}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover((h) => (h === i ? null : h))}
            >
              <title>{d.text}</title>
            </circle>
          );
        })}

        {queryCoord && (
          <circle
            className="cloud__query"
            cx={toX(queryCoord.x)}
            cy={toY(queryCoord.y)}
            r={3}
            fill="url(#queryGrad)"
            filter="url(#glow)"
          >
            <title>Query vector</title>
          </circle>
        )}
      </svg>

      {hover !== null && docs[hover] && (
        <div
          className="cloud__tip"
          style={{ left: `${toX(docs[hover].x)}%`, top: `${toY(docs[hover].y)}%` }}
        >
          <span className="cloud__tiptext">{docs[hover].text}</span>
          {scoresByIndex[hover] !== undefined && (
            <span className="cloud__tipscore mono">
              {metricLabel(metric)}: {formatScore(metric, scoresByIndex[hover])}
            </span>
          )}
        </div>
      )}
      </div>

      <div className="cloud__legend">
        <span className="legend__item"><span className="legend__dot legend__dot--doc" />document</span>
        {showGraph ? (
          <span className="legend__item"><span className="legend__dot legend__dot--visited" />search path</span>
        ) : (
          <span className="legend__item"><span className="legend__dot legend__dot--match" />top match</span>
        )}
        <span className="legend__item"><span className="legend__dot legend__dot--query" />query</span>
      </div>
    </div>
  );
}
