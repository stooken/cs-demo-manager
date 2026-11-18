import { describe, expect, it } from 'vite-plus/test';
import { Game, GrenadeName, TeamNumber } from 'csdm/common/types/counter-strike';
import type { Map } from 'csdm/common/types/map';
import type { GrenadeThrow } from 'csdm/common/types/grenade-throw';
import { durationOf, newStrategy, placeFrame, positionAt, type Lineup, type Frame } from './strategy';
import { importStrategy, serializeStrategy } from './strategy-file';
import { lineupFromDemo } from './demo-lineup';

const start: Frame = { time: 0, x: 100, y: 100, floor: 'upper' };
const end: Frame = { time: 10, x: 500, y: 300, floor: 'lower' };
function example() {
  const strategy = newStrategy('Ramp retake', 'de_nuke', 'CT');
  const lineup: Lineup = {
    id: crypto.randomUUID(),
    title: 'Ramp flash',
    from: { x: start.x, y: start.y, floor: start.floor },
    to: { x: end.x, y: end.y, floor: end.floor },
    kind: GrenadeName.Flashbang,
    player: 1,
    time: 12,
    instructions: 'Hold then throw',
    media: [],
  };
  strategy.lineups.push(lineup);
  strategy.players[0].route = [start, end];
  return strategy;
}

describe('Strategy timeline', () => {
  it('creates five independently editable players', () => {
    const strategy = newStrategy('test', 'de_mirage', 'T');
    expect(strategy.players).toHaveLength(5);
    strategy.players[0].route[0].x = 12;
    expect(strategy.players[1].route[0].x).not.toBe(12);
    expect(durationOf(strategy)).toBe(5);
  });
  it('inserts, rounds and replaces keyframes without modifying the original route', () => {
    const route = [start, end];
    const inserted = placeFrame(route, end, 4.6);
    expect(inserted.map((frame) => frame.time)).toEqual([0, 5, 10]);
    const moved = placeFrame(inserted, start, 5);
    expect(moved[1].x).toBe(100);
    expect(inserted[1].x).toBe(500);
    expect(route).toEqual([start, end]);
  });
  it('caps placements at the authored time bounds', () => {
    expect(placeFrame([start], end, -3)).toEqual([{ ...end, time: 0 }]);
    expect(placeFrame([start], end, 150).at(-1)?.time).toBe(120);
  });
  it('holds before and after movement and switches floor on arrival', () => {
    expect(positionAt([start, end], -1)).toMatchObject(start);
    expect(positionAt([start, end], 5)).toEqual({ x: 300, y: 200, floor: 'upper' });
    expect(positionAt([start, end], 10)).toMatchObject(end);
    expect(positionAt([start, end], 30)).toMatchObject(end);
  });
  it('holds the position during a wait and includes the last utility cue', () => {
    expect(positionAt([start, { ...start, time: 5 }, end], 3)).toMatchObject({ x: start.x, y: start.y });
    expect(durationOf(example())).toBe(14);
  });
});

describe('Playbook exchange', () => {
  it('round-trips player, floor and utility data while giving imports independent identities', async () => {
    const s = example();
    const file = await serializeStrategy(s);
    const copy = importStrategy(file);
    expect(copy.id).not.toBe(s.id);
    expect({ ...copy, id: s.id }).toEqual(s);
    expect(importStrategy(file).id).not.toBe(copy.id);
  });
  it.each([
    ['missing player', (s: ReturnType<typeof example>): unknown => s.players.pop()],
    ['invalid thrower', (s: ReturnType<typeof example>): unknown => (s.lineups[0].player = 5)],
    ['outside map', (s: ReturnType<typeof example>): unknown => (s.lineups[0].from = { ...start, x: -5 })],
    ['duplicate lineup', (s: ReturnType<typeof example>): unknown => s.lineups.push(s.lineups[0])],
    ['unordered route', (s: ReturnType<typeof example>): unknown => s.players[0].route.reverse()],
    ['missing starting position', (s: ReturnType<typeof example>): unknown => (s.players[0].route = [])],
    ['out-of-range timing', (s: ReturnType<typeof example>): unknown => (s.lineups[0].time = 121)],
  ] as const)('rejects %s', (_, mutate) => {
    const s = example();
    mutate(s);
    expect(() => importStrategy(JSON.stringify({ format: 'csdm-playbook', version: 1, strategy: s }))).toThrow();
  });
  it.each(['{', '{}', '{"format":"csdm-playbook","version":9}'])('rejects malformed or unknown formats', (text) =>
    expect(() => importStrategy(text)).toThrow(),
  );
  it('rejects active attachment formats', async () => {
    const doc = JSON.parse(await serializeStrategy(example()));
    doc.strategy.lineups[0].media.push({ name: 'aim.svg', type: 'image/svg+xml', data: 'YWJj' });
    expect(() => importStrategy(JSON.stringify(doc))).toThrow();
  });
});

describe('Demo lineup projection', () => {
  const map: Map = {
    id: 'nuke',
    name: 'de_nuke',
    game: Game.CS2,
    posX: -1000,
    posY: 2000,
    scale: 2,
    radarSize: 2048,
    thresholdZ: 0,
    radarFilePath: 'upper.png',
    lowerRadarFilePath: 'lower.png',
    thumbnailFilePath: undefined,
  };
  const data: GrenadeThrow = {
    id: '1',
    tick: 5420,
    roundNumber: 2,
    projectileId: '3',
    grenadeName: GrenadeName.Smoke,
    throwerSteamId: '0',
    throwerName: 'P2',
    throwerSide: TeamNumber.CT,
    throwerVelocityX: 0,
    throwerVelocityY: 0,
    throwerVelocityZ: 0,
    throwerYaw: 0,
    throwerPitch: 0,
    positions: [
      { x: 24, y: 976, z: 0 },
      { x: 1048, y: -48, z: -1 },
    ],
  };
  it('uses the first and last sample and retains the round and tick', () => {
    expect(lineupFromDemo(map, data, 'abc')).toMatchObject({
      from: { x: 250, y: 250, floor: 'upper' },
      to: { x: 500, y: 500, floor: 'lower' },
      source: { checksum: 'abc', round: 2, tick: 5420, thrower: 'P2' },
    });
  });
  it('supports single-level maps and missing samples', () => {
    expect(lineupFromDemo({ ...map, lowerRadarFilePath: undefined }, data, 'abc')?.to.floor).toBe('upper');
    expect(lineupFromDemo(map, { ...data, positions: [] }, 'abc')).toBeUndefined();
  });
});
