import type { Metric, SearchResult } from '../types';
import { formatScore } from '../lib/similarity';

interface ResultsListProps {
  results: SearchResult[];
  metric: Metric;
  focusedId: string | null;
  onFocus: (id: string) => void;
}

export function ResultsList({ results, metric, focusedId, onFocus }: ResultsListProps) {
  if (results.length === 0) {
    return <p className="results__empty">Run a search to rank the corpus by similarity.</p>;
  }

  const best = Math.abs(results[0]?.score) || 1;

  return (
    <ol className="results">
      {results.map((r, i) => {
        const fill = Math.max(0, Math.min(1, Math.abs(r.score) / best)) * 100;
        return (
          <li
            key={r.doc.id}
            className={`results__item ${focusedId === r.doc.id ? 'is-focused' : ''}`}
            onClick={() => onFocus(r.doc.id)}
          >
            <span className="results__rank mono">{i + 1}</span>
            <span className="results__text">{r.doc.text}</span>
            <span className="results__score mono">{formatScore(metric, r.score)}</span>
            <span className="results__bar" aria-hidden="true">
              <span className="results__barfill" style={{ width: `${fill}%` }} />
            </span>
          </li>
        );
      })}
    </ol>
  );
}
