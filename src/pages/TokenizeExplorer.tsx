import { useEffect, useMemo, useRef, useState } from 'react';
import type { ModelProgress, TokenInfo } from '../types';
import { bpeTokenize } from '../lib/bpe';

interface TokenizeExplorerProps {
  progress: ModelProgress;
  tokenize: (text: string) => Promise<TokenInfo>;
}

type Algo = 'wordpiece' | 'bpe';

// Special tokens added by the WordPiece tokenizer for all-MiniLM-L6-v2 (BERT family).
const SPECIAL_TOKENS: Record<number, string> = {
  0: '[PAD]',
  100: '[UNK]',
  101: '[CLS]',
  102: '[SEP]',
  103: '[MASK]',
};

const PRESETS = [
  'Tokenization splits unbelievable words into smaller subword pieces.',
  'antidisestablishmentarianism',
  'GPT-4 costs $0.03 per 1K tokens 🚀',
  'The cat sat on the windowsill.',
];

const DEBOUNCE_MS = 180;

type TokenKind = 'special' | 'cont' | 'space' | 'normal';
interface DisplayToken {
  id: number;
  text: string;
  kind: TokenKind;
}

/** WordPiece: special wrapper tokens + ## subword continuations. */
function wordPieceDisplay(tokens: TokenInfo): DisplayToken[] {
  let pieceIndex = 0;
  return tokens.ids.map((id) => {
    const special = SPECIAL_TOKENS[id];
    if (special) return { id, text: special, kind: 'special' };
    const piece = tokens.pieces[pieceIndex++] ?? '∅';
    return piece.startsWith('##')
      ? { id, text: piece.slice(2), kind: 'cont' }
      : { id, text: piece, kind: 'normal' };
  });
}

/** BPE: no special tokens; leading spaces are part of the token. */
function bpeDisplay(tokens: TokenInfo): DisplayToken[] {
  return tokens.pieces.map((piece, i) => {
    const id = tokens.ids[i];
    if (piece.startsWith(' ')) return { id, text: piece.slice(1) || '␣', kind: 'space' };
    if (piece === '\n') return { id, text: '⏎', kind: 'space' };
    return { id, text: piece, kind: 'normal' };
  });
}

