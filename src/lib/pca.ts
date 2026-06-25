/**
 * Minimal PCA: projects high-dimensional vectors down to 2D for plotting.
 * Uses power iteration on the covariance matrix to extract the top two
 * principal components — enough for a readable scatter, no heavy deps.
 */

const POWER_ITERATIONS = 100;

function mean(vectors: number[][]): number[] {
  const dim = vectors[0].length;
  const m = new Array<number>(dim).fill(0);
  for (const v of vectors) {
    for (let i = 0; i < dim; i++) m[i] += v[i];
  }
  for (let i = 0; i < dim; i++) m[i] /= vectors.length;
  return m;
}

function center(vectors: number[][], m: number[]): number[][] {
  return vectors.map((v) => v.map((value, i) => value - m[i]));
}

/** Covariance matrix (dim x dim) of already-centered rows. */
function covariance(centered: number[][]): number[][] {
  const n = centered.length;
  const dim = centered[0].length;
  const cov: number[][] = Array.from({ length: dim }, () => new Array<number>(dim).fill(0));
  for (const row of centered) {
    for (let i = 0; i < dim; i++) {
      for (let j = i; j < dim; j++) {
        cov[i][j] += row[i] * row[j];
      }
    }
  }
  for (let i = 0; i < dim; i++) {
    for (let j = i; j < dim; j++) {
      const value = cov[i][j] / n;
      cov[i][j] = value;
      cov[j][i] = value;
    }
  }
  return cov;
}

function matVec(matrix: number[][], vec: number[]): number[] {
  return matrix.map((row) => {
    let sum = 0;
    for (let i = 0; i < row.length; i++) sum += row[i] * vec[i];
    return sum;
  });
}

function normalize(vec: number[]): number[] {
  const mag = Math.sqrt(vec.reduce((s, x) => s + x * x, 0)) || 1;
  return vec.map((x) => x / mag);
}

function topEigenvector(matrix: number[][], seed: number): number[] {
  const dim = matrix.length;
  // Deterministic non-uniform seed so the two components diverge.
  let v = normalize(Array.from({ length: dim }, (_, i) => Math.sin(seed + i) + 0.5));
  for (let iter = 0; iter < POWER_ITERATIONS; iter++) {
    v = normalize(matVec(matrix, v));
  }
  return v;
}

/** Removes the component along `vec` from the matrix (deflation). */
function deflate(matrix: number[][], vec: number[]): number[][] {
  const av = matVec(matrix, vec);
  const lambda = vec.reduce((s, x, i) => s + x * av[i], 0);
  return matrix.map((row, i) => row.map((value, j) => value - lambda * vec[i] * vec[j]));
}

export interface Projection {
  coords: Array<{ x: number; y: number }>;
}

/** Projects vectors to 2D and scales coordinates into a [-1, 1] box. */
export function projectTo2D(vectors: number[][]): Projection {
  if (vectors.length === 0) return { coords: [] };
  if (vectors.length === 1) return { coords: [{ x: 0, y: 0 }] };

  const m = mean(vectors);
  const centered = center(vectors, m);
  const cov = covariance(centered);

  const pc1 = topEigenvector(cov, 1);
  const pc2 = topEigenvector(deflate(cov, pc1), 2);

  const raw = centered.map((row) => ({
    x: row.reduce((s, value, i) => s + value * pc1[i], 0),
    y: row.reduce((s, value, i) => s + value * pc2[i], 0),
  }));

  const maxAbs = raw.reduce((max, p) => Math.max(max, Math.abs(p.x), Math.abs(p.y)), 1e-6);
  const coords = raw.map((p) => ({ x: p.x / maxAbs, y: p.y / maxAbs }));
  return { coords };
}
