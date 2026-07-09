import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {Center, TypeOn, Void} from '../../lib/ui';
import {BigQuestion, Bubble, BubbleSpec, SearchBar, TrashCan} from '../../lib/setpieces';
import {easeIn, lerp, pop, rndIn, settle} from '../../lib/anim';
import {C} from '../../theme';

/**
 * V01 — the hook: the question POPS huge and holds (read time first), then
 * shrinks into the small pill — and the screaming starts: hype bubbles bury
 * it, the can takes them out, the aphorism lands and HOLDS.
 */
const BAR_Y = 700;
const CAN_X = 540;

/* Hand-placed in 1080×1920 space to crowd the frame and bury the bar. */
const VBUBBLES: BubbleSpec[] = [
  {text: '🚀 100x trust me', x: 330, y: 360, rot: -6, size: 43, order: 0},
  {text: 'BUY NOW', x: 800, y: 300, rot: 5, size: 49, order: 1},
  {text: "can't miss", x: 250, y: 1060, rot: 4, size: 43, order: 2},
  {text: 'the next big thing', x: 700, y: 1210, rot: -4, size: 39, order: 3},
  {text: 'all in', x: 850, y: 950, rot: 7, size: 49, order: 4},
  {text: "I'm never wrong", x: 380, y: 1370, rot: -5, size: 39, order: 5},
  {text: 'to the moon', x: 780, y: 1500, rot: 6, size: 39, order: 6},
  {text: 'free money', x: 260, y: 520, rot: 7, size: 41, order: 7},
  {text: 'guaranteed', x: 760, y: 480, rot: -3, size: 43, order: 8},
  {text: 'no brainer', x: 320, y: 850, rot: -7, size: 45, order: 9},
  {text: 'everyone knows', x: 620, y: 1080, rot: 3, size: 43, order: 10},
  // the late wave lands ON the bar
  {text: 'YOLO', x: 400, y: 665, rot: -6, size: 50, order: 11},
  {text: 'diamond hands', x: 620, y: 705, rot: 2.5, size: 45, order: 12},
  {text: 'up only', x: 500, y: 745, rot: -5, size: 45, order: 13},
  // the screaming wave — conflicting voices
  {text: "IT'S OVER", x: 250, y: 1210, rot: -5, size: 45, order: 14},
  {text: 'PUMP IT', x: 850, y: 1110, rot: 6, size: 47, order: 15},
  {text: 'obvious scam', x: 230, y: 620, rot: 4, size: 39, order: 16},
  {text: 'GET IN NOW', x: 590, y: 615, rot: -3, size: 47, order: 17},
];

export const V01_Hook: React.FC = () => {
  const frame = useCurrentFrame();

  // trash can: up at f190, swallows, drops at f220
  const canUp = settle(frame, 190);
  const canDrop = lerp(frame, [220, 236], [0, 1], easeIn);
  const canY = 1960 - canUp * 420 + canDrop * 480;

  const barOp = lerp(frame, [206, 220], [1, 0]);
  const fadeAll = lerp(frame, [290, 300], [1, 0]);

  // the room shakes as the screaming piles up
  const shakeAmp = lerp(frame, [140, 200], [0, 4.5]) * lerp(frame, [216, 232], [1, 0]);
  const jx = rndIn(`vx${frame}`, -1, 1) * shakeAmp;
  const jy = rndIn(`vy${frame}`, -1, 1) * shakeAmp * 0.7;

  return (
    <Void depth>
      <AbsoluteFill style={{opacity: fadeAll}}>
        {/* the question — HUGE first, then it shrinks into the pill */}
        <Center>
          <BigQuestion
            lines={['the next', 'trillion-dollar', 'stock?']}
            size={126}
            popAt={4}
            growOver={[24, 84]}
            shrinkOver={[88, 114]}
            target={{x: -110, y: BAR_Y - 960, scale: (41 * 0.82) / 126}}
            fadeOver={[104, 116]}
            accents={{3: C.discovery}}
          />
        </Center>

        <AbsoluteFill style={{transform: `translate(${jx}px, ${jy}px)`}}>
          {/* the pill the question collapses into */}
          <div
            style={{
              position: 'absolute',
              left: 540,
              top: BAR_Y,
              transform: 'translate(-50%, -50%) scale(0.82)',
              opacity: barOp,
            }}
          >
            <SearchBar done appear={106} />
          </div>

          {/* hype answers pile in, then pour into the can */}
          {VBUBBLES.map((b) => {
            const inDelay = 128 + b.order * 3.5;
            const s = pop(frame, inDelay, 11, 0.9);
            const fall = lerp(frame, [194 + b.order * 1.4, 194 + b.order * 1.4 + 26], [0, 1], easeIn);
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
        </AbsoluteFill>

        {/* the thesis — types on and HOLDS (read time is the point) */}
        <Center>
          <TypeOn
            text={'One opinion can talk itself\ninto anything.'}
            delay={232}
            seed="v1"
            base={0.8}
            size={70}
            weight={700}
            tint={C.discovery}
          />
        </Center>
      </AbsoluteFill>
    </Void>
  );
};
