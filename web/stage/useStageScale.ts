import { useEffect, useState } from 'react';
import { computeStageScale } from '#shared/stage.ts';

/** Track the scale that fits the 1440x900 stage into the current window. */
export function useStageScale(): number {
  const [scale, setScale] = useState(() =>
    typeof window === 'undefined' ? 1 : computeStageScale(window.innerWidth, window.innerHeight),
  );

  useEffect(() => {
    const update = () => setScale(computeStageScale(window.innerWidth, window.innerHeight));
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return scale;
}
