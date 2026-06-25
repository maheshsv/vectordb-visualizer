import { useCallback, useEffect, useRef, useState } from 'react';
import type { ModelProgress, TokenInfo, WorkerResponse } from '../types';

export interface EmbedResult {
  vector: number[];
  tokens: TokenInfo;
}

type Pending = (result: EmbedResult) => void;

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `req-${idCounter}`;
}

/**
 * Owns the embedding worker, tracks model load progress, and turns the
 * worker's message protocol into a simple `embed(text) => Promise` API.
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
      }
    };

    worker.postMessage({ type: 'init' });
    return () => worker.terminate();
  }, []);

  const embed = useCallback((text: string): Promise<EmbedResult> => {
    const worker = workerRef.current;
    if (!worker) return Promise.reject(new Error('Worker not initialized'));
    const id = nextId();
    return new Promise<EmbedResult>((resolve) => {
      pendingRef.current.set(id, resolve);
      worker.postMessage({ type: 'embed', id, text });
    });
  }, []);

  return { progress, embed };
}
