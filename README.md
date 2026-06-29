# VectorDB Visualizer

**🔗 Live demo: [preeminent-faun-2e7acc.netlify.app](https://preeminent-faun-2e7acc.netlify.app/)**

An interactive, in-browser visualizer for how a vector database actually works:
**text → tokens → embedding → similarity search → ranked results**, with a live 2D
projection of the vector space.

Unlike simulated demos, this uses **real semantic embeddings** running entirely on your
device via [Transformers.js](https://github.com/huggingface/transformers.js) — no API keys,
no server. Similar sentences genuinely land near each other.

## Features

- **Real tokenization** — see the WordPiece subword split (`un` · `##believ` · `##able`) and token IDs
- **Real embeddings** — `all-MiniLM-L6-v2` (384-dim), pooled + normalized, computed in a Web Worker
- **2D vector space** — high-dim vectors projected with PCA, with glowing points and query→neighbor edges
- **Semantic search** — switch between cosine, euclidean, and dot-product metrics and watch the ranking change
- **Vector fingerprint** — every dimension rendered as a color cell so you can see what a vector *is*

## Tech stack

React 19 · TypeScript · Vite · `@huggingface/transformers` · hand-rolled PCA (no heavy deps).

## Run locally

```bash
npm install
npm run dev
```

Then open the printed local URL. The embedding model (~30 MB) downloads from the Hugging Face
hub on first load and is cached by the browser afterward.

## Build

```bash
npm run build      # type-check + production build into dist/
npm run preview    # preview the production build
```

## How it works

1. **Tokenize** — the model's tokenizer splits text into subword pieces and integer IDs.
2. **Embed** — token embeddings are mean-pooled into one normalized 384-dim vector per document.
3. **Project** — PCA reduces all vectors to 2D so the space is visible.
4. **Search** — the query is embedded the same way and scored against every document; results are ranked.

## Deploy

Zero-config on Vercel — it detects Vite automatically. Push to GitHub and import the repo at
[vercel.com/new](https://vercel.com/new), or run `vercel` from this directory.
