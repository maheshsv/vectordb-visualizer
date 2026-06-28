import type { Metric } from '../types';
import { cosineSimilarity, score } from './similarity';

/**
 * A simplified navigable graph — the idea behind HNSW, the index most real
 * vector databases (Qdrant, Weaviate, pgvector, Milvus) use. Each node links
 * to its M nearest neighbors; search walks the graph greedily toward the query
 * instead of scanning every vector.
 */
export interface AnnGraph {
  /** neighbors[i] = indices of node i's M closest nodes. */
  neighbors: number[][];
  /** Unique undirected edges, for rendering. */
  edges: Array<[number, number]>;
}

export function buildKnnGraph(vectors: number[][], m: number): AnnGraph {
  const n = vectors.length;
  const neighbors: number[][] = [];

  for (let i = 0; i < n; i++) {
    const sims: Array<{ j: number; s: number }> = [];
    for (let j = 0; j < n; j++) {
      if (i !== j) sims.push({ j, s: cosineSimilarity(vectors[i], vectors[j]) });
    }
    sims.sort((a, b) => b.s - a.s);
    neighbors.push(sims.slice(0, m).map((x) => x.j));
  }

  const seen = new Set<string>();
  const edges: Array<[number, number]> = [];
  neighbors.forEach((ns, i) => {
    ns.forEach((j) => {
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (!seen.has(key)) {
        seen.add(key);
        edges.push([i, j]);
      }
    });
  });

  return { neighbors, edges };
}

/**
 * Greedy best-first walk: start at an entry node, repeatedly hop to the
 * neighbor closest to the query, stop when no neighbor improves. Returns the
 * full visited path so the UI can animate the traversal.
 */
export function greedySearch(
  graph: AnnGraph,
  vectors: number[][],
  query: number[],
  metric: Metric,
  entry = 0,
): number[] {
  if (vectors.length === 0) return [];
  let current = entry;
  const path = [current];
  const visited = new Set([current]);

  for (let step = 0; step < vectors.length; step++) {
    let best = current;
    let bestScore = score(metric, query, vectors[current]);
    for (const nb of graph.neighbors[current] ?? []) {
      const s = score(metric, query, vectors[nb]);
      if (s > bestScore) {
        bestScore = s;
        best = nb;
      }
    }
    if (best === current || visited.has(best)) break;
    current = best;
    visited.add(current);
    path.push(current);
  }

  return path;
}
