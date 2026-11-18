import React, { useRef, useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { getGrenadeImagePath } from 'csdm/ui/shared/get-grenade-image-path';
import { Button } from 'csdm/ui/components/buttons/button';
import { positionAt, type Point, type Strategy } from './strategy';

export const playerColors = [
  'var(--cs-yellow)',
  'var(--cs-purple)',
  'var(--cs-green)',
  'var(--cs-blue)',
  'var(--cs-orange)',
];
type Props = {
  strategy: Strategy;
  radar: string | undefined;
  floor: Point['floor'];
  time: number;
  playing: boolean;
  player: number;
  selectedLineup: string | undefined;
  placing: boolean;
  origin: Point | undefined;
  onPlace: (point: Point) => void;
  onMove: (index: number, point: Point) => void;
  onPlayer: (index: number) => void;
  onLineup: (id: string) => void;
};
const fullMap = { x: 0, y: 0, size: 1000 };

export function StrategyBoard({
  strategy,
  radar,
  floor,
  time,
  playing,
  player,
  selectedLineup,
  placing,
  origin,
  onPlace,
  onMove,
  onPlayer,
  onLineup,
}: Props) {
  const { t } = useLingui();
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{ index: number; x: number; y: number } | null>(null);
  const pan = useRef<{ x: number; y: number; view: typeof fullMap } | null>(null);
  const [preview, setPreview] = useState<{ index: number; point: Point } | null>(null);
  const [view, setView] = useState(fullMap);
  function pointAt(clientX: number, clientY: number) {
    const transform = svg.current?.getScreenCTM();
    if (!transform) return;
    const p = new DOMPoint(clientX, clientY).matrixTransform(transform.inverse());
    return { x: Math.round(p.x), y: Math.round(p.y), floor };
  }
  function inBounds(point: Point | undefined): point is Point {
    return !!point && point.x >= 0 && point.x <= 1000 && point.y >= 0 && point.y <= 1000;
  }
  function zoom(factor: number, x = view.x + view.size / 2, y = view.y + view.size / 2) {
    const size = Math.max(200, Math.min(1000, view.size * factor));
    const originAt = (previous: number, anchor: number) =>
      Math.max(0, Math.min(1000 - size, anchor - ((anchor - previous) * size) / view.size));
    setView({ size, x: originAt(view.x, x), y: originAt(view.y, y) });
  }
  return (
    <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-8 bg-gray-100">
      {radar ? (
        <svg
          ref={svg}
          aria-label={t`Strategy radar`}
          className="size-full touch-none select-none"
          viewBox={`${view.x} ${view.y} ${view.size} ${view.size}`}
          onContextMenu={(event) => event.preventDefault()}
          onWheel={(event) => {
            const p = pointAt(event.clientX, event.clientY);
            if (p) zoom(event.deltaY < 0 ? 0.85 : 1 / 0.85, p.x, p.y);
          }}
          onPointerDown={(event) => {
            const point = pointAt(event.clientX, event.clientY);
            if (!inBounds(point)) return;
            if (event.button === 2 || event.button === 1) {
              event.currentTarget.setPointerCapture(event.pointerId);
              pan.current = { x: event.clientX, y: event.clientY, view };
            } else if (event.button === 0 && !playing && placing) onPlace(point);
          }}
          onPointerMove={(event) => {
            const p = pointAt(event.clientX, event.clientY);
            if (pan.current) {
              const start = pan.current;
              const scale = svg.current?.getScreenCTM()?.a ?? 1;
              const clamp = (n: number) => Math.max(0, Math.min(1000 - start.view.size, n));
              setView({
                ...start.view,
                x: clamp(start.view.x - (event.clientX - start.x) / scale),
                y: clamp(start.view.y - (event.clientY - start.y) / scale),
              });
            } else if (drag.current && inBounds(p)) setPreview({ index: drag.current.index, point: p });
          }}
          onPointerCancel={() => {
            drag.current = null;
            pan.current = null;
            setPreview(null);
          }}
          onPointerUp={(event) => {
            const p = pointAt(event.clientX, event.clientY);
            if (
              drag.current &&
              inBounds(p) &&
              Math.hypot(event.clientX - drag.current.x, event.clientY - drag.current.y) > 2
            )
              onMove(drag.current.index, p);
            drag.current = null;
            pan.current = null;
            setPreview(null);
          }}
        >
          <image href={radar} width="1000" height="1000" />
          {strategy.players.map((p, i) =>
            p.route.slice(1).map((frame, k) => {
              const prev = p.route[k];
              if (prev.floor !== floor || frame.floor !== floor) return null;
              return (
                <g
                  key={`${i}-${frame.time}`}
                  pointerEvents="none"
                  stroke={playerColors[i]}
                  opacity={i === player ? 1 : 0.55}
                >
                  <line x1={prev.x} y1={prev.y} x2={frame.x} y2={frame.y} strokeWidth="4" />
                  <circle cx={frame.x} cy={frame.y} r="5" fill="black" />
                </g>
              );
            }),
          )}
          {strategy.lineups.map((lineup) => {
            const active = playing && time >= lineup.time && time <= lineup.time + 2;
            if (playing && !active) return null;
            const travel = Math.min(1, Math.max(0, (time - lineup.time) / 0.75));
            const color = active || lineup.id === selectedLineup ? '#ffdc73' : 'white';
            return (
              <g
                key={lineup.id}
                stroke={color}
                fill="none"
                strokeWidth="4"
                onPointerDown={(event) => {
                  if (event.button !== 0 || placing || playing) return;
                  event.stopPropagation();
                  onLineup(lineup.id);
                }}
              >
                <title>{lineup.title}</title>
                {lineup.from.floor === floor && lineup.to.floor === floor && (
                  <line x1={lineup.from.x} y1={lineup.from.y} x2={lineup.to.x} y2={lineup.to.y} strokeDasharray="8 7" />
                )}
                {lineup.from.floor === floor && <circle cx={lineup.from.x} cy={lineup.from.y} r="12" fill="black" />}
                {active && travel < 1 && lineup.from.floor === floor && lineup.to.floor === floor && (
                  <circle
                    cx={lineup.from.x + (lineup.to.x - lineup.from.x) * travel}
                    cy={lineup.from.y + (lineup.to.y - lineup.from.y) * travel}
                    r="8"
                    fill="white"
                  />
                )}
                {lineup.to.floor === floor && (
                  <g transform={`translate(${lineup.to.x} ${lineup.to.y})`}>
                    <circle r={active ? 23 : 16} fill="black" />
                    <image href={`file://${getGrenadeImagePath(lineup.kind)}`} x="-12" y="-12" width="24" height="24" />
                  </g>
                )}
              </g>
            );
          })}
          {strategy.players.map((p, i) => {
            const point = preview?.index === i ? preview.point : positionAt(p.route, time);
            if (point.floor !== floor) return null;
            return (
              <g
                key={i}
                transform={`translate(${point.x} ${point.y})`}
                onPointerDown={(event) => {
                  if (event.button !== 0 || placing || playing) return;
                  event.stopPropagation();
                  onPlayer(i);
                  svg.current?.setPointerCapture(event.pointerId);
                  drag.current = { index: i, x: event.clientX, y: event.clientY };
                }}
              >
                <title>{p.name}</title>
                <circle r="16" fill={playerColors[i]} stroke={i === player ? 'white' : 'black'} strokeWidth="3" />
                <text textAnchor="middle" dominantBaseline="central" fontSize="20" fontWeight="700" fill="black">
                  {i + 1}
                </text>
              </g>
            );
          })}
          {origin?.floor === floor && (
            <circle cx={origin.x} cy={origin.y} r="10" fill="none" stroke="white" strokeWidth="4" />
          )}
        </svg>
      ) : (
        <p>
          <Trans>Radar unavailable. Check this map in Settings.</Trans>
        </p>
      )}
      <div className="absolute right-8 bottom-8 flex gap-4" title={t`Scroll to zoom. Right-drag to pan.`}>
        <Button onClick={() => zoom(1.25)}>−</Button>
        <Button onClick={() => setView(fullMap)}>
          <Trans>Fit</Trans>
        </Button>
        <Button onClick={() => zoom(0.8)}>+</Button>
      </div>
    </div>
  );
}
