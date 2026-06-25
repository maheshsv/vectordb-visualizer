import type { Metric } from '../types';
import { metricLabel } from '../lib/similarity';

interface SearchPanelProps {
  query: string;
  metric: Metric;
  disabled: boolean;
  onQueryChange: (value: string) => void;
  onMetricChange: (metric: Metric) => void;
  onSearch: () => void;
}

const METRICS: Metric[] = ['cosine', 'euclidean', 'dot'];

export function SearchPanel({
  query,
  metric,
  disabled,
  onQueryChange,
  onMetricChange,
  onSearch,
}: SearchPanelProps) {
  return (
    <div className="search">
      <div className="search__row">
        <input
          className="search__input"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !disabled && onSearch()}
          placeholder="Ask something…"
          aria-label="Search query"
          disabled={disabled}
        />
        <button className="btn btn--accent" onClick={onSearch} disabled={disabled || !query.trim()}>
          Search
        </button>
      </div>

      <div className="search__metrics" role="radiogroup" aria-label="Distance metric">
        {METRICS.map((m) => (
          <button
            key={m}
            role="radio"
            aria-checked={metric === m}
            className={`chip ${metric === m ? 'is-active' : ''}`}
            onClick={() => onMetricChange(m)}
          >
            {metricLabel(m)}
          </button>
        ))}
      </div>
    </div>
  );
}
