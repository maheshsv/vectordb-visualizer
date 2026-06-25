import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Metric, SearchResult, VectorDoc } from './types';
import { useEmbedder } from './hooks/useEmbedder';
import { projectTo2D } from './lib/pca';
import { score } from './lib/similarity';
import { SAMPLE_DOCUMENTS, SAMPLE_QUERY } from './lib/sampleData';
import { Header } from './components/Header';
import { DocumentInput } from './components/DocumentInput';
import { CorpusList } from './components/CorpusList';
import { PointCloud } from './components/PointCloud';
import { SearchPanel } from './components/SearchPanel';
import { ResultsList } from './components/ResultsList';
import { Inspector } from './components/Inspector';

const TOP_K = 3;

let docCounter = 0;
function makeDocId(): string {
  docCounter += 1;
  return `doc-${docCounter}`;
}

export default function App() {
  const { progress, embed } = useEmbedder();
  const [docs, setDocs] = useState<VectorDoc[]>([]);
  const [metric, setMetric] = useState<Metric>('cosine');
  const [query, setQuery] = useState(SAMPLE_QUERY);
  const [queryVector, setQueryVector] = useState<number[] | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const seededRef = useRef(false);

  // Add one document: embed it, then store with placeholder coords.
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
    setResults((prev) => prev.filter((r) => r.doc.id !== id));
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

  // Project documents (and the query, if present) into a shared 2D space.
  const { docsWithCoords, queryCoord } = useMemo(() => {
    const vectors = docs.map((d) => d.vector);
    if (queryVector) vectors.push(queryVector);
    const { coords } = projectTo2D(vectors);
    const withCoords = docs.map((d, i) => ({ ...d, x: coords[i]?.x ?? 0, y: coords[i]?.y ?? 0 }));
    const qCoord = queryVector ? coords[docs.length] : null;
    return { docsWithCoords: withCoords, queryCoord: qCoord ?? null };
  }, [docs, queryVector]);

  const runSearch = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed || docs.length === 0) return;
    setBusy(true);
    const { vector } = await embed(trimmed);
    const ranked = docs
      .map((doc) => ({ doc, score: score(metric, vector, doc.vector) }))
      .sort((a, b) => b.score - a.score);
    setQueryVector(vector);
    setResults(ranked);
    setFocusedId(ranked[0]?.doc.id ?? null);
    setBusy(false);
  }, [query, docs, metric, embed]);

  // Re-rank instantly when the metric changes (vectors already cached).
  useEffect(() => {
    if (!queryVector) return;
    setResults(
      docs
        .map((doc) => ({ doc, score: score(metric, queryVector, doc.vector) }))
        .sort((a, b) => b.score - a.score),
    );
  }, [metric, queryVector, docs]);

  const topIds = useMemo(
    () => new Set(results.slice(0, TOP_K).map((r) => r.doc.id)),
    [results],
  );
  const focusedDoc = docsWithCoords.find((d) => d.id === focusedId) ?? null;

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
          <PointCloud
            docs={docsWithCoords}
            queryCoord={queryCoord}
            topIds={topIds}
            focusedId={focusedId}
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
            disabled={progress.status !== 'ready' || busy}
            onQueryChange={setQuery}
            onMetricChange={setMetric}
            onSearch={runSearch}
          />
          <ResultsList
            results={results}
            metric={metric}
            focusedId={focusedId}
            onFocus={setFocusedId}
          />
        </section>
      </main>

      <Inspector doc={focusedDoc} />
    </div>
  );
}
