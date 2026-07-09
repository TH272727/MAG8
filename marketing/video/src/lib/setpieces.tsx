import React from 'react';
import {C, F} from '../theme';
import {Kinetic, TypeOn} from './ui';
import {blink, easeInOut, lerp} from './anim';
import {useCurrentFrame} from 'remotion';

export const QUERY = 'the next trillion-dollar stock?';

/**
 * The oversized opening question: words pop in huge, the block looms while
 * the viewer reads, then it shrinks down and hands off to the search pill
 * (crossfade under motion+blur — the pill's `done` text takes over).
 * Frame keys are scene-local so master and portrait pace it independently.
 */
export const BigQuestion: React.FC<{
  lines: string[]; // QUERY re-broken for this stage
  size: number;
  popAt?: number;
  growOver: [number, number]; // slow loom while it holds
  shrinkOver: [number, number]; // collapse toward the pill text
  target: {x: number; y: number; scale: number}; // landing offset + end scale
  fadeOver: [number, number]; // crossfade out while the pill fades in
  accents?: Record<number, string>;
}> = ({lines, size, popAt = 6, growOver, shrinkOver, target, fadeOver, accents}) => {
  const frame = useCurrentFrame();
  const grow = lerp(frame, growOver, [1, 1.045]);
  const t = lerp(frame, shrinkOver, [0, 1], easeInOut);
  const scale = grow * (1 - t) + target.scale * t;
  const op = lerp(frame, fadeOver, [1, 0]);
  if (op <= 0) return null;
  return (
    <div
      style={{
        transform: `translate(${target.x * t}px, ${target.y * t}px) scale(${scale})`,
        filter: t > 0 ? `blur(${t * 7}px)` : undefined,
        opacity: op,
      }}
    >
      <Kinetic
        text={lines.join('\n')}
        delay={popAt}
        size={size}
        weight={700}
        stagger={4}
        lineHeight={1.08}
        accents={accents}
      />
    </div>
  );
};

/**
 * The oversized pill search bar. `typeDelay` starts the typewriter; pass
 * `done` to render it fully typed (S2 continuity) with an idle cursor.
 */
export const SearchBar: React.FC<{
  typeDelay?: number;
  done?: boolean;
  appear?: number;
}> = ({typeDelay = 40, done = false, appear = 0}) => {
  const frame = useCurrentFrame();
  const inOp = lerp(frame, [appear, appear + 16], [0, 1]);
  const inScale = lerp(frame, [appear, appear + 22], [0.975, 1]);
  const placeholderOp = done ? 0 : lerp(frame, [typeDelay - 4, typeDelay + 4], [0.75, 0]);
  return (
    <div
      style={{
        width: 1020,
        height: 100,
        borderRadius: 999,
        background: C.panel,
        border: `1.5px solid ${C.hairline}`,
        boxShadow:
          'inset 0 1px 0 rgba(255,255,255,0.04), 0 24px 80px rgba(0,0,0,0.55), 0 4px 18px rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        paddingLeft: 46,
        paddingRight: 40,
        position: 'relative',
        opacity: inOp,
        transform: `scale(${inScale})`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 46,
          fontFamily: F.body,
          fontSize: 41,
          fontWeight: 500,
          color: C.muted,
          opacity: placeholderOp,
        }}
      >
        Search for...
      </div>
      {done ? (
        <div style={{fontFamily: F.body, fontSize: 41, fontWeight: 500, color: C.ink}}>
          {QUERY}
          <span
            style={{
              display: 'inline-block',
              width: 3.5,
              height: 45,
              marginLeft: 3,
              borderRadius: 2,
              background: C.ink,
              verticalAlign: 'text-bottom',
              opacity: blink(frame) ? 0.95 : 0,
            }}
          />
        </div>
      ) : (
        <TypeOn
          text={QUERY}
          delay={typeDelay}
          seed="s1-query"
          base={2.0}
          size={41}
          font="body"
          weight={500}
          color={C.ink}
          tint={C.discovery}
          align="left"
        />
      )}
    </div>
  );
};

export type BubbleSpec = {
  text: string;
  x: number; // center, 1920 space
  y: number; // center, 1080 space
  rot: number;
  size: number;
  order: number;
};

