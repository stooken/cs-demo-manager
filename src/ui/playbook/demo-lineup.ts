import type { Map } from 'csdm/common/types/map';
import type { GrenadeThrow, Coordinates } from 'csdm/common/types/grenade-throw';
import { getScaledCoordinateX } from 'csdm/ui/maps/get-scaled-coordinate-x';
import { getScaledCoordinateY } from 'csdm/ui/maps/get-scaled-coordinate-y';
import { grenades, type Point, type Lineup } from './strategy';

export function lineupFromDemo(map: Map, throwData: GrenadeThrow, checksum: string): Lineup | undefined {
  const last = throwData.positions.at(-1);
  if (!last || !grenades.some((kind) => kind === throwData.grenadeName)) return;
  function project(p: Coordinates): Point {
    const clamp = (n: number) => Math.min(1000, Math.max(0, Math.round(n)));
    return {
      x: clamp(getScaledCoordinateX(map, 1000, p.x)),
      y: clamp(getScaledCoordinateY(map, 1000, p.y)),
      floor: map.lowerRadarFilePath && p.z < map.thresholdZ ? 'lower' : 'upper',
    };
  }
  return {
    id: crypto.randomUUID(),
    title: throwData.grenadeName,
    kind: throwData.grenadeName,
    from: project(throwData.positions[0]),
    to: project(last),
    player: 0,
    time: 0,
    instructions: '',
    media: [],
    source: { checksum, round: throwData.roundNumber, tick: throwData.tick, thrower: throwData.throwerName },
  };
}
