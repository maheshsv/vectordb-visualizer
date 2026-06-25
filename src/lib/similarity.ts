import type { Metric } from '../types';

export function dot(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

function magnitude(a: number[]): number {
  return Math.sqrt(dot(a, a));
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const denom = magnitude(a) * magnitude(b);
  return denom === 0 ? 0 : dot(a, b) / denom;
}

export function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

/**
 * Returns a "higher is more similar" score for any metric, so ranking is uniform.
 * Euclidean is negated because smaller distance means closer.
 */
export function score(metric: Metric, query: number[], target: number[]): number {
  switch (metric) {
    case 'cosine':
      return cosineSimilarity(query, target);
    case 'dot':
      return dot(query, target);
    case 'euclidean':
      return -euclideanDistance(query, target);
  }
}

export function metricLabel(metric: Metric): string {
  switch (metric) {
    case 'cosine':
      return 'Cosine similarity';
    case 'dot':
      return 'Dot product';
    case 'euclidean':
      return 'Euclidean distance';
  }
}

/** Formats a raw score for display, restoring true distance for euclidean. */
export function formatScore(metric: Metric, rawScore: number): string {
  const value = metric === 'euclidean' ? -rawScore : rawScore;
  return value.toFixed(3);
}