/* Hand-placed to bury the centered search bar by the end of S2. */
export const BUBBLES: BubbleSpec[] = [
  {text: '🚀 100x trust me', x: 560, y: 300, rot: -6, size: 45, order: 0},
  {text: 'BUY NOW', x: 1360, y: 250, rot: 5, size: 50, order: 1},
  {text: "can't miss", x: 330, y: 640, rot: 4, size: 43, order: 2},
  {text: 'the next big thing', x: 1520, y: 620, rot: -4, size: 41, order: 3},
  {text: 'all in', x: 1120, y: 810, rot: 7, size: 49, order: 4},
  {text: "I'm never wrong", x: 620, y: 900, rot: -5, size: 41, order: 5},
  {text: 'to the moon', x: 1660, y: 900, rot: 6, size: 39, order: 6},
  {text: 'trust me bro', x: 260, y: 140, rot: -8, size: 39, order: 7},
  {text: 'free money', x: 1700, y: 130, rot: 7, size: 41, order: 8},
  {text: 'guaranteed', x: 900, y: 130, rot: -3, size: 43, order: 9},
  {text: 'no brainer', x: 1300, y: 460, rot: -7, size: 45, order: 10},
  {text: 'everyone knows', x: 660, y: 500, rot: 3, size: 47, order: 11},
  // the late wave lands ON the search bar and buries it
  {text: 'overbought? never', x: 850, y: 545, rot: -4, size: 41, order: 12},
  {text: "this time it's different", x: 1210, y: 560, rot: 5, size: 39, order: 13},
  {text: 'YOLO', x: 640, y: 585, rot: -6, size: 50, order: 14},
  {text: 'moon math', x: 1450, y: 760, rot: 6, size: 41, order: 15},
  {text: 'up only', x: 480, y: 770, rot: -5, size: 45, order: 16},
  {text: 'diamond hands', x: 985, y: 540, rot: 2.5, size: 47, order: 17},
  // the screaming wave — conflicting voices shouting past each other
  {text: 'SELL EVERYTHING', x: 430, y: 420, rot: -5, size: 45, order: 18},
  {text: "it's over", x: 1180, y: 330, rot: 4, size: 41, order: 19},
  {text: 'PUMP IT', x: 1580, y: 470, rot: -6, size: 49, order: 20},
  {text: '10x by Friday', x: 250, y: 940, rot: 5, size: 41, order: 21},
  {text: "you're all wrong", x: 1520, y: 1000, rot: -4, size: 41, order: 22},
  {text: 'obvious scam', x: 830, y: 950, rot: 6, size: 43, order: 23},
  {text: 'GET IN NOW', x: 1090, y: 665, rot: -3, size: 49, order: 24},
  {text: 'told you so', x: 380, y: 235, rot: 7, size: 39, order: 25},
];

export const Bubble: React.FC<{
  spec: BubbleSpec;
  progress: number; // 0..1 spring-in
  wobblePhase: number;
  extraTransform?: string;
  opacity?: number;
  trail?: boolean;
}> = ({spec, progress, wobblePhase, extraTransform = '', opacity = 1}) => {
  const wob = Math.sin(wobblePhase) * 1.6;
  return (
    <div
      style={{
        position: 'absolute',
        left: spec.x,
        top: spec.y,
        transform: `translate(-50%, -50%) ${extraTransform} rotate(${spec.rot + wob}deg) scale(${0.5 + 0.5 * progress})`,
        opacity: Math.min(progress * 1.6, 1) * opacity,
        background: '#161b27',
        border: `1.5px solid ${C.hairline2}`,
        borderRadius: 999,
        padding: `${spec.size * 0.62}px ${spec.size * 1.05}px`,
        fontFamily: F.body,
        fontSize: spec.size,
        fontWeight: 600,
        color: C.ink,
        whiteSpace: 'nowrap',
        boxShadow: '0 18px 50px rgba(0,0,0,0.45)',
      }}
    >
      {spec.text}
    </div>
  );
};

/** Matte minimal trash can, drawn as SVG. Anchored at its top-center. */
export const TrashCan: React.FC<{x: number; y: number; scale?: number}> = ({
  x,
  y,
  scale = 1,
}) => (
  <svg
    width={260}
    height={300}
    viewBox="0 0 260 300"
    style={{
      position: 'absolute',
      left: x - 130 * scale,
      top: y,
      transform: `scale(${scale})`,
      transformOrigin: 'top center',
    }}
  >
    {/* lid */}
    <rect x={30} y={26} width={200} height={22} rx={11} fill="#171b24" stroke="#2b3245" strokeWidth={2} />
    <rect x={104} y={10} width={52} height={16} rx={8} fill="#171b24" stroke="#2b3245" strokeWidth={2} />
    {/* body */}
    <path
      d="M 46 60 L 62 282 Q 63.5 294 76 294 L 184 294 Q 196.5 294 198 282 L 214 60 Z"
      fill="#141821"
      stroke="#2b3245"
      strokeWidth={2}
    />
    {/* ribs */}
    {[92, 130, 168].map((rx) => (
      <line key={rx} x1={rx} y1={84} x2={rx + (130 - rx) * 0.12} y2={266} stroke="#232938" strokeWidth={3} strokeLinecap="round" />
    ))}
  </svg>
);
