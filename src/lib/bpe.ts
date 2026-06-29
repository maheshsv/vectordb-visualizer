import { encode, decode } from 'gpt-tokenizer/encoding/cl100k_base';
import type { TokenInfo } from '../types';

/**
 * Byte-Pair Encoding using OpenAI's cl100k_base vocabulary (GPT-3.5 / GPT-4).
 * Pure JS, runs synchronously in the browser — no model download. Unlike
 * WordPiece there are no special wrapper tokens, and leading spaces are baked
 * into the tokens themselves (" word" is one token).
 */
export function bpeTokenize(text: string): TokenInfo {
  const ids = encode(text);
  const pieces = ids.map((id) => decode([id]));
  return { pieces, ids };
}
