/// <reference lib="webworker" />
import {
  pipeline,
  env,
  type FeatureExtractionPipeline,
} from '@huggingface/transformers';
import type { WorkerRequest, WorkerResponse, TokenInfo } from '../types';

// Pull models from the Hugging Face hub, not from local disk.
env.allowLocalModels = false;

const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';

interface ProgressInfo {
  status?: string;
  progress?: number;
  file?: string;
}

// Transformers.js's `pipeline` overloads form a union too large for TS to
// represent (TS2590). Narrow it to exactly the signature we use.
type FeatureExtractionFactory = (
  task: 'feature-extraction',
  model: string,
  options?: { progress_callback?: (info: ProgressInfo) => void },
) => Promise<FeatureExtractionPipeline>;

const createExtractor = pipeline as unknown as FeatureExtractionFactory;

let extractor: FeatureExtractionPipeline | null = null;

function post(message: WorkerResponse): void {
  self.postMessage(message);
}

async function init(): Promise<void> {
  try {
    extractor = await createExtractor('feature-extraction', MODEL_ID, {
      progress_callback: (info: ProgressInfo) => {
        if (info.status === 'progress' && typeof info.progress === 'number') {
          post({
            type: 'progress',
            percent: Math.round(info.progress),
            message: `Downloading ${info.file ?? 'model'}`,
          });
        }
      },
    });
    post({ type: 'ready' });
  } catch (error) {
    post({ type: 'error', message: error instanceof Error ? error.message : String(error) });
  }
}

function tokenize(text: string): TokenInfo {
  const tokenizer = extractor!.tokenizer;
  const pieces: string[] = tokenizer.tokenize(text);
  const encoded = tokenizer.encode(text) as number[];
  return { pieces, ids: encoded };
}

async function embed(id: string, text: string): Promise<void> {
  if (!extractor) {
    post({ type: 'error', message: 'Model not ready' });
    return;
  }
  try {
    const tokens = tokenize(text);
    // Store the raw mean-pooled vector (no normalization) so the UI can toggle
    // normalization on/off and reveal how cosine vs dot product diverge.
    const output = await extractor(text, { pooling: 'mean', normalize: false });
    const vector = Array.from(output.data as Float32Array);
    post({ type: 'embedded', id, text, vector, tokens });
  } catch (error) {
    post({ type: 'error', message: error instanceof Error ? error.message : String(error) });
  }
}

function tokenizeOnly(id: string, text: string): void {
  if (!extractor) {
    post({ type: 'error', message: 'Model not ready' });
    return;
  }
  try {
    post({ type: 'tokenized', id, text, tokens: tokenize(text) });
  } catch (error) {
    post({ type: 'error', message: error instanceof Error ? error.message : String(error) });
  }
}

// Returns the per-token last-hidden-state vectors (no pooling) for the
// self-attention visualization, with labels aligned to each row.
async function tokenEmbed(id: string, text: string): Promise<void> {
  if (!extractor) {
    post({ type: 'error', message: 'Model not ready' });
    return;
  }
  try {
    const output = await extractor(text, { pooling: 'none', normalize: false });
    const [, seq, dim] = output.dims as number[];
    const data = output.data as Float32Array;
    const matrix: number[][] = [];
    for (let i = 0; i < seq; i++) {
      const row = new Array<number>(dim);
      for (let k = 0; k < dim; k++) row[k] = data[i * dim + k];
      matrix.push(row);
    }
    const pieces = extractor.tokenizer.tokenize(text);
    const labels = ['[CLS]', ...pieces, '[SEP]'].slice(0, seq);
    while (labels.length < seq) labels.push('?');
    // Encode includes the [CLS]/[SEP] special-token ids, aligned to labels.
    const ids = (extractor.tokenizer.encode(text) as number[]).slice(0, seq);
    while (ids.length < seq) ids.push(-1);
    post({ type: 'token-embedded', id, text, embeddings: { labels, ids, matrix } });
  } catch (error) {
    post({ type: 'error', message: error instanceof Error ? error.message : String(error) });
  }
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  if (request.type === 'init') void init();
  else if (request.type === 'embed') void embed(request.id, request.text);
  else if (request.type === 'tokenize') tokenizeOnly(request.id, request.text);
  else if (request.type === 'token-embed') void tokenEmbed(request.id, request.text);
};
