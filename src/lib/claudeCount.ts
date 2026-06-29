import Anthropic from '@anthropic-ai/sdk';

/**
 * Accurate token count for *current* Claude models via the official Token
 * Counting API (POST /v1/messages/count_tokens). This is the only correct way
 * to count tokens for Claude 3/4/Fable — there is no public client-side
 * tokenizer. It returns a count only (no token boundaries / pieces).
 *
 * The key is used directly from the browser (dangerouslyAllowBrowser) and is
 * never stored or sent anywhere except Anthropic. Browser use exposes the key
 * to anything running on the page — only paste a key you're comfortable using
 * client-side, and prefer a scoped/temporary one.
 */

export const CLAUDE_MODELS = [
  { id: 'claude-opus-4-8', label: 'Claude Opus 4.8' },
  { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5' },
  { id: 'claude-fable-5', label: 'Claude Fable 5' },
] as const;

export type ClaudeModelId = (typeof CLAUDE_MODELS)[number]['id'];

export async function countClaudeTokens(
  text: string,
  model: ClaudeModelId,
  apiKey: string,
): Promise<number> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  const res = await client.messages.countTokens({
    model,
    messages: [{ role: 'user', content: text }],
  });
  return res.input_tokens;
}

/** Maps SDK errors to short, user-facing messages. */
export function describeCountError(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError) return 'Invalid API key.';
  if (error instanceof Anthropic.PermissionDeniedError) return 'Key lacks permission for this model.';
  if (error instanceof Anthropic.NotFoundError) return 'Model not found for this key.';
  if (error instanceof Anthropic.RateLimitError) return 'Rate limited — try again shortly.';
  if (error instanceof Anthropic.APIError) return error.message || 'API error.';
  // CORS / network failures surface here.
  return 'Request failed (network or CORS). Check the key and your connection.';
}
