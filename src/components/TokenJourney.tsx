import { useEffect, useMemo, useState } from 'react';
import type { TokenEmbeddings } from '../types';
import { selfAttention } from '../lib/attention';
import { positionalEncoding, gelu } from '../lib/positional';

interface TokenJourneyProps {
  embeddings: TokenEmbeddings | null;
  loading: boolean;
}

const STRIP = 48; // dims shown in the vector strip
const STEP_MS = 2000;

const prefersReducedMotion = () =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

const short = (label: string) =>
  label.length > 10 ? label.replace(/^##/, '').slice(0, 9) + '…' : label.replace(/^##/, '');

/** Color a vector value: blue = positive, violet = negative, brightness = magnitude. */
function cellColor(value: number, scale: number): string {
  const mag = Math.min(1, Math.abs(value) / (scale || 1));
  const hue = value >= 0 ? 248 : 300;
  return `oklch(${(28 + mag * 50).toFixed(1)}% ${(0.03 + mag * 0.17).toFixed(3)} ${hue})`;
}

interface Stage {
  key: string;
  title: string;
  form: string;
  detail: string;
  vec: number[] | null;
}

export function TokenJourney({ embeddings, loading }: TokenJourneyProps) {
  const weights = useMemo(() => (embeddings ? selfAttention(embeddings.matrix) : []), [embeddings]);
  const n = weights.length;

  const [token, setToken] = useState(1); // default to first real token (after [CLS])
  const [stage, setStage] = useState(0);
  const [playing, setPlaying] = useState(!prefersReducedMotion());

  // Default to the first real token (after [CLS]) when a new sentence loads.
  useEffect(() => {
    setToken(n > 1 ? 1 : 0);
    setStage(0);
  }, [embeddings, n]);

  const { stages, contributors } = useMemo(() => {
    if (!embeddings || n === 0) return { stages: [] as Stage[], contributors: [] as Array<{ label: string; w: number }> };
    const matrix = embeddings.matrix;
    const dim = matrix[0].length;
    const i = Math.min(token, n - 1);
    const txt = embeddings.labels[i].replace(/^##/, '');
    const tid = embeddings.ids[i];

    const v0 = matrix[i];
    const pe = positionalEncoding(i, dim);
    const v1 = v0.map((x, k) => x + pe[k]);
    const w = weights[i];
    const v2 = new Array<number>(dim).fill(0);
    for (let j = 0; j < n; j++) for (let k = 0; k < dim; k++) v2[k] += w[j] * matrix[j][k];
    const v3 = v2.map(gelu);

    const contribs = w
      .map((weight, j) => ({ label: embeddings.labels[j], w: weight }))
      .sort((a, b) => b.w - a.w)
      .slice(0, 3);

    const built: Stage[] = [
      { key: 'input', title: '1 · Input token', form: `text “${txt}”  →  id ${tid}`, detail: `The text “${txt}” is matched in the ~30K-word vocabulary and replaced by its integer id ${tid}. That id is the model’s only handle on the word — everything after this is numbers.`, vec: null },
      { key: 'embed', title: '2 · Token embedding', form: `id ${tid}  →  384-dim vector`, detail: `Id ${tid} indexes a lookup table and becomes a learned 384-dim vector. The text “${txt}” is gone now — from here the model works purely with these numbers.`, vec: v0 },
      { key: 'pos', title: '3 · + Positional encoding', form: `vector + position ${i}`, detail: `A sinusoidal pattern for position ${i} is added, so the model knows “${txt}” is the token at slot ${i} — not just which word it is.`, vec: v1 },
      { key: 'attn', title: '4 · Self-attention', form: 'vector ⊕ context', detail: `“${txt}” becomes a weighted blend of every token’s vector — it “reads” the sentence. Its biggest sources are shown below.`, vec: v2 },
      { key: 'ffn', title: '5 · Feed-forward (MLP)', form: 'vector → vector', detail: 'A small per-token network with a nonlinearity (GELU) reshapes the vector independently of the others.', vec: v3 },
      { key: 'out', title: '6 · Add & Norm → ×N layers', form: 'contextual vector', detail: `A residual + layer-norm wraps each step, and the block repeats N times. The result is the contextual meaning of “${txt}” — no longer a word, a point in 384-D space.`, vec: v3 },
    ];
    return { stages: built, contributors: contribs };
  }, [embeddings, weights, n, token]);

  useEffect(() => {
    if (!playing || stages.length === 0) return;
    const timer = setInterval(() => setStage((s) => (s + 1) % stages.length), STEP_MS);
    return () => clearInterval(timer);
  }, [playing, stages.length]);

  if (loading) return <p className="tok__hint">Computing token embeddings…</p>;
  if (n === 0) return <p className="tok__hint">Enter a sentence above to trace a token through the stack.</p>;

  const current = stages[stage];
  const vec = current.vec;
  const scale = vec ? Math.max(...vec.map((x) => Math.abs(x)), 1e-6) : 1;

  return (
    <div className="journey">
      <div className="journey__pick">
        <span className="journey__picklabel">Trace this token:</span>
        <div className="journey__tokens">
          {embeddings!.labels.map((label, i) => (
            <button
              key={i}
              className={`chip ${i === token ? 'is-active' : ''}`}
              onClick={() => { setToken(i); setStage(0); }}
            >
              {short(label)}
            </button>
          ))}
        </div>
      </div>

      <div className="journey__head">
        <ol className="journey__steps">
          {stages.map((s, i) => (
            <li key={s.key}>
              <button
                className={`journey__step ${i === stage ? 'is-active' : ''} ${i < stage ? 'is-done' : ''}`}
                onClick={() => { setStage(i); setPlaying(false); }}
              >
                {i + 1}
              </button>
            </li>
          ))}
        </ol>
        <button className="chip" onClick={() => setPlaying((p) => !p)}>
          {playing ? '❚❚ Pause' : '▶ Play'}
        </button>
      </div>

      <div className="journey__stage">
        <div className="journey__id">
          <span className="journey__idtoken mono">{short(embeddings!.labels[Math.min(token, n - 1)])}</span>
          <span className="journey__idnum mono">id {embeddings!.ids[Math.min(token, n - 1)]}</span>
        </div>

        <div className="journey__form">
          {vec ? (
            <div className="journey__strip" aria-label="Token vector (first 48 dimensions)">
              {vec.slice(0, STRIP).map((value, k) => (
                <span key={k} className="journey__cell" style={{ backgroundColor: cellColor(value, scale) }} />
              ))}
            </div>
          ) : (
            <div className="journey__discrete mono">{current.form}</div>
          )}
          <span className="journey__formcaption mono">{current.form}</span>
        </div>
      </div>

      <p className="journey__detail">
        <strong>{current.title}.</strong> {current.detail}
      </p>

      {current.key === 'attn' && (
        <div className="journey__contrib">
          <span className="journey__contriblabel">Reads most from:</span>
          {contributors.map((c, i) => (
            <span key={i} className="journey__chip mono">
              {short(c.label)} <b>{c.w.toFixed(2)}</b>
            </span>
          ))}
        </div>
      )}

      <p className="journey__note">
        Illustrative: real model internals between layers aren&rsquo;t exposed, so this traces the
        <em> mechanism</em> using the model&rsquo;s real token vectors and real attention weights.
      </p>
    </div>
  );
}
