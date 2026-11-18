import React, { useRef, useState } from 'react';
import { maxVertices, penColors, type Stroke } from './drawings';

type Vertex = Stroke['points'][number];

function Ink({ points, color }: Pick<Stroke, 'points' | 'color'>) {
  const first = points[0];
  if (points.length === 1) return <circle cx={first.x} cy={first.y} r="3" fill={penColors[color]} />;
  return (
    <polyline
      points={points.map((p) => `${p.x},${p.y}`).join(' ')}
      fill="none"
      stroke={penColors[color]}
      strokeWidth="6"
      strokeLinejoin="round"
      strokeLinecap="round"
    />
  );
}

type PenProps = {
  color: Stroke['color'];
  floor: Stroke['floor'];
  onStroke: (stroke: Stroke) => void;
  pointAt: (x: number, y: number) => Vertex | undefined;
};

function DrawingSurface({ color, floor, onStroke, pointAt }: PenProps) {
  const active = useRef<{ pointerId: number; points: Vertex[] } | null>(null);
  const [preview, setPreview] = useState<Vertex[]>([]);
  function sample(event: React.PointerEvent<SVGRectElement>) {
    const stroke = active.current;
    const point = pointAt(event.clientX, event.clientY);
    if (!point || !stroke || stroke.pointerId !== event.pointerId) return;
    const vertex = { x: Math.min(1000, Math.max(0, point.x)), y: Math.min(1000, Math.max(0, point.y)) };
    const last = stroke.points.at(-1);
    if (last && last.x === vertex.x && last.y === vertex.y) return;
    if (stroke.points.length >= maxVertices) stroke.points = stroke.points.filter((_, i) => i % 2 === 0);
    stroke.points = [...stroke.points, vertex];
    setPreview(stroke.points);
  }
  function cancel() {
    active.current = null;
    setPreview([]);
  }
  return (
    <>
      {preview.length > 0 && (
        <g pointerEvents="none">
          <Ink color={color} points={preview} />
        </g>
      )}
      <rect
        width="1000"
        height="1000"
        fill="transparent"
        className="cursor-crosshair"
        onPointerDown={(e) => {
          if (e.button !== 0 || active.current) return;
          e.stopPropagation();
          e.currentTarget.setPointerCapture(e.pointerId);
          active.current = { pointerId: e.pointerId, points: [] };
          sample(e);
        }}
        onPointerMove={sample}
        onPointerUp={(e) => {
          if (e.pointerId !== active.current?.pointerId) return;
          sample(e);
          const points = active.current.points;
          cancel();
          if (points.length) onStroke({ id: crypto.randomUUID(), floor, color, points });
        }}
        onLostPointerCapture={(e) => {
          if (e.pointerId === active.current?.pointerId) cancel();
        }}
        onPointerCancel={(e) => {
          if (e.pointerId === active.current?.pointerId) cancel();
        }}
      />
    </>
  );
}

export function DrawingLayer({
  timed,
  coaching,
  pen,
  ...surface
}: PenProps & {
  timed: Stroke[];
  coaching: Stroke[];
  pen: 'coaching' | 'timed' | undefined;
}) {
  return (
    <>
      <g pointerEvents="none" data-layer="timed">
        {timed.map((stroke) => (
          <Ink key={stroke.id} {...stroke} />
        ))}
      </g>
      <g pointerEvents="none" data-layer="coaching">
        {coaching.map((stroke) => (
          <Ink key={stroke.id} {...stroke} />
        ))}
      </g>
      {pen && <DrawingSurface key={`${pen}-${surface.floor}`} {...surface} />}
    </>
  );
}
