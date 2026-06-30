import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { useEmbedder } from './hooks/useEmbedder';
import { Header } from './components/Header';
import { Visualizer } from './pages/Visualizer';

// Code-split the tokenize page so its BPE vocabulary (cl100k_base, ~450 KB)
// only downloads when the route is visited.
const TokenizeExplorer = lazy(() =>
  import('./pages/TokenizeExplorer').then((m) => ({ default: m.TokenizeExplorer })),
);
const Transformer = lazy(() =>
  import('./pages/Transformer').then((m) => ({ default: m.Transformer })),
);

export default function App() {
  // One shared worker / model download for the whole app.
  const { progress, embed, tokenize, tokenEmbed } = useEmbedder();

  return (
    <div className="shell">
      <Header progress={progress} />
      <Suspense fallback={<p className="route-loading">Loading…</p>}>
        <Routes>
          <Route path="/" element={<Visualizer progress={progress} embed={embed} />} />
          <Route
            path="/tokenize"
            element={<TokenizeExplorer progress={progress} tokenize={tokenize} />}
          />
          <Route
            path="/transformer"
            element={<Transformer progress={progress} tokenEmbed={tokenEmbed} />}
          />
        </Routes>
      </Suspense>
    </div>
  );
}
