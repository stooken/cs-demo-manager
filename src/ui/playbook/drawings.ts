import { maxSeconds } from './timeline-limit';
import { z } from 'zod';
export const penColors = { yellow: '#ffdc73', blue: '#64caff', red: '#ff7777', white: '#ffffff' } as const;
export const maxStrokes = 128;
export const maxVertices = 512;
const vertexSchema = z.object({ x: z.number().int().min(0).max(1000), y: z.number().int().min(0).max(1000) });
const strokeSchema = z.object({
  id: z.uuid(),
  floor: z.enum(['upper', 'lower']),
  color: z.enum(['yellow', 'blue', 'red', 'white']),
  points: z.array(vertexSchema).min(1).max(maxVertices),
});

export const timedDrawingSchema = strokeSchema
  .extend({
    start: z.number().min(0).max(maxSeconds),
    end: z.number().min(0).max(maxSeconds),
  })
  .refine((drawing) => drawing.end > drawing.start);
export type Stroke = z.infer<typeof strokeSchema>;
export type TimedDrawing = z.infer<typeof timedDrawingSchema>;
export type Pen = 'coaching' | 'timed';

export function visibleAt(drawing: TimedDrawing, time: number) {
  return drawing.start <= time && time < drawing.end;
}

export function drawingInterval(seconds: number) {
  const start = Math.max(0, Math.min(maxSeconds - 0.1, Math.round(seconds * 10) / 10));
  return { start, end: Math.min(maxSeconds, start + 5) };
}
