/**
 * Didactic single-head scaled dot-product self-attention.
 *
 *   Attention(Q, K, V) = softmax(QKᵀ / √d) · V
 *
 * Here Q = K = the model's per-token embedding vectors, so the weights show
 * how strongly each token attends to every other token by similarity. This is
 * the real attention computation — not MiniLM's learned multi-head weights,
 * which aren't exposed — so it illustrates the mechanism honestly.
 */
export function selfAttention(matrix: number[][]): number[][] {
  const n = matrix.length;
  if (n === 0) return [];
  const dim = matrix[0].length;
  const scale = Math.sqrt(dim);

  const weights: number[][] = [];
  for (let i = 0; i < n; i++) {
    const scores = new Array<number>(n);
    let max = -Infinity;
    for (let j = 0; j < n; j++) {
      let dot = 0;
      for (let k = 0; k < dim; k++) dot += matrix[i][k] * matrix[j][k];
      const score = dot / scale;
      scores[j] = score;
      if (score > max) max = score;
    }
    let sum = 0;
    for (let j = 0; j < n; j++) {
      scores[j] = Math.exp(scores[j] - max);
      sum += scores[j];
    }
    for (let j = 0; j < n; j++) scores[j] /= sum;
    weights.push(scores);
  }
  return weights;
}
