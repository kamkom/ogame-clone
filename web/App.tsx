import { Routes, Route } from 'react-router-dom';
import { Stage } from './stage/Stage.tsx';

/** The empty stage for the walking skeleton: star field and background only. */
function EmptyStage() {
  return <Stage />;
}

export function App() {
  return (
    <Routes>
      <Route path="*" element={<EmptyStage />} />
    </Routes>
  );
}
