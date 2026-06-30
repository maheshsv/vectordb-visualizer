import { useEffect, useMemo, useState } from 'react';
import type { TokenEmbeddings } from '../types';
import { selfAttention } from '../lib/attention';

interface AttentionViewProps {
  embeddings: TokenEmbeddings | null;
  loading: boolean;
}

const UNIT = 70; // horizontal spacing per token in the arc SVG
const TOP = 16;
const BASE = 104;
const STEP_MS = 1500;

const prefersReducedMotion = () =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

const short = (label: string) => (label.length > 9 ? label.replace(/^##/, '').slice(0, 8) + '…' : label.replace(/^##/, ''));

export function AttentionView({ embeddings, loading }: AttentionViewProps) {
  const weights = useMemo(() => (embeddings ? selfAttention(embeddings.matrix) : []), [embeddings]);
  const n = weights.length;
  const [query, setQuery] = useState(0);
  const [playing, setPlaying] = useState(!prefersReducedMotion());

  useEffect(() => setQuery(0), [embeddings]);

  useEffect(() => {
    if (!playing || n === 0) return;
    const timer = setInterval(() => setQuery((q) => (q + 1) % n), STEP_MS);
    return () => clearInterval(timer);
  }, [playing, n]);

  if (loading) return <p className="tok__hint">Computing token embeddings…</p>;
  if (n === 0) return <p className="tok__hint">Enter a sentence to visualize attention.</p>;

  const labels = embeddings!.labels;
  const x = (i: number) => (i + 0.5) * UNIT;
  const row = weights[query] ?? [];

  return (
    <div className="attn">
      <div className="attn__head">
        <p className="attn__caption">
          <span className="mono attn__q">{short(labels[query])}</span> attends to&hellip;
        </p>
        <button className="chip" onClick={() => setPlaying((p) => !p)}>
          {playing ? '❚❚ Pause' : '▶ Play'}
        </button>
      </div>

      {/* Arc diagram: query token → all key tokens, weighted */}
      <div className="attn__arcs">
        <svg viewBox={`0 0 ${n * UNIT} 120`} className="attn__svg" role="img" aria-label="Attention arcs">
          {row.map((w, j) => {
            if (j === query) return null;
            const x1 = x(query);
            const x2 = x(j);
            const cx = (x1 + x2) / 2;
            return (
              <path
                key={j}
                d={`M ${x1} ${BASE} Q ${cx} ${TOP} ${x2} ${BASE}`}
                fill="none"
                stroke="var(--color-accent)"
                strokeWidth={0.6 + w * 6}
                strokeOpacity={Math.max(0.05, w)}
              />
            );
          })}
          {labels.map((label, i) => (
            <g key={i} onClick={() => { setQuery(i); setPlaying(false); }} style={{ cursor: 'pointer' }}>
              <circle cx={x(i)} cy={BASE} r={i === query ? 5 : 3} className={`attn__node ${i === query ? 'is-q' : ''}`} />
              <text x={x(i)} y={BASE + 14} textAnchor="middle" className={`attn__label ${i === query ? 'is-q' : ''}`}>
                {short(label)}
              </text>
            </g>
          ))}
        </svg>
      </div>

      {/* Heatmap: rows = query token, cols = key token */}
      <div className="attn__grid" style={{ gridTemplateColumns: `auto repeat(${n}, 1fr)` }}>
        <span className="attn__corner" />
        {labels.map((label, j) => (
          <span key={`c${j}`} className="attn__collabel mono" title={label}>
            {short(label)}
          </span>
        ))}
        {weights.map((wrow, i) => (
          <Row
            key={i}
            label={labels[i]}
            wrow={wrow}
            labels={labels}
            active={i === query}
            onSelect={() => { setQuery(i); setPlaying(false); }}
          />
        ))}
      </div>

      <p className="attn__note">
        Real scaled-dot-product self-attention <span className="mono">softmax(QKᵀ/√d)</span> over the
        model&rsquo;s token embeddings (Q = K). It shows the mechanism — not MiniLM&rsquo;s exact learned
        multi-head weights. Brighter = stronger attention.
      </p>
    </div>
  );
}

function Row({
  label,
  wrow,
  labels,
  active,
  onSelect,
}: {
  label: string;
  wrow: number[];
  labels: string[];
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <>
      <button className={`attn__rowlabel mono ${active ? 'is-active' : ''}`} onClick={onSelect} title={label}>
        {short(label)}
      </button>
      {wrow.map((w, j) => (
        <span
          key={j}
          className={`attn__cell ${active ? 'is-active' : ''}`}
          style={{ backgroundColor: `oklch(72% 0.17 248 / ${Math.max(0.04, w).toFixed(3)})` }}
          title={`${short(label)} → ${short(labels[j])} : ${w.toFixed(3)}`}
        >
          <span className="sr-only">{w.toFixed(2)}</span>
        </span>
      ))}
    </>
  );
}
