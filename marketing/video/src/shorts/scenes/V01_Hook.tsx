import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {Center, TypeOn, Void} from '../../lib/ui';
import {Bubble, BubbleSpec, SearchBar, TrashCan} from '../../lib/setpieces';
import {easeIn, lerp, pop, settle} from '../../lib/anim';
import {C} from '../../theme';

/**
 * V01 — the hook, compressed S1–S3: the question is already typed, hype
 * bubbles bury it, the can takes them out, the aphorism lands and HOLDS.
 */
const BAR_Y = 700;
const CAN_X = 540;

/* Hand-placed in 1080×1920 space to crowd the frame and bury the bar. */
const VBUBBLES: BubbleSpec[] = [
  {text: '🚀 100x trust me', x: 330, y: 360, rot: -6, size: 38, order: 0},
  {text: 'BUY NOW', x: 800, y: 300, rot: 5, size: 44, order: 1},
  {text: "can't miss", x: 250, y: 1060, rot: 4, size: 38, order: 2},
  {text: 'the next big thing', x: 700, y: 1210, rot: -4, size: 34, order: 3},
  {text: 'all in', x: 850, y: 950, rot: 7, size: 44, order: 4},
  {text: "I'm never wrong", x: 380, y: 1370, rot: -5, size: 34, order: 5},
  {text: 'to the moon', x: 780, y: 1500, rot: 6, size: 34, order: 6},
  {text: 'free money', x: 260, y: 520, rot: 7, size: 36, order: 7},
  {text: 'guaranteed', x: 760, y: 480, rot: -3, size: 38, order: 8},
  {text: 'no brainer', x: 320, y: 850, rot: -7, size: 40, order: 9},
  {text: 'everyone knows', x: 620, y: 1080, rot: 3, size: 38, order: 10},
  // the late wave lands ON the bar
  {text: 'YOLO', x: 400, y: 665, rot: -6, size: 46, order: 11},
  {text: 'diamond hands', x: 620, y: 705, rot: 2.5, size: 40, order: 12},
  {text: 'up only', x: 500, y: 745, rot: -5, size: 40, order: 13},
];

export const V01_Hook: React.FC = () => {
  const frame = useCurrentFrame();

  // trash can: up at f70, swallows, drops at f100
  const canUp = settle(frame, 70);
  const canDrop = lerp(frame, [100, 116], [0, 1], easeIn);
  const canY = 1960 - canUp * 420 + canDrop * 480;

  const barOp = lerp(frame, [86, 100], [1, 0]);
  const fadeAll = lerp(frame, [170, 180], [1, 0]);

  return (
    <Void depth>
      <AbsoluteFill style={{opacity: fadeAll}}>
        {/* the question, already asked */}
        <div
          style={{
            position: 'absolute',
            left: 540,
            top: BAR_Y,
            transform: 'translate(-50%, -50%) scale(0.82)',
            opacity: barOp,
          }}
        >
          <SearchBar done appear={0} />
        </div>

        {/* hype answers pile in, then pour into the can */}
        {VBUBBLES.map((b) => {
          const inDelay = 8 + b.order * 4;
          const s = pop(frame, inDelay, 11, 0.9);
          const fall = lerp(frame, [74 + b.order * 1.6, 74 + b.order * 1.6 + 26], [0, 1], easeIn);
          if (fall >= 1) return null;
          const dx = (CAN_X - b.x) * fall;
          const dy = (canY - 60 - b.y) * fall * fall;
          const spin = fall * (b.order % 2 === 0 ? 150 : -130);
          return (
            <Bubble
              key={b.text}
              spec={b}
              progress={s}
              wobblePhase={(frame / 30) * 2.1 + b.order * 1.7}
              opacity={1 - Math.pow(fall, 6)}
              extraTransform={`translate(${dx}px, ${dy}px) rotate(${spin}deg) scale(${1 - 0.72 * fall})`}
            />
          );
        })}

        <TrashCan x={CAN_X} y={canY} />

        {/* the thesis — types on and HOLDS (read time is the point) */}
        <Center>
          <TypeOn
            text={'One opinion can talk itself\ninto anything.'}
            delay={112}
            seed="v1"
            base={0.8}
            size={66}
            weight={700}
            tint={C.discovery}
          />
        </Center>
      </AbsoluteFill>
    </Void>
  );
};
