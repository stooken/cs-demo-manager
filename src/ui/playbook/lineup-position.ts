import { z } from 'zod';
import type { Map } from 'csdm/common/types/map';
import type { Coordinates } from 'csdm/common/types/grenade-throw';
import { getScaledCoordinateX } from 'csdm/ui/maps/get-scaled-coordinate-x';
import { getScaledCoordinateY } from 'csdm/ui/maps/get-scaled-coordinate-y';
import type { Point } from './strategy';

export const poseSchema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
  pitch: z.number(),
  yaw: z.number(),
  roll: z.number(),
  exact: z.boolean(),
});
export type LineupPose = z.infer<typeof poseSchema>;

export function parseGetpos(text: string): LineupPose | undefined {
  if (text.length > 4096) return;
  let result: LineupPose | undefined;
  for (const raw of text.trim().split(/\r?\n/)) {
    const line = raw.trim().replace(/^>\s*/, '').trim();
    if (!line || /^getpos(?:_exact)?$/i.test(line)) continue;
    const [position, aim, ...extra] = line.split(';').map((part) => part.trim().split(/\s+/));
    if (!aim || extra.length || position.length !== 4 || aim.length !== 4) return;
    const exact = position[0].toLowerCase() === 'setpos_exact';
    if (
      position[0].toLowerCase() !== (exact ? 'setpos_exact' : 'setpos') ||
      aim[0].toLowerCase() !== (exact ? 'setang_exact' : 'setang')
    )
      return;
    const tokens = [...position.slice(1), ...aim.slice(1)];
    if (!tokens.every((token) => /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(token))) return;
    const [x, y, z, pitch, yaw, roll] = tokens.map(Number);
    const parsed = poseSchema.safeParse({ x, y, z, pitch, yaw, roll, exact });
    if (!parsed.success) return;
    if (result && formatGetpos(parsed.data) !== formatGetpos(result)) return;
    result = parsed.data;
  }
  return result;
}

export function formatGetpos(pose: LineupPose) {
  function decimal(value: number) {
    const fixed = value.toFixed(6);
    return Number(fixed) === value ? fixed : String(value);
  }
  const suffix = pose.exact ? '_exact' : '';
  const position = [pose.x, pose.y, pose.z].map(decimal).join(' ');
  const angles = [pose.pitch, pose.yaw, pose.roll].map(decimal).join(' ');
  return `setpos${suffix} ${position};setang${suffix} ${angles}`;
}

export function projectPosition(map: Map, position: Coordinates): Point {
  return {
    x: Math.round(getScaledCoordinateX(map, 1000, position.x)),
    y: Math.round(getScaledCoordinateY(map, 1000, position.y)),
    floor: map.lowerRadarFilePath && position.z < map.thresholdZ ? 'lower' : 'upper',
  };
}
