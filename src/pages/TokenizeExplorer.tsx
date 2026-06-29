import { useEffect, useMemo, useRef, useState } from 'react';
import type { ModelProgress, TokenInfo } from '../types';
import { bpeTokenize } from '../lib/bpe';
import { claudeLegacyTokenize } from '../lib/claudeLegacy';
import {
  CLAUDE_MODELS,
  countClaudeTokens,
  describeCountError,
  type ClaudeModelId,
} from '../lib/claudeCount';

interface TokenizeExplorerProps {
  progress: ModelProgress;
  tokenize: (text: string) => Promise<TokenInfo>;
}

type Algo = 'wordpiece' | 'bpe' | 'claude';

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

/** Byte-level BPE (GPT cl100k / legacy Claude): leading spaces are part of the token. */
function byteLevelDisplay(tokens: TokenInfo): DisplayToken[] {
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
  const [claudeTokens, setClaudeTokens] = useState<TokenInfo | null>(null);
  const [claudeLoading, setClaudeLoading] = useState(false);
  const wpTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const claudeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Accurate count via the Token Counting API (latest Claude models).
  const [apiKey, setApiKey] = useState('');
  const [countModel, setCountModel] = useState<ClaudeModelId>('claude-opus-4-8');
  const [accurate, setAccurate] = useState<{ model: string; tokens: number } | null>(null);
  const [counting, setCounting] = useState(false);
  const [countErr, setCountErr] = useState<string | null>(null);

  const runCount = async () => {
    if (!apiKey.trim() || !text.trim()) return;
    setCounting(true);
    setCountErr(null);
    try {
      const tokens = await countClaudeTokens(text, countModel, apiKey.trim());
      const label = CLAUDE_MODELS.find((m) => m.id === countModel)?.label ?? countModel;
      setAccurate({ model: label, tokens });
    } catch (error) {
      setAccurate(null);
      setCountErr(describeCountError(error));
    } finally {
      setCounting(false);
    }
  };

  const ready = progress.status === 'ready';

  // WordPiece runs in the model worker (debounced).
  useEffect(() => {
    if (!ready) return;
    if (wpTimer.current) clearTimeout(wpTimer.current);
    if (!text.trim()) {
      setWpTokens(null);
      return;
    }
    wpTimer.current = setTimeout(() => void tokenize(text).then(setWpTokens), DEBOUNCE_MS);
    return () => {
      if (wpTimer.current) clearTimeout(wpTimer.current);
    };
  }, [text, ready, tokenize]);

  // The accurate count is for the current text — invalidate it when text changes.
  useEffect(() => {
    setAccurate(null);
    setCountErr(null);
  }, [text]);

  // BPE runs synchronously in the main thread.
  const bpeTokens = useMemo(() => (text.trim() ? bpeTokenize(text) : null), [text]);

  // Legacy Claude tokenizer (WASM) loads lazily — only once the Claude tab is opened.
  useEffect(() => {
    if (algo !== 'claude') return;
    if (claudeTimer.current) clearTimeout(claudeTimer.current);
    if (!text.trim()) {
      setClaudeTokens(null);
      return;
    }
    setClaudeLoading(true);
    claudeTimer.current = setTimeout(() => {
      void claudeLegacyTokenize(text)
        .then(setClaudeTokens)
        .finally(() => setClaudeLoading(false));
    }, DEBOUNCE_MS);
    return () => {
      if (claudeTimer.current) clearTimeout(claudeTimer.current);
    };
  }, [text, algo]);

  const activeTokens = algo === 'wordpiece' ? wpTokens : algo === 'bpe' ? bpeTokens : claudeTokens;
  const display = useMemo(() => {
    if (!activeTokens) return [];
    return algo === 'wordpiece' ? wordPieceDisplay(activeTokens) : byteLevelDisplay(activeTokens);
  }, [activeTokens, algo]);

  const stats = useMemo(() => {
    const chars = text.length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const tokenCount = activeTokens?.ids.length ?? 0;
    const ratio = words ? (tokenCount / words).toFixed(2) : '—';
    return { chars, words, tokenCount, ratio };
  }, [text, activeTokens]);

  const counts: Array<{ key: Algo; label: string; value: number | null }> = [
    { key: 'wordpiece', label: 'WordPiece', value: wpTokens?.ids.length ?? null },
    { key: 'bpe', label: 'BPE', value: bpeTokens?.ids.length ?? null },
    { key: 'claude', label: 'Claude (legacy)', value: claudeTokens?.ids.length ?? null },
  ];

  const tokenLabel =
    algo === 'wordpiece' ? 'WordPiece tokens' : algo === 'bpe' ? 'BPE tokens' : 'Claude tokens';

  return (
    <main className="tok">
      <section className="tok__intro">
        <h2 className="tok__title">Tokenization</h2>
        <p className="tok__lede">
          Before text becomes a vector, it is split into <strong>tokens</strong>. Different models
          use different schemes — compare <strong>WordPiece</strong> (BERT / the <code>all-MiniLM</code>{' '}
          embedder), <strong>BPE</strong> (GPT), and Anthropic&rsquo;s <strong>legacy Claude</strong>{' '}
          tokenizer. Same text, different splits and counts.
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
          <button
            role="radio"
            aria-checked={algo === 'claude'}
            className={`seg__btn ${algo === 'claude' ? 'is-active' : ''}`}
            onClick={() => setAlgo('claude')}
          >
            Claude <span className="seg__sub">legacy · approximate</span>
          </button>
        </div>

        <div className="versus" aria-label="Token count comparison">
          {counts.map((c, i) => (
            <span key={c.key} className="versus__group">
              {i > 0 && <span className="versus__vs">vs</span>}
              <span className={`versus__side ${algo === c.key ? 'is-active' : ''}`}>
                {c.label} <b className="mono">{c.value ?? '—'}</b>
              </span>
            </span>
          ))}
        </div>
      </section>

      {algo === 'claude' && (
        <>
          <p className="tok__warn" role="note">
            ⚠️ The chips below are Anthropic&rsquo;s <strong>legacy</strong> tokenizer (Claude 1 / 2).
            Modern Claude (3 / 4 / Fable) uses a different, <strong>unpublished</strong> tokenizer —
            there is no client-side tokenizer for current models. For an <strong>accurate</strong>{' '}
            count of the latest models, use the official API below.
          </p>

          <section className="apicount" aria-label="Accurate count via Token Counting API">
            <h3 className="apicount__title">
              Accurate count · latest Claude <span className="apicount__tag">count_tokens API</span>
            </h3>
            <div className="apicount__row">
              <select
                className="apicount__select"
                value={countModel}
                onChange={(e) => setCountModel(e.target.value as ClaudeModelId)}
                aria-label="Claude model"
              >
                {CLAUDE_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
              <input
                className="apicount__key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-ant-… (your Anthropic API key)"
                aria-label="Anthropic API key"
                autoComplete="off"
              />
              <button
                className="btn btn--accent"
                onClick={runCount}
                disabled={counting || !apiKey.trim() || !text.trim()}
              >
                {counting ? 'Counting…' : 'Count'}
              </button>
            </div>

            {accurate && (
              <p className="apicount__result">
                <b className="mono">{accurate.tokens}</b> tokens · {accurate.model}
                {claudeTokens && (
                  <span className="apicount__delta">
                    {' '}
                    (legacy approximation: <span className="mono">{claudeTokens.ids.length}</span>)
                  </span>
                )}
              </p>
            )}
            {countErr && <p className="apicount__err">{countErr}</p>}

            <p className="apicount__note">
              🔒 Your key is sent <strong>directly to Anthropic from your browser</strong> and is
              never stored or transmitted anywhere else. Browser use exposes the key to the page —
              prefer a scoped or temporary key. The API returns a count only, not token pieces.
            </p>
          </section>
        </>
      )}

      <section className="tok__stats" aria-label="Token statistics">
        <Stat label="Characters" value={stats.chars} />
        <Stat label="Words" value={stats.words} />
        <Stat label={tokenLabel} value={stats.tokenCount} accent />
        <Stat label="Tokens / word" value={stats.ratio} />
      </section>

      <section className="tok__stream" aria-label="Tokens">
        {algo === 'claude' && claudeLoading && display.length === 0 && (
          <p className="tok__hint">Loading the legacy Claude tokenizer…</p>
        )}
        {algo === 'wordpiece' && !ready && <p className="tok__hint">Waiting for the model to load…</p>}
        {display.length === 0 && !(algo === 'claude' && claudeLoading) && (
          <p className="tok__hint">Type something to tokenize it.</p>
        )}
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
        ) : algo === 'bpe' ? (
          <>
            <h3 className="tok__notestitle">How BPE works</h3>
            <ol className="tok__list">
              <li><strong>Start from bytes</strong>: BPE is byte-level, so any character (even emoji 🚀) can be encoded.</li>
              <li><strong>Merge frequent pairs</strong>: common adjacent pairs were merged during training into larger tokens.</li>
              <li><strong>Spaces are kept</strong>: a leading space is part of the token (<code>␣word</code>) — no <code>##</code> scheme.</li>
              <li><strong>No special wrappers</strong>: the ~100,000-entry vocab (cl100k_base) covers far more whole words.</li>
            </ol>
          </>
        ) : (
          <>
            <h3 className="tok__notestitle">About the Claude tokenizer</h3>
            <ol className="tok__list">
              <li><strong>Legacy only</strong>: this is the Claude 1 / 2 tokenizer (~64,700-entry byte-level BPE) that Anthropic open-sourced as <code>@anthropic-ai/tokenizer</code>.</li>
              <li><strong>Modern Claude is private</strong>: Claude 3 / 4 (and Fable) use a newer, unpublished tokenizer — its token boundaries can&rsquo;t be reproduced client-side.</li>
              <li><strong>Accurate counts</strong>: for current models, the only correct count comes from the <code>POST /v1/messages/count_tokens</code> endpoint (needs an API key; returns a number, not pieces).</li>
              <li><strong>Why show it</strong>: it still illustrates how a third real scheme splits the same text differently — useful for comparison, not for billing.</li>
            </ol>
          </>
        )}
        <p className="tok__hint">
          That&rsquo;s why the same sentence tokenizes to different counts — and why token-based
          pricing differs across models.
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
