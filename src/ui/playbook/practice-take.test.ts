import { describe, expect, it } from 'vite-plus/test';
import { parsePracticeTake, playbackTick } from './practice-take';

const take = {
  format: 'csdm-practice-take',
  version: 1,
  name: 'entry',
  map: 'de_mirage',
  side: 'T',
  tickrate: 64,
  frames: [
    [1, 2, 3, -18, 179],
    [1, 2, 4, 13, -179],
  ],
  throws: [{ weapon: 'smokegrenade', tick: 0, position: [1, 2, 3], flight: [[1, 2, 3, 4]] }],
  motion: 'server-only',
};
describe('recorded practice takes', () => {
  it('keeps animation inside the recorded frames on start, seek and completion', () => {
    expect(playbackTick(0, -5, 64, 500)).toBe(0);
    expect(playbackTick(10, 500, 64, 500)).toBe(42);
    expect(playbackTick(250, 6000, 64, 500)).toBe(500);
  });
  it('reads game coordinates and release times without retaining bot command data', () => {
    const parsed = parsePracticeTake(JSON.stringify(take));
    expect(parsed.frames).toEqual(take.frames);
    expect(parsed.throws).toEqual(take.throws);
    expect(parsed).not.toHaveProperty('motion');
  });
  it.each([
    { version: 2 },
    { tickrate: 0 },
    { frames: [] },
    { frames: [[1, 2, 3]] },
    { throws: [{ ...take.throws[0], tick: 2 }] },
    {
      throws: [
        {
          ...take.throws[0],
          flight: [
            [1, 2, 3, 4],
            [0, 2, 3, 4],
          ],
        },
      ],
    },
    { throws: [{ ...take.throws[0], weapon: 'knife' }] },
  ])('rejects invalid take data %j', (changes) => {
    expect(() => parsePracticeTake(JSON.stringify({ ...take, ...changes }))).toThrow();
  });
});
