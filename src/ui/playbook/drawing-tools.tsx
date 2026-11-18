import React, { useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { Button, ButtonVariant } from 'csdm/ui/components/buttons/button';
import { maxStrokes, type Pen, type Stroke, type TimedDrawing } from './drawings';
import { maxSeconds } from './timeline-limit';
import { fieldClassName } from './fields';

function Timing({ drawing, onUpdate }: { drawing: TimedDrawing; onUpdate: (start: number, end: number) => void }) {
  const { t } = useLingui();
  const [start, setStart] = useState(String(drawing.start));
  const [end, setEnd] = useState(String(drawing.end));
  const showAt = Number(start);
  const hideAt = Number(end);
  const valid =
    start !== '' &&
    end !== '' &&
    Number.isFinite(showAt) &&
    Number.isFinite(hideAt) &&
    showAt >= 0 &&
    showAt < hideAt &&
    hideAt <= maxSeconds;
  return (
    <form
      className="flex flex-col gap-8"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onUpdate(showAt, hideAt);
      }}
    >
      <div className="flex gap-8">
        <label className="min-w-0 flex-1 text-caption">
          {t`Show at (s)`}
          <input
            aria-label={t`Show at (s)`}
            className={fieldClassName}
            type="number"
            min={0}
            max={maxSeconds}
            step="0.1"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
        <label className="min-w-0 flex-1 text-caption">
          {t`Hide at (s)`}
          <input
            aria-label={t`Hide at (s)`}
            className={fieldClassName}
            type="number"
            min={0}
            max={maxSeconds}
            step="0.1"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </label>
      </div>
      {(start !== String(drawing.start) || end !== String(drawing.end)) && (
        <>
          {!valid && (
            <span role="alert">
              <Trans>Choose a start before the end, between 0 and 120 seconds.</Trans>
            </span>
          )}
          <Button type="submit" isDisabled={!valid}>
            <Trans>Apply timing</Trans>
          </Button>
        </>
      )}
    </form>
  );
}

type Props = {
  pen: Pen | undefined;
  onPen: (pen: Pen) => void;
  color: Stroke['color'];
  onColor: (color: Stroke['color']) => void;
  coaching: Stroke[];
  onCoaching: (strokes: Stroke[]) => void;
  drawings: TimedDrawing[];
  onDrawings: (items: TimedDrawing[]) => void;
  selected: string | undefined;
  onSelect: (drawing: TimedDrawing) => void;
};
export function DrawingTools({
  pen,
  onPen,
  color,
  onColor,
  coaching,
  onCoaching,
  drawings,
  onDrawings,
  selected,
  onSelect,
}: Props) {
  const { t } = useLingui();
  return (
    <>
      <label>
        {t`Ink color`}
        <select
          className={fieldClassName}
          aria-label={t`Ink color`}
          value={color}
          onChange={(e) => onColor(e.target.value as Stroke['color'])}
        >
          <option value="yellow">{t`Yellow`}</option>
          <option value="red">{t`Red`}</option>
          <option value="blue">{t`Blue`}</option>
          <option value="white">{t`White`}</option>
        </select>
      </label>
      <div className="flex flex-col gap-8">
        <Button
          variant={pen === 'coaching' ? ButtonVariant.Primary : ButtonVariant.Default}
          isDisabled={coaching.length >= maxStrokes}
          onClick={() => onPen('coaching')}
        >
          <Trans>Coaching pen</Trans>
        </Button>
        <p className="text-caption text-gray-700">
          <Trans>Draw while you talk. Coaching ink clears when you leave this strategy.</Trans>
        </p>
        {coaching.length > 0 && (
          <div className="flex flex-wrap gap-4">
            <Button onClick={() => onCoaching(coaching.slice(0, -1))}>
              <Trans>Undo last stroke</Trans>
            </Button>
            <Button onClick={() => onCoaching([])}>
              <Trans>Clear coaching ink</Trans>
            </Button>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-8 border-t border-gray-300 pt-12">
        <Button
          variant={pen === 'timed' ? ButtonVariant.Primary : ButtonVariant.Default}
          isDisabled={drawings.length >= maxStrokes}
          onClick={() => onPen('timed')}
        >
          <Trans>Timed pen</Trans>
        </Button>
        <p className="text-caption text-gray-700">
          <Trans>Draw at the playhead. Adjust when each stroke appears and disappears below.</Trans>
        </p>
        {drawings.toReversed().map((d, i) => {
          const number = drawings.length - i;
          const start = d.start,
            end = d.end;
          return (
            <div key={d.id} className="flex flex-col gap-8 rounded-4 border border-gray-300 p-8">
              <button
                className="flex flex-wrap items-center gap-8 text-left"
                aria-expanded={selected === d.id}
                onClick={() => onSelect(d)}
              >
                <strong>
                  <Trans>Stroke {number}</Trans>
                </strong>
                <span className="text-caption">
                  <Trans>
                    {start}–{end}s
                  </Trans>{' '}
                  · {d.floor === 'upper' ? t`Upper` : t`Lower`}
                </span>
              </button>
              {selected === d.id && (
                <>
                  <Timing
                    key={`${d.start}-${d.end}`}
                    drawing={d}
                    onUpdate={(start, end) => {
                      const updated = { ...d, start, end };
                      onDrawings(drawings.map((item) => (item.id === d.id ? updated : item)));
                      onSelect(updated);
                    }}
                  />
                  <Button onClick={() => onDrawings(drawings.filter((item) => item.id !== d.id))}>
                    <Trans>Remove stroke</Trans>
                  </Button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
