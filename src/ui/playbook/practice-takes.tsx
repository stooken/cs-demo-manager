import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { Game } from 'csdm/common/types/counter-strike';
import { Button } from 'csdm/ui/components/buttons/button';
import { useGetMapRadarSrc } from 'csdm/ui/maps/use-get-map-radar-src';
import { useMaps } from 'csdm/ui/maps/use-maps';
import { projectPosition } from './lineup-position';
import { parsePracticeTake, playbackTick, type PracticeTake } from './practice-take';

function TakeRadar({ take }: { take: PracticeTake }) {
  const { t } = useLingui();
  const getRadar = useGetMapRadarSrc();
  const map = useMaps().find((m) => m.name === take.map && m.game === Game.CS2);
  const [tick, setTick] = useState(0);
  const [start, setStart] = useState<number | null>(null);
  const end = take.frames.length - 1;
  useEffect(() => {
    if (start === null) return;
    const started = performance.now();
    let frame: number;
    const step = (now: number) => {
      const next = playbackTick(start, now - started, take.tickrate, end);
      setTick(next);
      if (next === end) setStart(null);
      else frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [start, end, take.tickrate]);
  const route = useMemo(() => map && take.frames.map(([x, y, z]) => projectPosition(map, { x, y, z })), [map, take]);
  const point = route?.[tick];
  const [, , , pitch, yaw] = take.frames[tick];
  const radar = point && getRadar(take.map, Game.CS2, point.floor);
  const names = {
    smokegrenade: t`Smoke`,
    flashbang: t`Flashbang`,
    hegrenade: t`HE grenade`,
    molotov: t`Molotov`,
    incgrenade: t`Incendiary`,
    decoy: t`Decoy`,
  };
  function seek(value: number) {
    setStart(null);
    setTick(value);
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-8">
      <div className="flex items-center gap-8">
        <h2 className="text-subtitle">{take.name}</h2>
        <span>
          {take.map} · {take.side}
        </span>
      </div>
      {map && point && radar && route ? (
        <svg
          aria-label={t`Practice take radar`}
          viewBox="0 0 1000 1000"
          className="min-h-0 w-full flex-1 rounded-8 bg-gray-100"
        >
          <image href={radar} width="1000" height="1000" />
          <path
            d={route
              .slice(Math.max(0, tick - 64), tick + 1)
              .map((p, i, a) =>
                p.floor === point.floor ? `${i === 0 || a[i - 1].floor !== p.floor ? 'M' : 'L'}${p.x} ${p.y}` : '',
              )
              .join(' ')}
            fill="none"
            stroke="#f1c950"
            strokeWidth="3"
          />
          {take.throws.map((shot, i) => {
            if (shot.tick > tick) return null;
            const [x, y, z] = shot.position;
            const release = projectPosition(map, { x, y, z });
            const visible = shot.flight
              .filter(([at]) => at <= tick)
              .map(([, x, y, z]) => projectPosition(map, { x, y, z }));
            const tip = visible.at(-1);
            return (
              <g key={i} aria-label={names[shot.weapon]}>
                {release.floor === point.floor && (
                  <circle cx={release.x} cy={release.y} r="8" stroke="white" strokeWidth="2" fill="#3d93c9">
                    <title>{names[shot.weapon]}</title>
                  </circle>
                )}
                <path
                  d={visible
                    .map((p, j, a) =>
                      p.floor === point.floor
                        ? `${j === 0 || a[j - 1].floor !== p.floor ? 'M' : 'L'}${p.x} ${p.y}`
                        : '',
                    )
                    .join(' ')}
                  fill="none"
                  stroke="#80d8ff"
                  strokeWidth="3"
                />
                {tip?.floor === point.floor && <circle cx={tip.x} cy={tip.y} r="5" fill="#80d8ff" />}
              </g>
            );
          })}
          <g transform={`translate(${point.x} ${point.y}) rotate(${-yaw})`} aria-label={t`Recorded player`}>
            <path d="M 36 0 L 6 -10 L 6 10 Z" fill="#ffdb5b" />
            <circle r="9" fill="#ffdb5b" stroke="#191919" strokeWidth="3" />
          </g>
        </svg>
      ) : (
        <p className="p-16">{t`Add this map’s CS2 radar in map settings to see the route.`}</p>
      )}
      <div className="flex flex-wrap items-center gap-8">
        <Button onClick={() => (start === null ? setStart(tick >= end ? 0 : tick) : setStart(null))}>
          {start === null ? t`Play` : t`Pause`}
        </Button>
        <input
          aria-label={t`Take timeline`}
          className="flex-1"
          type="range"
          min="0"
          max={end}
          value={tick}
          onChange={(e) => seek(Number(e.target.value))}
        />
        <span>
          {(tick / take.tickrate).toFixed(2)} / {(end / take.tickrate).toFixed(2)} s
        </span>
        <span>
          {t`Pitch`} {pitch.toFixed(1)}° · {t`Yaw`} {yaw.toFixed(1)}°
        </span>
      </div>
      {take.throws.length > 0 && (
        <div className="flex flex-wrap gap-8">
          {take.throws.map((s, i) => (
            <Button key={i} onClick={() => seek(s.tick)}>
              {names[s.weapon]} · {(s.tick / take.tickrate).toFixed(2)} s
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

export function PracticeTakes({ back }: { back: () => void }) {
  const { t } = useLingui();
  const [files, setFiles] = useState<string[]>([]);
  const [opened, setOpened] = useState<{ id: number; take: PracticeTake }>();
  const take = opened?.take;
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const sequence = useRef(0);
  const refresh = useCallback(() => {
    void window.csdm.listPracticeTakes().then(setFiles, () => setError(t`Could not read the practice folder.`));
  }, [t]);
  useEffect(() => {
    refresh();
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [refresh]);
  async function open(read: () => Promise<string>) {
    const id = ++sequence.current;
    try {
      const data = parsePracticeTake(await read());
      if (id === sequence.current) {
        setOpened({ id, take: data });
        setError('');
      }
    } catch {
      if (id === sequence.current) setError(t`Choose a valid Playbook .take.json file under 32 MiB.`);
    }
  }
  return (
    <section className="flex min-h-0 flex-1 flex-col gap-12 p-16">
      <div className="flex flex-wrap items-center gap-8">
        <Button
          onClick={
            take
              ? () => {
                  sequence.current++;
                  setOpened(undefined);
                  setError('');
                  refresh();
                }
              : back
          }
        >
          {take ? t`All practice takes` : t`Back to strategies`}
        </Button>
        <Button onClick={() => input.current?.click()}>{t`Open take file`}</Button>
        {!take && <Button onClick={refresh}>{t`Refresh`}</Button>}
        <input
          ref={input}
          type="file"
          hidden={true}
          accept=".json"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f)
              void open(() => (f.size <= 32 * 1024 * 1024 ? f.text() : Promise.reject(new Error('File too large'))));
          }}
        />
      </div>
      {error && (
        <p role="alert" className="text-red-500">
          {error}
        </p>
      )}
      {take ? (
        <TakeRadar key={opened?.id} take={take} />
      ) : (
        <>
          <h2 className="text-subtitle">
            <Trans>Practice takes</Trans>
          </h2>
          <p>
            <Trans>
              In practice chat, use .record followed by a name, then .stoprecord to save your take. Use .play to replay
              it on a bot.
            </Trans>
          </p>
          <div className="flex flex-col items-start gap-8 overflow-y-auto">
            {files.map((name) => (
              <Button key={name} onClick={() => void open(() => window.csdm.readPracticeTake(name))}>
                {name.slice(0, -10)}
              </Button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
