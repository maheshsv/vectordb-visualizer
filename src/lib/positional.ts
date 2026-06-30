/**
 * The original Transformer's sinusoidal positional encoding (Vaswani et al.).
 * PE(pos, 2i)   = sin(pos / 10000^(2i/dim))
 * PE(pos, 2i+1) = cos(pos / 10000^(2i/dim))
 * Added to a token's embedding so the model knows where the token sits.
 */
export function positionalEncoding(pos: number, dim: number): number[] {
  const pe = new Array<number>(dim);
  for (let k = 0; k < dim; k++) {
    const i = Math.floor(k / 2);
    const denom = Math.pow(10000, (2 * i) / dim);
    pe[k] = k % 2 === 0 ? Math.sin(pos / denom) : Math.cos(pos / denom);
  }
  return pe;
}

/** GELU activation (a stand-in for the feed-forward network's nonlinearity). */
export function gelu(x: number): number {
  return 0.5 * x * (1 + Math.tanh(Math.sqrt(2 / Math.PI) * (x + 0.044715 * x ** 3)));
}
