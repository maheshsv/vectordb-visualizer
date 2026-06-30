import { useEffect, useRef, useState } from 'react';
import type { ModelProgress, TokenEmbeddings } from '../types';
import { ArchitectureFlow } from '../components/ArchitectureFlow';
import { AttentionView } from '../components/AttentionView';

interface TransformerProps {
  progress: ModelProgress;
  tokenEmbed: (text: string) => Promise<TokenEmbeddings>;
}

const DEFAULT = 'The cat sat on the soft mat.';
const PRESETS = [
  'The cat sat on the soft mat.',
  'The animal didn’t cross the street because it was tired.',
  'Paris is to France as Tokyo is to Japan.',
];
const DEBOUNCE_MS = 250;

export function Transformer({ progress, tokenEmbed }: TransformerProps) {
  const [text, setText] = useState(DEFAULT);
  const [embeddings, setEmbeddings] = useState<TokenEmbeddings | null>(null);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ready = progress.status === 'ready';

  useEffect(() => {
    if (!ready || !text.trim()) return;
    if (timer.current) clearTimeout(timer.current);
    setLoading(true);
    timer.current = setTimeout(() => {
      void tokenEmbed(text)
        .then(setEmbeddings)
        .finally(() => setLoading(false));
    }, DEBOUNCE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [text, ready, tokenEmbed]);

  return (
    <main className="xf">
      <section className="tok__intro">
        <h2 className="tok__title">How a Transformer works</h2>
        <p className="tok__lede">
          The architecture behind modern LLMs. Watch data flow through the forward pass on the left,
          then see the heart of it — <strong>self-attention</strong> — computed live on the right:
          every token decides how much to &ldquo;look at&rdquo; every other token.
        </p>
      </section>

      <div className="xf__grid">
        <section className="panel">
          <ArchitectureFlow />
        </section>

        <section className="panel xf__attn" aria-labelledby="attn-heading">
          <h3 id="attn-heading" className="panel__title">
            Self-attention <span className="panel__hint">live · scaled dot-product</span>
          </h3>

          <div className="xf__editor">
            <input
              className="search__input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={ready ? 'Type a sentence…' : 'Loading model…'}
              aria-label="Sentence to analyze"
              disabled={!ready}
            />
            <div className="tok__presets">
              {PRESETS.map((p) => (
                <button key={p} className="chip" onClick={() => setText(p)} disabled={!ready}>
                  {p.length > 26 ? p.slice(0, 26) + '…' : p}
                </button>
              ))}
            </div>
          </div>

          <AttentionView embeddings={embeddings} loading={loading && !embeddings} />
        </section>
      </div>
    </main>
  );
}
