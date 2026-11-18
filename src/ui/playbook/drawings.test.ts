import { describe, expect, it } from 'vite-plus/test';
import { GrenadeName } from 'csdm/common/types/counter-strike';
import { drawingInterval, visibleAt, type TimedDrawing, timedDrawingSchema, maxVertices } from './drawings';
import { newStrategy, durationOf } from './strategy';
import { importStrategy, serializeStrategy } from './strategy-file';

function drawing(): TimedDrawing {
  return {
    id: crypto.randomUUID(),
    start: 12.5,
    end: 18,
    floor: 'lower',
    color: 'blue',
    points: [
      { x: 12, y: 13 },
      { x: 60, y: 18 },
    ],
  };
}
describe('Rehearsal drawings', () => {
  it('shows ink at the start and hides it exactly at the end', () => {
    const stroke = drawing();
    expect([12.4, 12.5, 17.99, 18, 20].map((t) => visibleAt(stroke, t))).toEqual([false, true, true, false, false]);
  });
  it('creates editable windows at the playhead and at the time limit', () => {
    expect(drawingInterval(7.34)).toEqual({ start: 7.3, end: 12.3 });
    expect(drawingInterval(122)).toEqual({ start: 119.9, end: 120 });
  });
  it('validates imported stroke geometry and timing', () => {
    const stroke = drawing();
    for (const patch of [
      { start: 18 },
      { end: 0 },
      { end: 121 },
      { start: -2 },
      { floor: 'outside' },
      { points: [] },
      { points: [{ x: -1, y: 0 }] },
      { points: Array(maxVertices + 1).fill({ x: 5, y: 5 }) },
    ]) {
      expect(timedDrawingSchema.safeParse({ ...stroke, ...patch }).success).toBe(false);
    }
  });
  it('round-trips timed ink, floor and exact lineup values', async () => {
    const s = newStrategy('Ramp', 'de_nuke', 'T');
    s.drawings = [drawing()];
    const from = s.players[0].route[0];
    s.lineups = [
      {
        id: crypto.randomUUID(),
        title: 'Ramp',
        kind: GrenadeName.Smoke,
        player: 0,
        time: 0,
        from,
        to: from,
        instructions: '',
        media: [],
        pose: { x: -11.186, y: 0, z: 4, pitch: 1, yaw: 90, roll: 0, exact: false },
      },
    ];
    const file = await serializeStrategy(s);
    expect(JSON.parse(file).version).toBe(2);
    const copy = importStrategy(file);
    expect(copy.drawings).toEqual(s.drawings);
    expect(copy.lineups[0].pose).toEqual(s.lineups[0].pose);
    expect(durationOf(copy)).toBe(18);
  });
  it('keeps legacy records and exchanges usable', async () => {
    const legacy = newStrategy('A', 'de_mirage', 'T');
    expect(durationOf(legacy)).toBe(5);
    const file = await serializeStrategy(legacy);
    expect(JSON.parse(file).version).toBe(1);
    expect(importStrategy(file).drawings).toBeUndefined();
  });
});
