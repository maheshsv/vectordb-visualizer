import { NavLink } from 'react-router-dom';
import type { ModelProgress } from '../types';

interface HeaderProps {
  progress: ModelProgress;
}

const STATUS_LABEL: Record<ModelProgress['status'], string> = {
  idle: 'Idle',
  loading: 'Loading model',
  ready: 'Model ready',
  error: 'Model error',
};

export function Header({ progress }: HeaderProps) {
  return (
    <header className="masthead">
      <div className="masthead__brand">
        <span className="masthead__mark" aria-hidden="true" />
        <div>
          <h1 className="masthead__title">VectorDB Visualizer</h1>
          <p className="masthead__sub">
            Watch text become tokens, then vectors, then ranked search results — with real
            on-device embeddings.
          </p>
        </div>
      </div>

      <div className="masthead__right">
        <nav className="navtabs" aria-label="Primary">
          <NavLink to="/" end className="navtab">
            Search
          </NavLink>
          <NavLink to="/tokenize" className="navtab">
            Tokenize
          </NavLink>
        </nav>

        <div className="masthead__status" role="status" aria-live="polite">
          <span className={`statuspill statuspill--${progress.status}`}>
            <span className="statuspill__dot" aria-hidden="true" />
            {STATUS_LABEL[progress.status]}
          </span>
          {progress.status === 'loading' && (
            <div className="statusbar" aria-hidden="true">
              <div className="statusbar__fill" style={{ width: `${progress.percent}%` }} />
            </div>
          )}
          {progress.status === 'loading' && (
            <span className="masthead__count mono">{progress.message}</span>
          )}
          {progress.status === 'error' && (
            <span className="masthead__count masthead__count--error">{progress.message}</span>
          )}
        </div>
      </div>
    </header>
  );
}
