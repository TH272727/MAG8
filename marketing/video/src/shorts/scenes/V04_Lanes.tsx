import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {Chip, Kinetic, Void} from '../../lib/ui';
import {easeInOut, easeOut, lerp, pop} from '../../lib/anim';
import {C, F} from '../../theme';
import {VBLOCKS, VCHOSEN_IDS, vThreadPath} from '../vscout';
import {LENS, useShort} from '../vlib';
import {VH, VW} from '../timeline';
import type {ShortId} from '../timeline';

/**
 * V04 — blind lanes, portrait: three sealed horizontal rooms stacked down
 * the frame. Ends by picking THIS short's lens: its room glows, the others
 * dim — the handoff into the deep-dive chapter.
 */
const ROOMS: Array<{cy: number; short: ShortId}> = [
  {cy: 640, short: 'fundamentals'},
  {cy: 1010, short: 'macro'},
  {cy: 1380, short: 'consensus'},
];
const ROOM_TOP = (cy: number) => cy - 165;
const CHIP_START = {x: 540, y: 990};
const FOCUS_AT = 118;

const CandidateChip: React.FC<{opacity?: number; glow?: number}> = ({opacity = 1, glow = 1}) => (
  <div
    style={{
      width: 186,
      height: 62,
      borderRadius: 12,
      background: C.panel,
      border: '1.5px solid rgba(139,124,255,0.65)',
      boxShadow: `0 0 ${22 * glow}px rgba(139,124,255,0.35), 0 14px 40px rgba(0,0,0,0.5)`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      opacity,
    }}
  >
    {[22, 15, 19, 12, 17].map((w, i) => (
      <div
        key={i}
        style={{width: w, height: 17, borderRadius: 4, background: 'rgba(231,234,238,0.82)', boxShadow: '0 0 8px rgba(231,234,238,0.45)'}}
      />
    ))}
  </div>
);

