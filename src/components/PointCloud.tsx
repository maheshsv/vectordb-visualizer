import type { VectorDoc } from '../types';

interface PointCloudProps {
  docs: VectorDoc[];
  queryCoord: { x: number; y: number } | null;
  topIds: Set<string>;
  focusedId: string | null;
  onFocus: (id: string) => void;
}

const VIEW = 100;
const PAD = 10;
const SPAN = (VIEW - PAD * 2) / 2;

const toX = (x: number) => VIEW / 2 + x * SPAN;
const toY = (y: number) => VIEW / 2 - y * SPAN; // invert: +y is up

export function PointCloud({ docs, queryCoord, topIds, focusedId, onFocus }: PointCloudProps) {
  return (
    <div className="cloud">
      <svg viewBox={`0 0 ${VIEW} ${VIEW}`} className="cloud__svg" role="img" aria-label="2D projection of document vectors">
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

        {/* grid */}
        <g className="cloud__grid">
          {[25, 50, 75].map((p) => (
            <line key={`h${p}`} x1={PAD} y1={p} x2={VIEW - PAD} y2={p} />
          ))}
          {[25, 50, 75].map((p) => (
            <line key={`v${p}`} x1={p} y1={PAD} x2={p} y2={VIEW - PAD} />
          ))}
        </g>

        {/* neighbor lines: query → top matches */}
        {queryCoord &&
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
        {docs.map((d) => {
          const isMatch = topIds.has(d.id);
          const isFocused = focusedId === d.id;
          const r = isFocused ? 2.6 : isMatch ? 2.2 : 1.7;
          return (
            <circle
              key={d.id}
              className={`cloud__pt ${isMatch ? 'is-match' : ''} ${isFocused ? 'is-focused' : ''}`}
              cx={toX(d.x)}
              cy={toY(d.y)}
              r={r}
              filter={isMatch || isFocused ? 'url(#glow)' : undefined}
              onClick={() => onFocus(d.id)}
            >
              <title>{d.text}</title>
            </circle>
          );
        })}

        {/* query point */}
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

      <div className="cloud__legend">
        <span className="legend__item"><span className="legend__dot legend__dot--doc" />document</span>
        <span className="legend__item"><span className="legend__dot legend__dot--match" />top match</span>
        <span className="legend__item"><span className="legend__dot legend__dot--query" />query</span>
      </div>
    </div>
  );
}
