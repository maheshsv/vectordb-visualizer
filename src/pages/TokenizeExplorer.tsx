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

type Algo = 'wordpiece' | 'bpe' | 'claude-legacy' | 'claude-latest';

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

const TABS: Array<{ key: Algo; label: string; sub: string }> = [
  { key: 'wordpiece', label: 'WordPiece', sub: 'BERT · MiniLM' },
  { key: 'bpe', label: 'BPE', sub: 'GPT · cl100k_base' },
  { key: 'claude-legacy', label: 'Claude · legacy', sub: 'client-side · free' },
  { key: 'claude-latest', label: 'Claude · latest', sub: 'count_tokens API' },
];

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

  const ready = progress.status === 'ready';

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

  // Legacy Claude tokenizer (WASM) loads lazily — only once its tab is opened.
  useEffect(() => {
    if (algo !== 'claude-legacy') return;
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

  const localTokens =
    algo === 'wordpiece' ? wpTokens : algo === 'bpe' ? bpeTokens : algo === 'claude-legacy' ? claudeTokens : null;
  const display = useMemo(() => {
    if (!localTokens) return [];
    return algo === 'wordpiece' ? wordPieceDisplay(localTokens) : byteLevelDisplay(localTokens);
  }, [localTokens, algo]);

  const stats = useMemo(() => {
    const chars = text.length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const tokenCount = algo === 'claude-latest' ? (accurate?.tokens ?? null) : (localTokens?.ids.length ?? 0);
    const ratio = words && tokenCount != null ? (tokenCount / words).toFixed(2) : '—';
    return { chars, words, tokenCount, ratio };
  }, [text, algo, localTokens, accurate]);

  const counts: Array<{ key: Algo; label: string; value: number | null }> = [
    { key: 'wordpiece', label: 'WordPiece', value: wpTokens?.ids.length ?? null },
    { key: 'bpe', label: 'BPE', value: bpeTokens?.ids.length ?? null },
    { key: 'claude-legacy', label: 'Claude legacy', value: claudeTokens?.ids.length ?? null },
  ];
  if (accurate) counts.push({ key: 'claude-latest', label: accurate.model, value: accurate.tokens });

  const tokenLabel =
    algo === 'wordpiece'
      ? 'WordPiece tokens'
      : algo === 'bpe'
        ? 'BPE tokens'
        : algo === 'claude-legacy'
          ? 'Claude legacy tokens'
          : 'Claude tokens (API)';

  return (
    <main className="tok">
      <section className="tok__intro">
        <h2 className="tok__title">Tokenization</h2>
        <p className="tok__lede">
          Before text becomes a vector, it is split into <strong>tokens</strong>. Compare four real
          schemes on the same text — <strong>WordPiece</strong> (BERT / the <code>all-MiniLM</code>{' '}
          embedder), <strong>BPE</strong> (GPT), the open-sourced <strong>legacy Claude</strong>{' '}
          tokenizer, and an <strong>accurate count</strong> for the latest Claude via Anthropic&rsquo;s API.
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
          {TABS.map((t) => (
            <button
              key={t.key}
              role="radio"
              aria-checked={algo === t.key}
              className={`seg__btn ${algo === t.key ? 'is-active' : ''}`}
              onClick={() => setAlgo(t.key)}
            >
              {t.label} <span className="seg__sub">{t.sub}</span>
            </button>
          ))}
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

      {algo === 'claude-legacy' && (
        <p className="tok__warn" role="note">
          ⚠️ This is Anthropic&rsquo;s <strong>legacy</strong> tokenizer (Claude 1 / 2), open-sourced as{' '}
          <code>@anthropic-ai/tokenizer</code> — it runs locally, free, no key. Modern Claude
          (3 / 4 / Fable) uses a different, <strong>unpublished</strong> tokenizer, so these splits
          only <strong>approximate</strong> current models. For an accurate count, use the{' '}
          <strong>Claude · latest</strong> tab.
        </p>
      )}

      {algo === 'claude-latest' && (
        <section className="apicount" aria-label="Accurate count via Token Counting API">
          <h3 className="apicount__title">
            Accurate count · latest Claude <span className="apicount__tag">count_tokens API</span>
          </h3>
          <p className="apicount__lead">
            Modern Claude has no public tokenizer, so there are no chips to show — but the official
            Token Counting API returns the exact count (counting is <strong>free</strong>, just needs
            a key).
          </p>
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
            🔒 Your key is sent <strong>directly to Anthropic from your browser</strong> and is never
            stored or transmitted anywhere else. Browser use exposes the key to the page — prefer a
            scoped or temporary key. The API returns a count only, not token pieces.
          </p>
        </section>
      )}

      {algo !== 'claude-latest' && (
        <>
          <section className="tok__stats" aria-label="Token statistics">
            <Stat label="Characters" value={stats.chars} />
            <Stat label="Words" value={stats.words} />
            <Stat label={tokenLabel} value={stats.tokenCount ?? '—'} accent />
            <Stat label="Tokens / word" value={stats.ratio} />
          </section>

          <section className="tok__stream" aria-label="Tokens">
            {algo === 'claude-legacy' && claudeLoading && display.length === 0 && (
              <p className="tok__hint">Loading the legacy Claude tokenizer…</p>
            )}
            {algo === 'wordpiece' && !ready && <p className="tok__hint">Waiting for the model to load…</p>}
            {display.length === 0 && !(algo === 'claude-legacy' && claudeLoading) && (
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
        </>
      )}

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
        ) : algo === 'claude-legacy' ? (
          <>
            <h3 className="tok__notestitle">About the legacy Claude tokenizer</h3>
            <ol className="tok__list">
              <li><strong>Open-sourced</strong>: the Claude 1 / 2 tokenizer (~64,700-entry byte-level BPE) shipped as <code>@anthropic-ai/tokenizer</code>, so it runs entirely in your browser.</li>
              <li><strong>Free &amp; keyless</strong>: because Anthropic published the vocabulary, no server or API key is needed — you get real chips + IDs.</li>
              <li><strong>Approximate for new models</strong>: Claude 3 / 4 use a newer, unpublished tokenizer; these counts are a rough guide, exact only for Claude 1 / 2.</li>
            </ol>
          </>
        ) : (
          <>
            <h3 className="tok__notestitle">About the latest Claude tokenizer</h3>
            <ol className="tok__list">
              <li><strong>Unpublished</strong>: Claude 3 / 4 / Fable use a tokenizer Anthropic has not released, so its token boundaries can&rsquo;t be reproduced client-side — no chips.</li>
              <li><strong>Server-side count</strong>: the only correct count comes from <code>POST /v1/messages/count_tokens</code>, computed on Anthropic&rsquo;s servers.</li>
              <li><strong>Free, but key-gated</strong>: counting isn&rsquo;t billed, but the endpoint needs an API key (free account) and is rate-limited. Running a model (<code>/v1/messages</code>) is what costs money — counting does not.</li>
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