export function TokenizeExplorer({ progress, tokenize }: TokenizeExplorerProps) {
  const [text, setText] = useState(PRESETS[0]);
  const [algo, setAlgo] = useState<Algo>('wordpiece');
  const [wpTokens, setWpTokens] = useState<TokenInfo | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ready = progress.status === 'ready';

  // WordPiece runs in the model worker (debounced).
  useEffect(() => {
    if (!ready) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!text.trim()) {
      setWpTokens(null);
      return;
    }
    timerRef.current = setTimeout(() => {
      void tokenize(text).then(setWpTokens);
    }, DEBOUNCE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [text, ready, tokenize]);

  // BPE runs synchronously in the main thread.
  const bpeTokens = useMemo(() => (text.trim() ? bpeTokenize(text) : null), [text]);

  const activeTokens = algo === 'wordpiece' ? wpTokens : bpeTokens;
  const display = useMemo(() => {
    if (!activeTokens) return [];
    return algo === 'wordpiece' ? wordPieceDisplay(activeTokens) : bpeDisplay(activeTokens);
  }, [activeTokens, algo]);

  const stats = useMemo(() => {
    const chars = text.length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const tokenCount = activeTokens?.ids.length ?? 0;
    const ratio = words ? (tokenCount / words).toFixed(2) : '—';
    return { chars, words, tokenCount, ratio };
  }, [text, activeTokens]);

  const wpCount = wpTokens?.ids.length ?? null;
  const bpeCount = bpeTokens?.ids.length ?? null;

  return (
    <main className="tok">
      <section className="tok__intro">
        <h2 className="tok__title">Tokenization</h2>
        <p className="tok__lede">
          Before text becomes a vector, it is split into <strong>tokens</strong>. Different models
          use different schemes — compare <strong>WordPiece</strong> (BERT / the{' '}
          <code>all-MiniLM</code> embedder) with <strong>BPE</strong> (the byte-pair encoding GPT
          models use). Same text, different splits and counts.
        </p>
      </section>

      <section className="tok__editor">
        <textarea
          className="tok__field"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder={ready ? 'Type any text…' : 'Loading model…'}
          aria-label="Text to tokenize"
        />
        <div className="tok__presets">
          {PRESETS.map((p) => (
            <button key={p} className="chip" onClick={() => setText(p)}>
              {p.length > 28 ? p.slice(0, 28) + '…' : p}
            </button>
          ))}
        </div>
      </section>

      <section className="tok__pick">
        <div className="seg" role="radiogroup" aria-label="Tokenizer">
          <button
            role="radio"
            aria-checked={algo === 'wordpiece'}
            className={`seg__btn ${algo === 'wordpiece' ? 'is-active' : ''}`}
            onClick={() => setAlgo('wordpiece')}
          >
            WordPiece <span className="seg__sub">BERT · MiniLM</span>
          </button>
          <button
            role="radio"
            aria-checked={algo === 'bpe'}
            className={`seg__btn ${algo === 'bpe' ? 'is-active' : ''}`}
            onClick={() => setAlgo('bpe')}
          >
            BPE <span className="seg__sub">GPT · cl100k_base</span>
          </button>
        </div>

        <div className="versus" aria-label="Token count comparison">
          <span className={`versus__side ${algo === 'wordpiece' ? 'is-active' : ''}`}>
            WordPiece <b className="mono">{wpCount ?? '—'}</b>
          </span>
          <span className="versus__vs">vs</span>
          <span className={`versus__side ${algo === 'bpe' ? 'is-active' : ''}`}>
            BPE <b className="mono">{bpeCount ?? '—'}</b>
          </span>
        </div>
      </section>

      <section className="tok__stats" aria-label="Token statistics">
        <Stat label="Characters" value={stats.chars} />
        <Stat label="Words" value={stats.words} />
        <Stat label={algo === 'wordpiece' ? 'WordPiece tokens' : 'BPE tokens'} value={stats.tokenCount} accent />
        <Stat label="Tokens / word" value={stats.ratio} />
      </section>

      <section className="tok__stream" aria-label="Tokens">
        {!ready && algo === 'wordpiece' && <p className="tok__hint">Waiting for the model to load…</p>}
        {ready && display.length === 0 && algo === 'wordpiece' && (
          <p className="tok__hint">Type something to tokenize it.</p>
        )}
        {algo === 'bpe' && display.length === 0 && <p className="tok__hint">Type something to tokenize it.</p>}
        {display.map((t, i) => (
          <div
            key={i}
            className={`tokcard is-${t.kind}`}
            title={
              t.kind === 'special'
                ? 'Special token added by the tokenizer'
                : t.kind === 'cont'
                  ? 'Subword continuation (## prefix)'
                  : t.kind === 'space'
                    ? 'Leading space is part of this token'
                    : `token #${i}`
            }
          >
            <span className="tokcard__text">
              {t.kind === 'cont' && <span className="tokcard__hash">##</span>}
              {t.kind === 'space' && <span className="tokcard__space">␣</span>}
              {t.text}
            </span>
            <span className="tokcard__id mono">{t.id}</span>
          </div>
        ))}
      </section>

      <section className="tok__notes">
        {algo === 'wordpiece' ? (
          <>
            <h3 className="tok__notestitle">How WordPiece works</h3>
            <ol className="tok__list">
              <li><strong>Split</strong> on whitespace and punctuation into candidate words.</li>
              <li><strong>Greedy subword match</strong>: longest known prefix wins; leftover suffixes become <code>##</code> pieces.</li>
              <li><strong>Map to IDs</strong> against a ~30,000-entry vocabulary.</li>
              <li><strong>Wrap</strong> with <code>[CLS]</code> (its output becomes the sentence embedding) and <code>[SEP]</code>.</li>
            </ol>
          </>
        ) : (
          <>
            <h3 className="tok__notestitle">How BPE works</h3>
            <ol className="tok__list">
              <li><strong>Start from bytes</strong>: BPE is byte-level, so any character (even emoji 🚀) can be encoded.</li>
              <li><strong>Merge frequent pairs</strong>: the most common adjacent pairs were merged during training into larger tokens.</li>
              <li><strong>Spaces are kept</strong>: a leading space is part of the token (<code>␣word</code>) — no <code>##</code> scheme.</li>
              <li><strong>No special wrappers</strong>: raw BPE adds no <code>[CLS]</code>/<code>[SEP]</code>; the ~100,000-entry vocab (cl100k_base) covers far more whole words.</li>
            </ol>
          </>
        )}
        <p className="tok__hint">
          That’s why the same sentence tokenizes to different counts — and why token-based pricing
          differs across models.
        </p>
      </section>
    </main>
  );
}

function Stat({ label, value, accent }: { label: string; value: number | string; accent?: boolean }) {
  return (
    <div className={`stat ${accent ? 'is-accent' : ''}`}>
      <span className="stat__value mono">{value}</span>
      <span className="stat__label">{label}</span>
    </div>
  );
}
