import { DrawingTools } from './drawing-tools';
import { drawingInterval, maxStrokes, type Stroke, type TimedDrawing, type Pen } from './drawings';
import { GetposDialog } from './getpos-dialog';
import type { LineupPose } from './lineup-position';
import { useMaps } from 'csdm/ui/maps/use-maps';
import { maxSeconds } from './timeline-limit';
import React, { useEffect, useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { Button, ButtonVariant } from 'csdm/ui/components/buttons/button';
import { ConfirmDialog } from 'csdm/ui/dialogs/confirm-dialog';
import { useDialog } from 'csdm/ui/components/dialogs/use-dialog';
import { Game, GrenadeName } from 'csdm/common/types/counter-strike';
import { useGetMapRadarSrc } from 'csdm/ui/maps/use-get-map-radar-src';
import { isSuccessResult } from 'csdm/preload/preload-result';
import { useShowToast } from 'csdm/ui/components/toasts/use-show-toast';
import { deleteStrategy, saveStrategy } from './library';
import {
  durationOf,
  placeFrame,
  positionAt,
  type Lineup,
  type Player,
  type Point,
  type Strategy,
  maxMediaBytes,
} from './strategy';
import { mediaSize, serializeStrategy } from './strategy-file';
import { StrategyBoard, playerColors } from './strategy-board';
import { Field, fieldClassName } from './fields';
import { LineupDetails } from './lineup-details';

type Props = { strategy: Strategy; library: Strategy[]; initialLineup: string | null; back: () => void };
export function StrategyEditor({ strategy, library, initialLineup, back }: Props) {
  const { t } = useLingui();
  const { showDialog } = useDialog();
  const toast = useShowToast();
  const getRadar = useGetMapRadarSrc();
  const initial = strategy.lineups.find((l) => l.id === initialLineup);
  const [tab, setTab] = useState<'players' | 'lineups' | 'drawings' | 'strategy'>(initial ? 'lineups' : 'players');
  const [player, setPlayer] = useState(initial?.player ?? 0);
  const [selectedId, select] = useState<string | undefined>(initial?.id);
  const [mode, setMode] = useState<
    'select' | 'route' | 'position' | 'throw' | 'landing' | 'move-from' | 'move-to' | Pen
  >('select');
  const [editingLineup, setEditingLineup] = useState(false);
  const [origin, setOrigin] = useState<Point>();
  const [originPose, setOriginPose] = useState<LineupPose>();
  const [coaching, setCoaching] = useState<Stroke[]>([]);
  const [color, setColor] = useState<Stroke['color']>('yellow');
  const [selectedDrawing, setSelectedDrawing] = useState<string>();
  const drawings = strategy.drawings ?? [];
  const pen = mode === 'coaching' || mode === 'timed' ? mode : undefined;
  const map = useMaps().find((m) => m.name === strategy.map && m.game === Game.CS2);
  const [floor, setFloor] = useState<Point['floor']>(initial?.from.floor ?? 'upper');
  const [time, setTime] = useState(initial?.time ?? 0);
  const [playFrom, setPlayFrom] = useState<number | null>(null);
  const playing = playFrom !== null;
  const duration = durationOf(strategy);
  const p = strategy.players[player];
  const lineup = strategy.lineups.find((l) => l.id === selectedId);
  const totalMedia = mediaSize(strategy);
  const lower = getRadar(strategy.map, Game.CS2, 'lower');
  const radar = getRadar(strategy.map, Game.CS2, floor);
  const reusable = library
    .filter((s) => s.id !== strategy.id && s.map === strategy.map)
    .flatMap((s) => s.lineups.map((l) => ({ strategy: s, lineup: l })));
  const kindNames = {
    [GrenadeName.Smoke]: t`Smoke`,
    [GrenadeName.Flashbang]: t`Flashbang`,
    [GrenadeName.HE]: t`HE grenade`,
    [GrenadeName.Molotov]: t`Molotov`,
    [GrenadeName.Decoy]: t`Decoy`,
    [GrenadeName.Incendiary]: t`Incendiary`,
  };
  useEffect(() => {
    if (playFrom === null) return;
    const started = performance.now();
    let frame: number;
    function tick(now: number) {
      const elapsed = Math.min(duration, (playFrom ?? 0) + (now - started) / 1000);
      setTime(elapsed);
      if (elapsed >= duration) setPlayFrom(null);
      else frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playFrom, duration]);
  function resetTool() {
    setMode('select');
    setOrigin(undefined);
    setOriginPose(undefined);
    setPlayFrom(null);
  }
  useEffect(() => {
    if (mode === 'select') return;
    const cancelPlacement = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOrigin(undefined);
        setOriginPose(undefined);
        setMode('select');
      }
    };
    window.addEventListener('keydown', cancelPlacement);
    return () => window.removeEventListener('keydown', cancelPlacement);
  }, [mode]);
  function openTab(next: typeof tab) {
    resetTool();
    setTab(next);
  }
  function change(values: Partial<Strategy>) {
    saveStrategy({ ...strategy, ...values });
  }
  function updatePlayer(index: number, values: Partial<Player>) {
    change({ players: strategy.players.map((item, i) => (i === index ? { ...item, ...values } : item)) });
  }
  function changeLineup(values: Partial<Lineup>) {
    change({ lineups: strategy.lineups.map((l) => (l.id === selectedId ? { ...l, ...values } : l)) });
  }
  function inspect(l: Lineup, edit = false) {
    setEditingLineup(edit);
    openTab('lineups');
    select(l.id);
    setPlayer(l.player);
    setTime(l.time);
  }
  function addLineup(l: Lineup) {
    change({ lineups: [...strategy.lineups, l] });
    inspect(l, true);
  }
  function choosePose(existing?: Lineup) {
    if (!map) return;
    resetTool();
    showDialog(
      <GetposDialog
        map={map}
        onApply={(pose, from) => {
          setFloor(from.floor);
          if (existing) {
            change({
              lineups: strategy.lineups.map((item) => (item.id === existing.id ? { ...item, pose, from } : item)),
            });
          } else {
            setOrigin(from);
            setOriginPose(pose);
            setMode('landing');
          }
        }}
      />,
    );
  }
  function selectDrawing(d: TimedDrawing) {
    resetTool();
    setSelectedDrawing(d.id);
    setFloor(d.floor);
    setTime(d.start);
  }
  function finishStroke(stroke: Stroke) {
    if (pen === 'coaching' && coaching.length < maxStrokes) {
      setCoaching([...coaching, stroke]);
      if (coaching.length + 1 === maxStrokes) setMode('select');
    } else if (pen === 'timed' && drawings.length < maxStrokes) {
      const drawing = { ...stroke, ...drawingInterval(time) };
      change({ drawings: [...drawings, drawing] });
      setTime(drawing.start);
      setSelectedDrawing(drawing.id);
      if (drawings.length + 1 === maxStrokes) setMode('select');
    }
  }
  function move(index: number, point: Point, seconds: number) {
    const at = Math.min(maxSeconds, Math.round(seconds));
    updatePlayer(index, { route: placeFrame(strategy.players[index].route, point, at) });
    setTime(at);
  }
  function place(point: Point) {
    switch (mode) {
      case 'route':
        move(player, point, Math.min(maxSeconds, p.route.at(-1)!.time + 2));
        if (p.route.at(-1)!.time >= maxSeconds - 2) resetTool();
        break;
      case 'position':
        move(player, point, time);
        resetTool();
        break;
      case 'throw':
        setOrigin(point);
        setMode('landing');
        break;
      case 'landing':
        if (origin)
          addLineup({
            id: crypto.randomUUID(),
            title: t`New lineup`,
            kind: GrenadeName.Smoke,
            from: origin,
            pose: originPose,
            to: point,
            player,
            time: Math.min(maxSeconds, Math.round(time)),
            instructions: '',
            media: [],
          });
        break;
      case 'move-from':
        changeLineup({ from: point });
        resetTool();
        break;
      case 'move-to':
        changeLineup({ to: point });
        resetTool();
        break;
    }
  }
  function confirm(title: string, body: string, callback: () => void) {
    showDialog(
      <ConfirmDialog
        blockNavigation={false}
        title={title}
        confirmButtonVariant={ButtonVariant.Danger}
        onConfirm={callback}
      >
        {body}
      </ConfirmDialog>,
    );
  }
  async function exportFile() {
    try {
      const { canceled, filePath } = await window.csdm.showSaveDialog({
        defaultPath: (strategy.title.replace(/[<>:"/\\|?*]/g, '-') || 'strategy') + '.playbook.json',
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });
      if (canceled || !filePath) return;
      const result = await window.csdm.writeJsonFile(filePath, await serializeStrategy(strategy));
      if (!isSuccessResult(result)) throw new Error('Export failed');
      toast({
        id: 'playbook-export',
        type: 'success',
        content: t`Strategy exported`,
        onClick: () => window.csdm.browseToFile(filePath),
      });
    } catch {
      toast({ id: 'playbook-export', type: 'error', content: t`Could not export this strategy.` });
    }
  }
  const help = {
    select:
      tab === 'drawings'
        ? t`Choose a pen or select a stroke to edit its timing.`
        : tab === 'lineups'
          ? t`Click a throw or landing marker to view its lineup.`
          : t`Drag a player to set their position at the current time.`,
    coaching: t`Drag on the radar to sketch. Press Esc to put the pen down.`,
    timed: t`Drag on the radar to add a timed stroke.`,
    route: t`Click each waypoint in order. Each step adds two seconds.`,
    position: t`Click the player’s position at the current time.`,
    throw: t`Click where the player stands to throw.`,
    landing: t`Click where the utility lands.`,
    'move-from': t`Click the new throwing position.`,
    'move-to': t`Click the new landing position.`,
  };
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-12 p-16">
      <header className="flex items-center gap-12">
        <Button onClick={back}>
          <Trans>All strategies</Trans>
        </Button>
        <h2 className="min-w-0 flex-1 truncate text-subtitle">{strategy.title || t`Untitled strategy`}</h2>
        <span className="text-caption text-gray-700">
          {strategy.map} · {strategy.side}
        </span>
        <Button onClick={exportFile}>
          <Trans>Export</Trans>
        </Button>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-16 overflow-y-auto md:flex-row md:overflow-hidden">
        <section className="flex aspect-square min-w-0 shrink-0 flex-col gap-8 md:aspect-auto md:flex-1">
          <div className="flex min-h-32 flex-wrap items-center gap-8 text-caption text-gray-700">
            {lower && (
              <select
                className="appearance-none rounded-4 bg-gray-200 p-4"
                aria-label={t`Map level`}
                value={floor}
                onChange={(e) => setFloor(e.target.value as Point['floor'])}
              >
                <option value="upper">{t`Upper`}</option>
                <option value="lower">{t`Lower`}</option>
              </select>
            )}
            <span className="flex-1">{playing ? t`Playing strategy` : help[mode]}</span>
            {mode !== 'select' && <Button onClick={resetTool}>{mode === 'route' || pen ? t`Done` : t`Cancel`}</Button>}
          </div>
          <StrategyBoard
            strategy={strategy}
            radar={radar}
            floor={floor}
            player={player}
            time={time}
            playing={playing}
            placing={mode !== 'select'}
            selectedLineup={selectedId}
            origin={origin}
            pen={pen}
            penColor={color}
            coaching={coaching}
            onStroke={finishStroke}
            onPlace={place}
            onPlayer={(index) => {
              setPlayer(index);
              openTab('players');
            }}
            onMove={(i, point) => move(i, point, time)}
            onLineup={(id) => {
              const l = strategy.lineups.find((item) => item.id === id);
              if (l) inspect(l);
            }}
          />
          <div className="flex items-center gap-12 rounded-8 border border-gray-300 p-12">
            <Button
              variant={ButtonVariant.Primary}
              onClick={() => {
                if (mode !== 'coaching') resetTool();
                else setPlayFrom(null);
                if (!playing) setPlayFrom(time >= duration ? 0 : time);
              }}
            >
              {playing ? t`Pause` : t`Play`}
            </Button>
            <Button
              onClick={() => {
                resetTool();
                setTime(0);
              }}
            >
              <Trans>Rewind</Trans>
            </Button>
            <input
              aria-label={t`Timeline`}
              type="range"
              min={0}
              max={Math.max(duration, time)}
              step="0.1"
              value={time}
              className="min-w-0 flex-1"
              onChange={(e) => {
                resetTool();
                setTime(Number(e.target.value));
              }}
            />
            <span className="text-caption whitespace-nowrap tabular-nums">
              {time.toFixed(1)} / {duration}s
            </span>
          </div>
        </section>
        <aside className="flex shrink-0 flex-col rounded-8 border border-gray-300 md:w-1/3 md:overflow-y-auto">
          <div className="sticky top-0 z-1 flex flex-wrap gap-4 border-b border-gray-300 bg-gray-50 p-8">
            {(
              [
                ['players', t`Players`],
                ['lineups', t`Lineups`],
                ['drawings', t`Drawings`],
                ['strategy', t`Strategy`],
              ] as const
            ).map(([value, label]) => (
              <Button
                key={value}
                variant={tab === value ? ButtonVariant.Primary : ButtonVariant.Default}
                onClick={() => openTab(value)}
              >
                {label}
              </Button>
            ))}
          </div>
          <div className="flex flex-col gap-12 p-12">
            {tab === 'players' && (
              <>
                <div className="flex flex-wrap gap-4">
                  {strategy.players.map((item, i) => (
                    <button
                      key={i}
                      title={item.name}
                      aria-label={item.name || `P${i + 1}`}
                      aria-pressed={i === player}
                      className="size-32 rounded-full border-2 border-transparent font-bold text-black aria-pressed:border-gray-900"
                      style={{ backgroundColor: playerColors[i] }}
                      onClick={() => {
                        resetTool();
                        setPlayer(i);
                        setFloor(positionAt(item.route, time).floor);
                      }}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
                <Field label={t`Player name`} value={p.name} onChange={(name) => updatePlayer(player, { name })} />
                <Field
                  label={t`Assignment`}
                  value={p.instructions}
                  multiline={true}
                  onChange={(instructions) => updatePlayer(player, { instructions })}
                />
                <h3 className="text-body-strong">
                  <Trans>Movement</Trans>
                </h3>
                <div className="flex flex-wrap gap-4">
                  <Button
                    onClick={() => {
                      resetTool();
                      setMode('position');
                    }}
                  >
                    <Trans>Set position</Trans>
                  </Button>
                  <Button
                    isDisabled={p.route.at(-1)!.time >= maxSeconds}
                    onClick={() => {
                      resetTool();
                      setMode('route');
                    }}
                  >
                    <Trans>Draw route</Trans>
                  </Button>
                  <Button
                    isDisabled={p.route.at(-1)!.time >= maxSeconds}
                    onClick={() => {
                      resetTool();
                      const last = p.route.at(-1)!;
                      move(player, last, last.time + 2);
                    }}
                  >
                    <Trans>Wait 2s</Trans>
                  </Button>
                </div>
                <div className="flex flex-col gap-4">
                  {p.route.map((frame, i) => (
                    <div
                      key={`${player}-${frame.time}`}
                      className="flex items-center gap-4 border-b border-gray-200 py-4"
                    >
                      <button
                        className="flex flex-1 items-center gap-8 text-left"
                        onClick={() => {
                          resetTool();
                          setTime(frame.time);
                          setFloor(frame.floor);
                        }}
                      >
                        <span className="font-bold">{frame.time}s</span>
                        {i === 0
                          ? t`Start`
                          : p.route[i - 1].x === frame.x &&
                              p.route[i - 1].y === frame.y &&
                              p.route[i - 1].floor === frame.floor
                            ? t`Wait`
                            : t`Waypoint`}
                      </button>
                      {i > 0 && (
                        <>
                          <input
                            type="number"
                            aria-label={t`Waypoint arrival time`}
                            title={t`Arrival time in seconds`}
                            className="w-48 rounded-4 border border-gray-400 bg-gray-50 px-4"
                            min={p.route[i - 1].time + 1}
                            max={(p.route[i + 1]?.time ?? maxSeconds + 1) - 1}
                            defaultValue={frame.time}
                            onBlur={(event) => {
                              const value = event.currentTarget.valueAsNumber;
                              if (!Number.isInteger(value) || !event.currentTarget.validity.valid) {
                                event.currentTarget.value = String(frame.time);
                                return;
                              }
                              if (value === frame.time) return;
                              resetTool();
                              updatePlayer(player, {
                                route: p.route.map((f) => (f.time === frame.time ? { ...f, time: value } : f)),
                              });
                              setTime(value);
                            }}
                          />
                          <Button
                            onClick={() => {
                              resetTool();
                              updatePlayer(player, { route: p.route.filter((f) => f.time !== frame.time) });
                              setTime(0);
                            }}
                          >
                            <Trans>Remove</Trans>
                          </Button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
            {tab === 'drawings' && (
              <DrawingTools
                pen={pen}
                color={color}
                onColor={setColor}
                coaching={coaching}
                onCoaching={setCoaching}
                drawings={drawings}
                onDrawings={(items) => change({ drawings: items })}
                selected={selectedDrawing}
                onSelect={selectDrawing}
                onPen={(next) => {
                  if (next === 'timed') setPlayFrom(null);
                  setMode(next === pen ? 'select' : next);
                }}
              />
            )}
            {tab === 'lineups' && (
              <>
                {lineup && (
                  <LineupDetails
                    key={lineup.id}
                    lineup={lineup}
                    players={strategy.players}
                    editing={editingLineup}
                    onEdit={(value) => {
                      resetTool();
                      setEditingLineup(value);
                    }}
                    totalMedia={totalMedia}
                    kindNames={kindNames}
                    changeLineup={changeLineup}
                    onGetpos={map ? () => choosePose(lineup) : undefined}
                    onPlace={(next) => {
                      resetTool();
                      setMode(next);
                    }}
                    onDelete={() =>
                      confirm(t`Delete lineup?`, lineup.title, () => {
                        change({ lineups: strategy.lineups.filter((l) => l.id !== lineup.id) });
                        select(undefined);
                        resetTool();
                      })
                    }
                  />
                )}

                <Button
                  isDisabled={strategy.lineups.length >= 256}
                  onClick={() => {
                    resetTool();
                    setMode('throw');
                  }}
                >
                  <Trans>Place lineup</Trans>
                </Button>
                <Button isDisabled={!map || strategy.lineups.length >= 256} onClick={() => choosePose()}>
                  <Trans>Place from getpos</Trans>
                </Button>
                {reusable.length > 0 && (
                  <select
                    className={fieldClassName}
                    aria-label={t`Reuse lineup`}
                    value=""
                    onChange={(e) => {
                      const item = reusable[Number(e.target.value)]?.lineup;
                      if (item)
                        addLineup({
                          ...item,
                          id: crypto.randomUUID(),
                          player,
                          time: Math.min(maxSeconds, Math.round(time)),
                        });
                    }}
                  >
                    <option value="">{t`Copy from another strategy…`}</option>
                    {reusable.map((entry, i) => (
                      <option
                        key={i}
                        value={i}
                        disabled={
                          strategy.lineups.length >= 256 ||
                          totalMedia + entry.lineup.media.reduce((sum, f) => sum + f.blob.size, 0) > maxMediaBytes
                        }
                      >
                        {entry.strategy.title} · {entry.lineup.title}
                      </option>
                    ))}
                  </select>
                )}
                {strategy.lineups.map((item) => {
                  const seconds = item.time;
                  const playerNumber = item.player + 1;
                  return (
                    <button
                      key={item.id}
                      aria-pressed={lineup?.id === item.id}
                      className="flex items-center justify-between gap-8 rounded-4 border border-gray-300 p-8 text-left aria-pressed:border-blue-500"
                      onClick={() => {
                        inspect(item);
                        setFloor(item.from.floor);
                      }}
                    >
                      <span className="truncate">{item.title || kindNames[item.kind]}</span>
                      <span className="text-caption whitespace-nowrap">
                        <Trans>
                          {seconds}s · P{playerNumber}
                        </Trans>
                      </span>
                    </button>
                  );
                })}
              </>
            )}
            {tab === 'strategy' && (
              <>
                <Field label={t`Strategy name`} value={strategy.title} onChange={(title) => change({ title })} />
                <label>
                  {t`Side`}
                  <select
                    aria-label={t`Side`}
                    className={fieldClassName}
                    value={strategy.side}
                    onChange={(e) => change({ side: e.target.value as Strategy['side'] })}
                  >
                    <option>T</option>
                    <option>CT</option>
                  </select>
                </label>
                <Field label={t`Tags`} value={strategy.tags} onChange={(tags) => change({ tags })} />
                <Field
                  label={t`Round plan`}
                  value={strategy.notes}
                  multiline={true}
                  onChange={(notes) => change({ notes })}
                />
                <Button
                  onClick={() =>
                    confirm(t`Delete strategy?`, strategy.title, () => {
                      deleteStrategy(strategy.id);
                      back();
                    })
                  }
                >
                  <Trans>Delete strategy</Trans>
                </Button>
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
