import { z } from 'zod';

const number = z.number();
const frame = z.tuple([number, number, number, number, number]);
const position = z.tuple([number, number, number]);
const tick = z.number().int().min(0).max(7680);
const flight = z.array(z.tuple([tick, number, number, number])).max(641);
const shot = z.object({
  tick,
  weapon: z.enum(['smokegrenade', 'flashbang', 'hegrenade', 'molotov', 'incgrenade', 'decoy']),
  position,
  flight: flight.default([]),
});
const schema = z.object({
  format: z.literal('csdm-practice-take'),
  version: z.literal(1),
  name: z.string().min(1).max(64),
  map: z.string().min(1).max(128),
  side: z.enum(['T', 'CT']),
  tickrate: z.literal(64),
  frames: z.array(frame).min(1).max(7681),
  throws: z.array(shot).max(256),
});
export type PracticeTake = z.infer<typeof schema>;

export function playbackTick(start: number, elapsedMs: number, tickrate: number, end: number) {
  // A frame dispatched just after Play can carry a timestamp from before the click.
  return Math.min(end, start + Math.floor((Math.max(0, elapsedMs) * tickrate) / 1000));
}

export function parsePracticeTake(text: string) {
  const take = schema.parse(JSON.parse(text));
  for (const shot of take.throws) {
    if (
      shot.tick >= take.frames.length ||
      shot.flight.some(
        ([at], i) => at < shot.tick || at >= take.frames.length || (i > 0 && at <= shot.flight[i - 1][0]),
      )
    ) {
      throw new Error('Invalid throw timing.');
    }
  }
  return take;
}
