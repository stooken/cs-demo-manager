import { z } from 'zod';
import { lineupSchema, strategySchema, mediaTypes, maxMediaBytes, type Strategy } from './strategy';

const mediaSchema = z.object({
  name: z.string().max(255),
  type: z.enum(mediaTypes),
  data: z.string().max(Math.ceil(maxMediaBytes / 3) * 4),
});
const portableLineup = lineupSchema.extend({ media: z.array(mediaSchema).max(8) });
const fileSchema = z.object({
  format: z.literal('csdm-playbook'),
  version: z.union([z.literal(1), z.literal(2)]),
  strategy: strategySchema.extend({ lineups: z.array(portableLineup).max(256) }),
});

export function mediaSize(strategy: Strategy) {
  return strategy.lineups.reduce(
    (total, lineup) => total + lineup.media.reduce((size, item) => size + item.blob.size, 0),
    0,
  );
}

export async function serializeStrategy(strategy: Strategy) {
  const lineups = await Promise.all(
    strategy.lineups.map(async (lineup) => ({
      ...lineup,
      media: await Promise.all(
        lineup.media.map(async ({ name, blob }) => ({
          name,
          type: blob.type,
          data: new Uint8Array(await blob.arrayBuffer()).toBase64(),
        })),
      ),
    })),
  );
  const version = strategy.drawings?.length || lineups.some((l) => l.pose) ? 2 : 1;
  return JSON.stringify({ format: 'csdm-playbook', version, strategy: { ...strategy, lineups } });
}

export function importStrategy(text: string): Strategy {
  const { strategy } = fileSchema.parse(JSON.parse(text));
  let total = 0;
  const lineups = strategy.lineups.map((lineup) => ({
    ...lineup,
    media: lineup.media.map(({ name, type, data }) => {
      const bytes = Uint8Array.fromBase64(data, { lastChunkHandling: 'strict' });
      total += bytes.length;
      if (total > maxMediaBytes) throw new Error('Attachment limit exceeded');
      return { name, blob: new Blob([bytes], { type }) };
    }),
  }));
  return strategySchema.parse({ ...strategy, lineups, id: crypto.randomUUID() });
}
