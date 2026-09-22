import { useMemo } from 'react';
import { generateStars } from '../lib/starField.ts';

/** The seeded star field behind the whole stage (design D). */
export function StarField() {
  const stars = useMemo(() => generateStars(), []);
  return (
    <div style={{ position: 'absolute', inset: 0 }} aria-hidden="true">
      {stars.map((star, i) => (
        <div
          key={i}
          className="stage-star"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: `${star.r}px`,
            height: `${star.r}px`,
            opacity: star.o,
          }}
        />
      ))}
    </div>
  );
}