export const V04_Lanes: React.FC = () => {
  const frame = useCurrentFrame();
  const short = useShort();
  const fieldFade = lerp(frame, [0, 14], [0.4, 0]);
  const converge = lerp(frame, [4, 26], [0, 1], easeInOut);
  const chipIn = pop(frame, 20, 13, 0.8);
  const splitT = lerp(frame, [36, 58], [0, 1], easeInOut);
  const centerChipOp = splitT > 0 ? Math.max(1 - splitT * 2.2, 0) : chipIn;
  const focusT = lerp(frame, [FOCUS_AT, FOCUS_AT + 16], [0, 1]);

  return (
    <Void>
      {/* residual field + thread fading out (V03 continuity) */}
      <AbsoluteFill style={{opacity: fieldFade}}>
        {VBLOCKS.filter((b) => !VCHOSEN_IDS.includes(b.id)).map((b) => (
          <div
            key={b.id}
            style={{
              position: 'absolute',
              left: b.x - 9,
              top: b.y - 9,
              width: 18,
              height: 18,
              borderRadius: 4.5,
              background: '#1a2030',
              border: '1.5px solid rgba(64,74,100,0.6)',
              opacity: 0.55 + b.jitter * 0.45,
            }}
          />
        ))}
        <svg width={VW} height={VH} style={{position: 'absolute', inset: 0}}>
          <path d={vThreadPath()} fill="none" stroke={C.discovery} strokeWidth={2} opacity={0.7} />
        </svg>
      </AbsoluteFill>

      {/* chosen blocks converging into the candidate chip */}
      {converge < 1 &&
        VBLOCKS.filter((b) => VCHOSEN_IDS.includes(b.id)).map((b) => {
          const x = b.x + (CHIP_START.x - b.x) * converge;
          const y = b.y + (CHIP_START.y - b.y) * converge;
          return (
            <div
              key={b.id}
              style={{
                position: 'absolute',
                left: x - 9,
                top: y - 9,
                width: 18,
                height: 18,
                borderRadius: 4.5,
                background: '#1e2440',
                border: `1.5px solid ${C.discovery}`,
                boxShadow: '0 0 16px rgba(139,124,255,0.6)',
                opacity: 1 - Math.pow(converge, 3) * 0.9,
              }}
            />
          );
        })}

      {/* sealed rooms */}
      {ROOMS.map((room, i) => {
        const meta = LENS[room.short];
        const isFocus = room.short === short;
        const roomDim = focusT > 0 ? (isFocus ? 1 : 1 - focusT * 0.62) : 1;
        const wallT = lerp(frame, [30 + i * 5, 52 + i * 5], [0, 1], easeOut);
        return (
          <React.Fragment key={room.short}>
            {/* room outline */}
            <div
              style={{
                position: 'absolute',
                left: 90,
                top: ROOM_TOP(room.cy),
                width: 900 * wallT,
                height: 330,
                borderRadius: 14,
                border: `1.5px solid ${isFocus && focusT > 0 ? `${meta.color}66` : C.hairline2}`,
                background: isFocus && focusT > 0 ? `${meta.color}0a` : 'transparent',
                boxShadow: isFocus && focusT > 0 ? `0 0 ${34 * focusT}px ${meta.color}22` : undefined,
                opacity: 0.9 * roomDim,
              }}
            />
            {/* label */}
            <div
              style={{
                position: 'absolute',
                left: 122,
                top: ROOM_TOP(room.cy) + 24,
                transform: `scale(${pop(frame, 52 + i * 6, 12, 0.7)})`,
                transformOrigin: 'left center',
                opacity: lerp(frame, [52 + i * 6, 60 + i * 6], [0, 1]) * roomDim,
              }}
            >
              <Chip color={meta.color} border={`${meta.color}55`} bg={`${meta.color}10`} size={17}>
                {meta.chip}
              </Chip>
            </div>
            {/* candidate copy sliding into this room */}
            {splitT > 0 && (
              <div
                style={{
                  position: 'absolute',
                  left: CHIP_START.x,
                  top: CHIP_START.y + (room.cy + 30 - CHIP_START.y) * splitT,
                  transform: 'translate(-50%, -50%)',
                  opacity: Math.min(splitT * 3, 1) * roomDim,
                }}
              >
                <CandidateChip glow={0.7} />
              </div>
            )}
            {/* probe with trail */}
            {lerp(frame, [62, 72], [0, 1]) > 0 &&
              Array.from({length: 16}).map((_, k) => {
                const pf = frame - k;
                if (pf < 62) return null;
                const px = 540 + 300 * Math.sin(pf * 0.075 + i * 2.1);
                const py = room.cy + 42 + 96 * Math.sin(pf * 0.121 + i * 2.7 + 1.2);
                const fade = 1 - k / 16;
                return (
                  <div
                    key={k}
                    style={{
                      position: 'absolute',
                      left: px,
                      top: py,
                      width: k === 0 ? 9 : 6 * fade + 1,
                      height: k === 0 ? 9 : 6 * fade + 1,
                      borderRadius: 99,
                      background: meta.color,
                      opacity: (k === 0 ? 0.95 : fade * 0.28) * roomDim,
                      boxShadow: k === 0 ? `0 0 16px ${meta.color}` : undefined,
                      transform: 'translate(-50%, -50%)',
                    }}
                  />
                );
              })}
          </React.Fragment>
        );
      })}

      {/* center candidate chip (pre-split) */}
      <div
        style={{
          position: 'absolute',
          left: CHIP_START.x,
          top: CHIP_START.y,
          transform: `translate(-50%, -50%) scale(${0.6 + chipIn * 0.4})`,
        }}
      >
        <CandidateChip opacity={centerChipOp} />
      </div>

      {/* headline */}
      <AbsoluteFill style={{alignItems: 'center'}}>
        <div style={{marginTop: 214}}>
          <Kinetic text={'Three lenses.\nWorking blind.'} delay={66} size={64} />
        </div>
      </AbsoluteFill>

      {/* footnote → then the pick */}
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'flex-end'}}>
        <div
          style={{
            marginBottom: 190,
            fontFamily: F.mono,
            fontSize: 18,
            letterSpacing: '0.1em',
            color: focusT > 0.4 ? LENS[short].color : C.dim,
            opacity: lerp(frame, [92, 106], [0, 1]),
          }}
        >
          {focusT > 0.4 ? `THIS ONE GOES DEEP · ${LENS[short].label}` : 'SAME CANDIDATE · THREE SEALED ROOMS'}
        </div>
      </AbsoluteFill>
    </Void>
  );
};
