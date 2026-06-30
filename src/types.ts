export type Metric = 'cosine' | 'euclidean' | 'dot';

export interface TokenInfo {
  /** Subword pieces as the tokenizer splits them, e.g. ["un", "##believ", "##able"]. */
  pieces: string[];
  /** Full token id sequence including special tokens like [CLS]/[SEP]. */
  ids: number[];
}

export interface VectorDoc {
  id: string;
  text: string;
  /** Normalized embedding (length 384 for all-MiniLM-L6-v2). */
  vector: number[];
  tokens: TokenInfo;
  /** 2D projection coordinates, filled in after PCA across the whole set. */
  x: number;
  y: number;
}

export interface SearchResult {
  doc: VectorDoc;
  score: number;
}

export type ModelStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface ModelProgress {
  status: ModelStatus;
  message: string;
  /** 0–100 while downloading model shards. */
  percent: number;
}

/** Per-token contextual embeddings (sequence of vectors), with aligned labels. */
export interface TokenEmbeddings {
  /** Token labels including [CLS]/[SEP], aligned to matrix rows. */
  labels: string[];
  /** Vocabulary integer ids, aligned to labels/matrix rows. */
  ids: number[];
  /** seq × dim matrix of last-hidden-state vectors. */
  matrix: number[][];
}

/** Messages sent from the main thread into the embedding worker. */
export type WorkerRequest =
  | { type: 'init' }
  | { type: 'embed'; id: string; text: string }
  | { type: 'tokenize'; id: string; text: string }
  | { type: 'token-embed'; id: string; text: string };

/** Messages posted back from the embedding worker. */
export type WorkerResponse =
  | { type: 'progress'; percent: number; message: string }
  | { type: 'ready' }
  | { type: 'error'; message: string }
  | { type: 'embedded'; id: string; text: string; vector: number[]; tokens: TokenInfo }
  | { type: 'tokenized'; id: string; text: string; tokens: TokenInfo }
  | { type: 'token-embedded'; id: string; text: string; embeddings: TokenEmbeddings };
