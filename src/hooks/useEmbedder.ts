import { useCallback, useEffect, useRef, useState } from 'react';
import type { ModelProgress, TokenEmbeddings, TokenInfo, WorkerResponse } from '../types';

export interface EmbedResult {
  vector: number[];
  tokens: TokenInfo;
}

type Pending = (result: EmbedResult | TokenInfo | TokenEmbeddings) => void;

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `req-${idCounter}`;
}

/**
 * Owns the embedding worker, tracks model load progress, and exposes
 * `embed(text)` and `tokenize(text)` as promise-based calls. A single worker
 * (one model download) is shared across the whole app.
 */
export function useEmbedder() {
  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef<Map<string, Pending>>(new Map());
  const [progress, setProgress] = useState<ModelProgress>({
    status: 'loading',
    message: 'Starting embedding model…',
    percent: 0,
  });

  useEffect(() => {
    const worker = new Worker(new URL('../workers/embed.worker.ts', import.meta.url), {
      type: 'module',
    });
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const msg = event.data;
      switch (msg.type) {
        case 'progress':
          setProgress({ status: 'loading', message: msg.message, percent: msg.percent });
          break;
        case 'ready':
          setProgress({ status: 'ready', message: 'Model ready', percent: 100 });
          break;
        case 'error':
          setProgress({ status: 'error', message: msg.message, percent: 0 });
          break;
        case 'embedded': {
          const resolve = pendingRef.current.get(msg.id);
          if (resolve) {
            pendingRef.current.delete(msg.id);
            resolve({ vector: msg.vector, tokens: msg.tokens });
          }
          break;
        }
        case 'tokenized': {
          const resolve = pendingRef.current.get(msg.id);
          if (resolve) {
            pendingRef.current.delete(msg.id);
            resolve(msg.tokens);
          }
          break;
        }
        case 'token-embedded': {
          const resolve = pendingRef.current.get(msg.id);
          if (resolve) {
            pendingRef.current.delete(msg.id);
            resolve(msg.embeddings);
          }
          break;
        }
      }
    };

    worker.postMessage({ type: 'init' });
    return () => worker.terminate();
  }, []);

  const request = useCallback(
    <T>(type: 'embed' | 'tokenize' | 'token-embed', text: string): Promise<T> => {
      const worker = workerRef.current;
      if (!worker) return Promise.reject(new Error('Worker not initialized'));
      const id = nextId();
      return new Promise<T>((resolve) => {
        pendingRef.current.set(id, resolve as Pending);
        worker.postMessage({ type, id, text });
      });
    },
    [],
  );

  const embed = useCallback((text: string) => request<EmbedResult>('embed', text), [request]);
  const tokenize = useCallback((text: string) => request<TokenInfo>('tokenize', text), [request]);
  const tokenEmbed = useCallback(
    (text: string) => request<TokenEmbeddings>('token-embed', text),
    [request],
  );

  return { progress, embed, tokenize, tokenEmbed };
}
