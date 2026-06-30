import { useEffect, useState } from 'react';

interface Stage {
  title: string;
  detail: string;
  block?: boolean; // part of the repeated Transformer block
}

const STAGES: Stage[] = [
  { title: 'Input tokens', detail: 'The sentence is split into tokens (subword pieces) and each is looked up as an integer id.' },
  { title: 'Token + positional embeddings', detail: 'Each id becomes a vector. A positional encoding is added so the model knows token order.' },
  { title: 'Self-attention (Q · K · V)', detail: 'Every token forms a query, key, and value. It attends to all tokens and mixes in the relevant ones.', block: true },
  { title: 'Multi-head attention', detail: 'Several attention heads run in parallel — each captures a different kind of relationship — then concatenate.', block: true },
  { title: 'Add & Norm', detail: 'A residual connection adds the input back, then layer-norm stabilizes the result.', block: true },
  { title: 'Feed-forward (MLP)', detail: 'A small per-token neural network transforms each vector independently.', block: true },
  { title: 'Add & Norm', detail: 'Another residual + layer-norm closes the block.', block: true },
  { title: '× N layers', detail: 'Stack many of these blocks. With each layer the token representations get richer and more contextual.' },
  { title: 'Output → softmax', detail: 'A final linear projection turns the last hidden state into a probability over the vocabulary — the next token.' },
];

const STEP_MS = 1700;

const prefersReducedMotion = () =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function ArchitectureFlow() {
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(!prefersReducedMotion());

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => setActive((a) => (a + 1) % STAGES.length), STEP_MS);
    return () => clearInterval(timer);
  }, [playing]);

  return (
    <div className="arch">
      <div className="arch__head">
        <h3 className="panel__title">Transformer forward pass</h3>
        <button className="chip" onClick={() => setPlaying((p) => !p)}>
          {playing ? '❚❚ Pause' : '▶ Play'}
        </button>
      </div>

      <ol className="arch__stack">
        {STAGES.map((s, i) => (
          <li key={i}>
            <button
              className={`archblock ${i === active ? 'is-active' : ''} ${s.block ? 'is-inblock' : ''}`}
              onClick={() => {
                setActive(i);
                setPlaying(false);
              }}
            >
              <span className="archblock__num mono">{i + 1}</span>
              <span className="archblock__title">{s.title}</span>
              {i < STAGES.length - 1 && <span className="archblock__arrow" aria-hidden="true">↓</span>}
            </button>
          </li>
        ))}
      </ol>

      <p className="arch__caption">
        <span className="arch__captionnum mono">{active + 1}</span>
        {STAGES[active].detail}
      </p>
    </div>
  );
}
