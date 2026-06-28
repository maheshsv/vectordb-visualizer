import type { Metric } from '../types';
import { metricLabel } from '../lib/similarity';

interface SearchPanelProps {
  query: string;
  metric: Metric;
  normalize: boolean;
  topK: number;
  maxK: number;
  disabled: boolean;
  onQueryChange: (value: string) => void;
  onMetricChange: (metric: Metric) => void;
  onNormalizeChange: (value: boolean) => void;
  onTopKChange: (value: number) => void;
  onSearch: () => void;
}

const METRICS: Metric[] = ['cosine', 'euclidean', 'dot'];

export function SearchPanel({
  query,
  metric,
  normalize,
  topK,
  maxK,
  disabled,
  onQueryChange,
  onMetricChange,
  onNormalizeChange,
  onTopKChange,
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

      <div className="search__controls">
        <label className="switch">
          <input
            type="checkbox"
            checked={normalize}
            onChange={(e) => onNormalizeChange(e.target.checked)}
          />
          <span className="switch__track" aria-hidden="true" />
          <span className="switch__label">
            Normalize vectors
            <span className="switch__sub">{normalize ? 'cosine = dot' : 'magnitude matters'}</span>
          </span>
        </label>

        <label className="slider">
          <span className="slider__label">
            Neighbors <span className="mono">k = {topK}</span>
          </span>
          <input
            type="range"
            min={1}
            max={maxK}
            value={topK}
            onChange={(e) => onTopKChange(Number(e.target.value))}
          />
        </label>
      </div>
    </div>
  );
}
