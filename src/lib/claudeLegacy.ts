import { init, Tiktoken } from 'tiktoken/lite/init';
import wasmUrl from 'tiktoken/lite/tiktoken_bg.wasm?url';
import claudeRanks from '@anthropic-ai/tokenizer/claude.json';
import type { TokenInfo } from '../types';

/**
 * Anthropic's *legacy* public tokenizer (Claude 1 / Claude 2 era), a GPT-2-style
 * byte-level BPE. It is the only client-side Claude tokenizer Anthropic has ever
 * published — modern Claude (3/4) uses a different, unpublished tokenizer, and
 * the only accurate counts for current models come from the Token Counting API.
 * So this is an APPROXIMATION, surfaced purely to compare tokenization schemes.
 */

let encoderPromise: Promise<Tiktoken> | null = null;
const decoder = new TextDecoder();

async function getEncoder(): Promise<Tiktoken> {
  if (!encoderPromise) {
    encoderPromise = (async () => {
      await init((imports) => WebAssembly.instantiateStreaming(fetch(wasmUrl), imports));
      return new Tiktoken(claudeRanks.bpe_ranks, claudeRanks.special_tokens, claudeRanks.pat_str);
    })();
  }
  return encoderPromise;
}

export async function claudeLegacyTokenize(text: string): Promise<TokenInfo> {
  const encoder = await getEncoder();
  const ids = Array.from(encoder.encode(text));
  const pieces = ids.map((id) => decoder.decode(encoder.decode(new Uint32Array([id]))));
  return { pieces, ids };
}
