import { Route, Routes } from 'react-router-dom';
import { useEmbedder } from './hooks/useEmbedder';
import { Header } from './components/Header';
import { Visualizer } from './pages/Visualizer';
import { TokenizeExplorer } from './pages/TokenizeExplorer';

export default function App() {
  // One shared worker / model download for the whole app.
  const { progress, embed, tokenize } = useEmbedder();

  return (
    <div className="shell">
      <Header progress={progress} />
      <Routes>
        <Route path="/" element={<Visualizer progress={progress} embed={embed} />} />
        <Route path="/tokenize" element={<TokenizeExplorer progress={progress} tokenize={tokenize} />} />
      </Routes>
    </div>
  );
}
