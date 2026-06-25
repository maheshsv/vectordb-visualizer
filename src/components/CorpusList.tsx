import type { VectorDoc } from '../types';

interface CorpusListProps {
  docs: VectorDoc[];
  focusedId: string | null;
  topIds: Set<string>;
  onFocus: (id: string) => void;
  onRemove: (id: string) => void;
}

export function CorpusList({ docs, focusedId, topIds, onFocus, onRemove }: CorpusListProps) {
  if (docs.length === 0) {
    return <p className="corpus__empty">No documents yet. They’ll appear here as they’re embedded.</p>;
  }

  return (
    <ul className="corpus">
      {docs.map((doc) => {
        const classes = [
          'corpus__item',
          focusedId === doc.id ? 'is-focused' : '',
          topIds.has(doc.id) ? 'is-match' : '',
        ]
          .filter(Boolean)
          .join(' ');
        return (
          <li key={doc.id} className={classes}>
            <button className="corpus__text" onClick={() => onFocus(doc.id)} title="Inspect vector">
              {doc.text}
            </button>
            <button
              className="corpus__remove"
              onClick={() => onRemove(doc.id)}
              aria-label={`Remove: ${doc.text}`}
            >
              ×
            </button>
          </li>
        );
      })}
    </ul>
  );
}
