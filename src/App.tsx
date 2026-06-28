import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Metric, SearchResult, VectorDoc } from './types';
import { useEmbedder } from './hooks/useEmbedder';
import { projectTo2D } from './lib/pca';
import { score, unit } from './lib/similarity';
import { buildKnnGraph, greedySearch } from './lib/annGraph';
import { SAMPLE_DOCUMENTS, SAMPLE_QUERY } from './lib/sampleData';
import { Header } from './components/Header';
import { DocumentInput } from './components/DocumentInput';
import { CorpusList } from './components/CorpusList';
import { PointCloud } from './components/PointCloud';
import { SearchPanel } from './components/SearchPanel';
import { ResultsList } from './components/ResultsList';
import { Inspector } from './components/Inspector';

const MAX_NEIGHBORS = 3; // links per node in the ANN graph

let docCounter = 0;
function makeDocId(): string {
  docCounter += 1;
  return `doc-${docCounter}`;
}

export default function App() {
  const { progress, embed } = useEmbedder();
  const [docs, setDocs] = useState<VectorDoc[]>([]);
  const [metric, setMetric] = useState<Metric>('cosine');
  const [normalize, setNormalize] = useState(true);
  const [showGraph, setShowGraph] = useState(false);
  const [topK, setTopK] = useState(3);
  const [query, setQuery] = useState(SAMPLE_QUERY);
  const [queryVectorRaw, setQueryVectorRaw] = useState<number[] | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const seededRef = useRef(false);

  const addDocument = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const { vector, tokens } = await embed(trimmed);
      setDocs((prev) => [
        ...prev,
        { id: makeDocId(), text: trimmed, vector, tokens, x: 0, y: 0 },
      ]);
    },
    [embed],
  );

  const removeDocument = useCallback((id: string) => {
    setDocs((prev) => prev.filter((d) => d.id !== id));
    setFocusedId((prev) => (prev === id ? null : prev));
  }, []);

  // Seed the sample corpus once the model is ready.
  useEffect(() => {
    if (progress.status !== 'ready' || seededRef.current) return;
    seededRef.current = true;
    (async () => {
      setBusy(true);
      for (const text of SAMPLE_DOCUMENTS) await addDocument(text);
      setBusy(false);
    })();
  }, [progress.status, addDocument]);

  // Effective vectors: optionally unit-normalized. Cosine is scale-invariant,
  // but dot product and euclidean change — this is what the toggle reveals.
  const procVectors = useMemo(
    () => docs.map((d) => (normalize ? unit(d.vector) : d.vector)),
    [docs, normalize],
  );
  const procQuery = useMemo(
    () => (queryVectorRaw ? (normalize ? unit(queryVectorRaw) : queryVectorRaw) : null),
    [queryVectorRaw, normalize],
  );

  // Project documents (and the query) into a shared 2D space.
  const { docsWithCoords, queryCoord } = useMemo(() => {
    const vectors = [...procVectors];
    if (procQuery) vectors.push(procQuery);
    const { coords } = projectTo2D(vectors);
    const withCoords = docs.map((d, i) => ({ ...d, x: coords[i]?.x ?? 0, y: coords[i]?.y ?? 0 }));
    const qCoord = procQuery ? coords[docs.length] : null;
    return { docsWithCoords: withCoords, queryCoord: qCoord ?? null };
  }, [docs, procVectors, procQuery]);

  // Build the navigable graph over the effective vectors.
  const graph = useMemo(() => {
    if (procVectors.length < 2) return { neighbors: [], edges: [] };
    return buildKnnGraph(procVectors, Math.min(MAX_NEIGHBORS, procVectors.length - 1));
  }, [procVectors]);

  // Rank the whole corpus against the query (derived, so it re-ranks instantly
  // when metric / normalize change).
  const results = useMemo<SearchResult[]>(() => {
    if (!procQuery) return [];
    return docs
      .map((doc, i) => ({ doc, score: score(metric, procQuery, procVectors[i]) }))
      .sort((a, b) => b.score - a.score);
  }, [docs, procVectors, procQuery, metric]);

  // Per-node similarity to the query, for hover tooltips.
  const scoresByIndex = useMemo(
    () => (procQuery ? procVectors.map((v) => score(metric, procQuery, v)) : []),
    [procVectors, procQuery, metric],
  );

  // Greedy graph traversal from entry node to the query's neighborhood.
  const traversal = useMemo(
    () => (procQuery && procVectors.length >= 2 ? greedySearch(graph, procVectors, procQuery, metric) : []),
    [graph, procVectors, procQuery, metric],
  );

  const runSearch = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed || docs.length === 0) return;
    setBusy(true);
    const { vector } = await embed(trimmed);
    setQueryVectorRaw(vector);
    const qv = normalize ? unit(vector) : vector;
    let bestId: string | null = null;
    let bestScore = -Infinity;
    docs.forEach((doc) => {
      const v = normalize ? unit(doc.vector) : doc.vector;
      const s = score(metric, qv, v);
      if (s > bestScore) {
        bestScore = s;
        bestId = doc.id;
      }
    });
    setFocusedId(bestId);
    setBusy(false);
  }, [query, docs, metric, normalize, embed]);

  const topIds = useMemo(
    () => new Set(results.slice(0, topK).map((r) => r.doc.id)),
    [results, topK],
  );
  const focusedDoc = docsWithCoords.find((d) => d.id === focusedId) ?? null;
  const maxK = Math.max(1, Math.min(8, docs.length));

  return (
    <div className="shell">
      <Header progress={progress} docCount={docs.length} />

      <main className="layout">
        <section className="panel panel--corpus" aria-labelledby="corpus-heading">
          <h2 id="corpus-heading" className="panel__title">
            Corpus
          </h2>
          <DocumentInput onAdd={addDocument} disabled={progress.status !== 'ready' || busy} />
          <CorpusList
            docs={docsWithCoords}
            focusedId={focusedId}
            topIds={topIds}
            onFocus={setFocusedId}
            onRemove={removeDocument}
          />
        </section>

        <section className="panel panel--cloud" aria-labelledby="cloud-heading">
          <h2 id="cloud-heading" className="panel__title">
            Vector space <span className="panel__hint">PCA → 2D</span>
          </h2>
          <label className="switch">
            <input
              type="checkbox"
              checked={showGraph}
              onChange={(e) => setShowGraph(e.target.checked)}
            />
            <span className="switch__track" aria-hidden="true" />
            <span className="switch__label">
              ANN graph {showGraph && traversal.length > 0 && (
                <span className="switch__sub mono">· {traversal.length} hops to result</span>
              )}
            </span>
          </label>
          <PointCloud
            docs={docsWithCoords}
            queryCoord={queryCoord}
            topIds={topIds}
            focusedId={focusedId}
            graph={graph}
            showGraph={showGraph}
            traversal={traversal}
            scoresByIndex={scoresByIndex}
            metric={metric}
            onFocus={setFocusedId}
          />
        </section>

        <section className="panel panel--search" aria-labelledby="search-heading">
          <h2 id="search-heading" className="panel__title">
            Semantic search
          </h2>
          <SearchPanel
            query={query}
            metric={metric}
            normalize={normalize}
            topK={topK}
            maxK={maxK}
            disabled={progress.status !== 'ready' || busy}
            onQueryChange={setQuery}
            onMetricChange={setMetric}
            onNormalizeChange={setNormalize}
            onTopKChange={setTopK}
            onSearch={runSearch}
          />
          <ResultsList
            results={results}
            metric={metric}
            topK={topK}
            focusedId={focusedId}
            onFocus={setFocusedId}
          />
        </section>
      </main>

      <Inspector doc={focusedDoc} />
    </div>
  );
}
