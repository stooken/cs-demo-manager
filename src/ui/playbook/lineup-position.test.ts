import { describe, expect, it } from 'vite-plus/test';
import { formatGetpos, parseGetpos } from './lineup-position';

const sample = 'setpos -1583.463623 -984.373108 -140.565186;setang -13.285021 36.707111 0.000000';
describe('CS2 console positions', () => {
  it('round-trips the console output including the echoed command', () => {
    const pose = parseGetpos(`> getpos\r\n${sample}\r\n> ${sample}`);
    expect(pose).toEqual({
      x: -1583.463623,
      y: -984.373108,
      z: -140.565186,
      pitch: -13.285021,
      yaw: 36.707111,
      roll: 0,
      exact: false,
    });
    expect(formatGetpos(pose!)).toBe(sample);
  });
  it('retains exact command mode, nonzero roll and sub-micro-unit precision', () => {
    const pose = parseGetpos('> GETPOS_EXACT\n  SETPOS_EXACT  +1.234567891  -.5  3e+1 ; setang_exact  0 90 -2.5');
    expect(pose?.exact).toBe(true);
    expect(formatGetpos(pose!)).toBe(
      'setpos_exact 1.234567891 -0.500000 30.000000;setang_exact 0.000000 90.000000 -2.500000',
    );
    expect(parseGetpos(formatGetpos(pose!))).toEqual(pose);
  });
  it.each([
    '',
    'getpos',
    'setpos 1 2 3',
    'setpos 1 2 3;setang 4 5',
    'setpos 1x 2 3;setang 4 5 6',
    'setpos 0 0 1e999;setang 0 0 0',
    'setpos 1 2 3;setang_exact 4 5 6',
    sample + ';echo unrelated',
    sample + '\n> setpos 1 2 3;setang 4 5 6',
  ])('rejects incomplete, ambiguous or unrelated input (%s)', (text) => {
    expect(parseGetpos(text)).toBeUndefined();
  });
});
