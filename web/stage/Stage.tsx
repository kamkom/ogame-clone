import type { ReactNode } from 'react';
import { STAGE_HEIGHT, STAGE_WIDTH } from '#shared/stage.ts';
import { StarField } from './StarField.tsx';
import { useStageScale } from './useStageScale.ts';

interface StageProps {
  children?: ReactNode;
}

/**
 * The scale-to-fit 1440x900 stage: a fixed canvas transformed by `useStageScale`, with
 * the star field painted behind everything. A wrapper reserves the scaled box so the page
 * scrolls once the scale hits its 0.75 floor.
 */
export function Stage({ children }: StageProps) {
  const scale = useStageScale();

  return (
    <div className="stage-viewport">
      <div
        style={{
          width: STAGE_WIDTH * scale,
          height: STAGE_HEIGHT * scale,
          flex: 'none',
        }}
      >
        <div className="stage" style={{ transform: `scale(${scale})` }}>
          <StarField />
          {children}
        </div>
      </div>
    </div>
  );
}
