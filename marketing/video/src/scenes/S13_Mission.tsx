import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {Chip, Kinetic, Panel, Void} from '../lib/ui';
import {BrowserPanel} from '../lib/browser';
import {easeOut, lerp} from '../lib/anim';
import {C, F} from '../theme';

type FeedLine = {t: string; tag: string; tagColor: string; msg: string};
const FEED: FeedLine[] = [
  {t: '09:46:12', tag: 'scout', tagColor: C.discovery, msg: 'trillion-DNA screen · 8 names'},
  {t: '09:47:03', tag: 'fundamentals', tagColor: C.fundamentals, msg: 'CRWV · reading the books'},
  {t: '09:47:41', tag: 'macro', tagColor: C.macro, msg: 'VRT · mapping positioning'},
  {t: '09:48:19', tag: 'consensus', tagColor: C.consensus, msg: 'CRDO · 18 sources cited'},
  {t: '09:49:02', tag: 'fundamentals', tagColor: C.fundamentals, msg: 'VRT · margins verified'},
  {t: '09:50:26', tag: 'macro', tagColor: C.macro, msg: 'HIMS · asymmetry 3/10'},
  {t: '09:51:44', tag: 'consensus', tagColor: C.consensus, msg: 'VKTX · targets split'},
  {t: '09:53:08', tag: 'compile', tagColor: C.ink, msg: 'cross-checking 24 cells'},
  {t: '09:55:31', tag: 'verify', tagColor: C.ink, msg: 'scores recomputed in code'},
  {t: '09:58:00', tag: 'board', tagColor: C.confluence, msg: 'VRT posts 49.1 · rank #1'},
];

/** S13 — Live mission control: the real run page + a ticking wire. */
export const S13_Mission: React.FC = () => {
  const frame = useCurrentFrame();
  const slideY = lerp(frame, [0, 14], [1080, 0], easeOut);
  const shown = FEED.filter((_, i) => frame >= 26 + i * 13);
  return (
    <Void>
      <AbsoluteFill style={{transform: `translateY(${slideY}px)`}}>
        <BrowserPanel
          shot="run.png"
          label="MAG8 · MISSION CONTROL"
          x={120}
          y={110}
          w={1080}
          h={860}
          pan={[-10, -296]}
          panWindow={[18, 168]}
          appear={2}
        />

        {/* the wire */}
        <Panel style={{position: 'absolute', left: 1252, top: 110, width: 548, height: 636, padding: 26, boxSizing: 'border-box'}}>
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20}}>
            <span style={{fontFamily: F.mono, fontSize: 23, letterSpacing: '0.14em', color: C.muted}}>
              ACTIVITY WIRE
            </span>
            <Chip size={21} color={C.fundamentals} border={`${C.fundamentals}66`} bg={`${C.fundamentals}10`}>
              <span
                style={{
                  display: 'inline-block',
                  width: 8,
                  height: 8,
                  borderRadius: 99,
                  background: C.fundamentals,
                  boxShadow: `0 0 ${6 + 5 * Math.sin(frame * 0.2)}px ${C.fundamentals}`,
                  opacity: 0.75 + 0.25 * Math.sin(frame * 0.2),
                }}
              />
              LIVE
            </Chip>
          </div>
          <div style={{display: 'flex', flexDirection: 'column', gap: 13}}>
            {shown.slice(-7).map((l, i) => {
              const idx = FEED.indexOf(l);
              const at = 26 + idx * 13;
              const op = lerp(frame, [at, at + 8], [0, 1]);
              const rise = lerp(frame, [at, at + 8], [6, 0]);
              return (
                <div
                  key={l.t}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    fontFamily: F.mono,
                    fontSize: 23,
                    opacity: op,
                    transform: `translateY(${rise}px)`,
                  }}
                >
                  <div style={{display: 'flex', gap: 14, alignItems: 'baseline'}}>
                    <span style={{color: C.muted}}>{l.t}</span>
                    <span style={{color: l.tagColor}}>{l.tag}</span>
                  </div>
                  <div style={{color: C.ink}}>{l.msg}</div>
                </div>
              );
            })}
          </div>
        </Panel>

        {/* matrix note */}
        <div style={{position: 'absolute', left: 1252, top: 782, opacity: lerp(frame, [60, 74], [0, 1])}}>
          <Chip size={22}>MATRIX 8 × 3 · EVERY CELL INDEPENDENT</Chip>
        </div>

        <div style={{position: 'absolute', left: 1252, top: 856}}>
          <Kinetic text={'Watch every\nrun live.'} delay={96} size={66} align="left" />
        </div>
      </AbsoluteFill>
    </Void>
  );
};
