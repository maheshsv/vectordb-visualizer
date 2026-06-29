/// <reference types="vite/client" />

declare module '*.wasm?url' {
  const src: string;
  export default src;
}

declare module '@anthropic-ai/tokenizer/claude.json' {
  const value: {
    explicit_n_vocab: number;
    pat_str: string;
    special_tokens: Record<string, number>;
    bpe_ranks: string;
  };
  export default value;
}
