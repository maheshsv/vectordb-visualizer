import { useEffect, useMemo, useRef, useState } from 'react';
import type { ModelProgress, TokenInfo } from '../types';

interface TokenizeExplorerProps {
  progress: ModelProgress;
  tokenize: (text: string) => Promise<TokenInfo>;
}

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

interface DisplayToken {
  id: number;
  text: string;
  special: boolean;
  continuation: boolean;
}

/** Aligns the subword pieces to the full id sequence, labeling special tokens. */
function toDisplayTokens(tokens: TokenInfo): DisplayToken[] {
  let pieceIndex = 0;
  return tokens.ids.map((id) => {
    const special = SPECIAL_TOKENS[id];
    if (special) return { id, text: special, special: true, continuation: false };
    const piece = tokens.pieces[pieceIndex++] ?? '∅';
    return {
      id,
      text: piece.replace(/^##/, ''),
      special: false,
      continuation: piece.startsWith('##'),
    };
  });
}

export function TokenizeExplorer({ progress, tokenize }: TokenizeExplorerProps) {
  const [text, setText] = useState(PRESETS[0]);
  const [tokens, setTokens] = useState<TokenInfo | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ready = progress.status === 'ready';

  // Live, debounced tokenization.
  useEffect(() => {
    if (!ready) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!text.trim()) {
      setTokens(null);
      return;
    }
    timerRef.current = setTimeout(() => {
      void tokenize(text).then(setTokens);
    }, DEBOUNCE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [text, ready, tokenize]);

  const display = useMemo(() => (tokens ? toDisplayTokens(tokens) : []), [tokens]);

  const stats = useMemo(() => {
    const chars = text.length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const subwords = tokens?.pieces.length ?? 0;
    const total = tokens?.ids.length ?? 0;
    const ratio = words ? (subwords / words).toFixed(2) : '—';
    return { chars, words, subwords, total, ratio };
  }, [text, tokens]);

  return (
    <main className="tok">
      <section className="tok__intro">
        <h2 className="tok__title">Tokenization</h2>
        <p className="tok__lede">
          Before any text becomes a vector, the model breaks it into <strong>tokens</strong> — the
          units it actually reads. The <code>all-MiniLM-L6-v2</code> model uses{' '}
          <strong>WordPiece</strong>: common words stay whole, rare words split into subword pieces
          (marked <code>##</code>), and special tokens <code>[CLS]</code>/<code>[SEP]</code> wrap
          every input. Type below and watch it split live.
        </p>
      </section>

      <section className="tok__editor">
        <textarea
          className="tok__field"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder={ready ? 'Type any text…' : 'Loading model…'}
          disabled={!ready}
          aria-label="Text to tokenize"
        />
        <div className="tok__presets">
          {PRESETS.map((p) => (
            <button key={p} className="chip" onClick={() => setText(p)} disabled={!ready}>
              {p.length > 28 ? p.slice(0, 28) + '…' : p}
            </button>
          ))}
        </div>
      </section>

      <section className="tok__stats" aria-label="Token statistics">
        <Stat label="Characters" value={stats.chars} />
        <Stat label="Words" value={stats.words} />
        <Stat label="Subword tokens" value={stats.subwords} accent />
        <Stat label="Total (with specials)" value={stats.total} />
        <Stat label="Tokens / word" value={stats.ratio} />
      </section>

      <section className="tok__stream" aria-label="Tokens">
        {!ready && <p className="tok__hint">Waiting for the model to load…</p>}
        {ready && display.length === 0 && <p className="tok__hint">Type something to tokenize it.</p>}
        {display.map((t, i) => (
          <div
            key={i}
            className={`tokcard ${t.special ? 'is-special' : ''} ${t.continuation ? 'is-cont' : ''}`}
            title={t.special ? 'Special token added by the tokenizer' : `token #${i}`}
          >
            <span className="tokcard__text">
              {t.continuation && <span className="tokcard__hash">##</span>}
              {t.text}
            </span>
            <span className="tokcard__id mono">{t.id}</span>
          </div>
        ))}
      </section>

      <section className="tok__notes">
        <h3 className="tok__notestitle">How WordPiece works</h3>
        <ol className="tok__list">
          <li>
            <strong>Normalize & split</strong> the text on whitespace and punctuation into candidate
            words.
          </li>
          <li>
            <strong>Greedy subword match</strong>: each word is matched against the vocabulary from
            the longest prefix down. Leftover suffixes become <code>##</code> pieces.
          </li>
          <li>
            <strong>Map to IDs</strong>: every piece becomes an integer index into the model's
            vocabulary (~30,000 entries).
          </li>
          <li>
            <strong>Wrap with special tokens</strong>: <code>[CLS]</code> marks the start (its output
            vector becomes the sentence embedding) and <code>[SEP]</code> marks the end.
          </li>
        </ol>
        <p className="tok__hint">
          This is why token counts never equal word counts — and why API pricing is per <em>token</em>,
          not per word.
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
