import type { VectorDoc } from '../types';

interface InspectorProps {
  doc: VectorDoc | null;
}

/** Maps a normalized vector value to a color: violet for negative, blue for positive. */
function cellColor(value: number): string {
  const mag = Math.min(1, Math.abs(value) * 3.2); // amplify; values are small after norm
  const hue = value >= 0 ? 248 : 300;
  const light = 30 + mag * 45;
  const chroma = 0.04 + mag * 0.16;
  return `oklch(${light}% ${chroma} ${hue})`;
}

export function Inspector({ doc }: InspectorProps) {
  if (!doc) {
    return (
      <section className="inspector inspector--empty" aria-live="polite">
        <p>Select a point or a result to inspect how it was tokenized and embedded.</p>
      </section>
    );
  }

  const { pieces, ids } = doc.tokens;

  return (
    <section className="inspector" aria-label={`Inspector for: ${doc.text}`}>
      <div className="inspector__grid">
        <div className="inspector__block">
          <h3 className="inspector__head">
            1 · Tokenization
            <span className="inspector__meta mono">
              {pieces.length} subword · {ids.length} total tokens
            </span>
          </h3>
          <p className="inspector__source">{doc.text}</p>
          <div className="tokens">
            {pieces.map((piece, i) => (
              <span key={i} className="token" title={`token #${i}`}>
                <span className="token__piece">{piece.replace(/^##/, '')}</span>
                {piece.startsWith('##') && <span className="token__cont">##</span>}
              </span>
            ))}
          </div>
          <div className="tokenids mono">[{ids.join(', ')}]</div>
        </div>

        <div className="inspector__block">
          <h3 className="inspector__head">
            2 · Embedding
            <span className="inspector__meta mono">{doc.vector.length} dimensions</span>
          </h3>
          <p className="inspector__note">
            Every token folds into a single normalized vector. Each cell is one dimension —
            blue is positive, violet is negative.
          </p>
          <div className="fingerprint" aria-hidden="true">
            {doc.vector.map((value, i) => (
              <span
                key={i}
                className="fingerprint__cell"
                style={{ backgroundColor: cellColor(value) }}
                title={`dim ${i}: ${value.toFixed(4)}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
