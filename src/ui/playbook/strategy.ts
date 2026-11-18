import { z } from 'zod';
import { GrenadeName } from 'csdm/common/types/counter-strike';

export const maxSeconds = 120;
export const mediaTypes = ['image/png', 'image/jpeg', 'image/webp', 'video/mp4', 'video/webm'] as const;
export const maxMediaBytes = 32 * 1024 * 1024;
export const grenades = [
  GrenadeName.Smoke,
  GrenadeName.Flashbang,
  GrenadeName.HE,
  GrenadeName.Molotov,
  GrenadeName.Incendiary,
  GrenadeName.Decoy,
] as const;
const timeSchema = z.number().int().min(0).max(maxSeconds);
const coordinate = z.number().min(0).max(1000);
const pointSchema = z.object({ x: coordinate, y: coordinate, floor: z.enum(['upper', 'lower']) });
const frameSchema = pointSchema.extend({ time: timeSchema });
const routeSchema = z
  .array(frameSchema)
  .min(1)
  .max(maxSeconds + 1)
  .refine((frames) => frames[0]?.time === 0 && frames.every((frame, i) => i === 0 || frame.time > frames[i - 1].time));
const note = z.string().max(16000);
const name = z.string().max(160);
export const lineupSchema = z.object({
  id: z.uuid(),
  title: name,
  kind: z.enum(grenades),
  from: pointSchema,
  to: pointSchema,
  player: z.number().int().min(0).max(4),
  time: timeSchema,
  instructions: note,
  source: z
    .object({
      checksum: z.string().max(128),
      round: z.number().int().min(0),
      tick: z.number().int().min(0),
      thrower: name,
    })
    .optional(),
  media: z.array(z.object({ name: z.string().max(255), blob: z.instanceof(Blob) })).max(8),
});
export const strategySchema = z.object({
  id: z.uuid(),
  title: name,
  map: name.min(1),
  side: z.enum(['T', 'CT']),
  tags: name,
  notes: note,
  players: z.array(z.object({ name, instructions: note, route: routeSchema })).length(5),
  lineups: z
    .array(lineupSchema)
    .max(256)
    .refine((items) => new Set(items.map((item) => item.id)).size === items.length),
});
export type Strategy = z.infer<typeof strategySchema>;
export type Lineup = z.infer<typeof lineupSchema>;
export type Point = z.infer<typeof pointSchema>;
export type Frame = z.infer<typeof frameSchema>;
export type Player = Strategy['players'][number];

export function newStrategy(title: string, map: string, side: Strategy['side']): Strategy {
  return {
    id: crypto.randomUUID(),
    title,
    map,
    side,
    tags: '',
    notes: '',
    lineups: [],
    players: Array.from({ length: 5 }, (_, index) => ({
      name: `P${index + 1}`,
      instructions: '',
      route: [{ time: 0, x: 400 + index * 50, y: 500, floor: 'upper' }],
    })),
  };
}

export function placeFrame(route: Frame[], point: Point, seconds: number): Frame[] {
  const time = Math.min(maxSeconds, Math.max(0, Math.round(seconds)));
  return [...route.filter((frame) => frame.time !== time), { ...point, time }].sort((a, b) => a.time - b.time);
}

export function positionAt(route: Frame[], time: number): Point {
  const nextIndex = route.findIndex((frame) => frame.time > time);
  if (nextIndex < 0) return route.at(-1)!;
  if (nextIndex === 0) return route[0];
  const start = route[nextIndex - 1];
  const end = route[nextIndex];
  const fraction = (time - start.time) / (end.time - start.time);
  return { x: start.x + (end.x - start.x) * fraction, y: start.y + (end.y - start.y) * fraction, floor: start.floor };
}

export function durationOf(strategy: Strategy) {
  return Math.max(5, ...strategy.players.map((p) => p.route.at(-1)!.time), ...strategy.lineups.map((l) => l.time + 2));
}
