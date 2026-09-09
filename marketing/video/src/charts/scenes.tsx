/**
 * The four beats of a chart film. Structure is fixed for every chart in the
 * format — hook, race, payoff, endcard — because the structure IS the format;
 * what varies is the spec and the numbers.
 *
 * FORMULA.md bindings: §A the question pops huge, holds, then hands off to the
 * chart · §C every full sentence holds ≥ ~2.2s after its last word · §G the
 * endcard contract closes every film · §H gold marks the verdict, and here the
 * verdict is the winning line.
 */
import React, {createContext, useContext} from 'react';
import {AbsoluteFill, Img, staticFile, useCurrentFrame} from 'remotion';
import {C, F, SAFE} from '../theme';
import {Chip, Grain, Void, WaitlistCta} from '../lib/ui';
import {lerp, pop, pulse01, easeOut} from '../lib/anim';
import {Backdrop, BigDate, BrandRow, ChartHead, LiveRail, Plot, SourceBlock, Standings, VW, revealIndex} from './clib';
import {growthMultiple, standingsAt} from './cmath';
import {formatDate, formatValue} from './spec';
import type {Chart} from './registry';

export const ChartCtx = createContext<Chart | null>(null);
export const useChart = (): Chart => {
  const c = useContext(ChartCtx);
  if (!c) throw new Error('a chart scene rendered outside its provider');
  return c;
};

/* ------------------------------ C1 · the hook ----------------------------- */

/**
 * Three seconds, one question, at the biggest size it will ever be. The chart
 * does not appear until the question has been read — the owner's note from the
 * 2026-07-08 pass, and it is the difference between a scroll and a watch.
 */
export const C1_Hook: React.FC = () => {
  const {spec} = useChart();
  const frame = useCurrentFrame();
  const s = pop(frame, 4, 13, 0.85);
  const hold = lerp(frame, [58, 84], [1, 0.86]);
  const rise = lerp(frame, [58, 84], [0, -40], easeOut);
  return (
    <Void depth>
      <BrandRow at={2} />
      <AbsoluteFill
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          paddingLeft: SAFE.portrait.sides,
          paddingRight: SAFE.portrait.sides,
        }}
      >
        <div
          style={{
            fontFamily: F.display,
            fontSize: 118,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            lineHeight: 1.06,
            textAlign: 'center',
            color: C.ink,
            opacity: Math.min(lerp(frame, [4, 16], [0, 1]), 1),
            transform: `translateY(${(1 - Math.min(s, 1)) * 40 + rise}px) scale(${hold})`,
            textShadow: '0 0 40px rgba(242,199,92,0.14)',
          }}
        >
          {spec.hook.question}
        </div>
        {spec.hook.kicker ? (
          <div
            style={{
              marginTop: 44,
              fontFamily: F.body,
              fontSize: 38,
              color: C.muted,
              textAlign: 'center',
              lineHeight: 1.3,
              opacity: lerp(frame, [26, 42], [0, 1]),
              transform: `translateY(${rise}px)`,
            }}
          >
            {spec.hook.kicker}
          </div>
        ) : null}
      </AbsoluteFill>
    </Void>
  );
};

/* ------------------------------ C2 · the race ----------------------------- */

export const C2_Race: React.FC = () => {
  const {spec, data, beats} = useChart();
  const frame = useCurrentFrame();
  const idx = revealIndex(frame, beats.race, data.dates.length);
  const intro = lerp(frame, [0, 14], [0, 1]);
  return (
    <Void depth>
      {/* under everything: the photograph, scrimmed to a texture */}
      <Backdrop spec={spec} frames={beats.race} />
      <BrandRow />
      <ChartHead spec={spec} at={0} />
      <Plot spec={spec} data={data} idx={idx} intro={intro} />
      <BigDate data={data} idx={idx} mode={spec.dateFormat ?? 'month'} />
      <LiveRail spec={spec} data={data} idx={idx} at={18} />
      <SourceBlock data={data} at={14} />
    </Void>
  );
};

/* ----------------------------- C3 · the payoff ---------------------------- */

/**
 * The turn. The race has finished; now the numbers get named, and the leading
 * figure is derived from the dataset rather than typed, so the sentence and the
 * chart cannot disagree.
 */
export const C3_Payoff: React.FC = () => {
  const {spec, data} = useChart();
  const frame = useCurrentFrame();
  const last = data.dates.length - 1;
  const order = standingsAt(data, last);
  const leader = order[0];
  const leaderSpec = spec.series.find((s) => s.key === leader?.key);
  const values = data.series.find((s) => s.key === leader?.key)?.values ?? [];
  const mult = growthMultiple(values);

  return (
    <Void depth>
      <BrandRow />
      <div
        style={{
          position: 'absolute',
          top: 232,
          left: SAFE.portrait.sides,
          width: VW - SAFE.portrait.sides * 2,
        }}
      >
        <div
          style={{
            fontFamily: F.mono,
            fontSize: 26,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: C.muted,
            opacity: lerp(frame, [2, 14], [0, 1]),
          }}
        >
          {formatDate(data.dates[0], 'month')} → {formatDate(data.dates[last], 'month')}
        </div>
        <div
          style={{
            marginTop: 20,
            fontFamily: F.display,
            fontSize: 60,
            fontWeight: 700,
            letterSpacing: '-0.015em',
            lineHeight: 1.14,
            color: C.ink,
            opacity: lerp(frame, [8, 22], [0, 1]),
            transform: `translateY(${(1 - Math.min(pop(frame, 8, 14, 0.9), 1)) * 20}px)`,
          }}
        >
          {spec.payoff.lead}
        </div>
      </div>

      <Standings spec={spec} data={data} at={26} rows={8} />

      {leader && leaderSpec && mult !== null ? (
        <div
          style={{
            position: 'absolute',
            top: 1150,
            left: SAFE.portrait.sides,
            width: VW - SAFE.portrait.sides * 2,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16,
            opacity: lerp(frame, [78, 94], [0, 1]),
          }}
        >
          <Chip color={C.confluence} border={C.confluence} bg={C.panel} size={26}>
            {leaderSpec.label} · {mult >= 10 ? Math.round(mult) : mult.toFixed(1)}× IN {(
              (Number(data.dates[last].slice(0, 4)) - Number(data.dates[0].slice(0, 4)))
            )} YEARS
          </Chip>
          <div
            style={{
              fontFamily: F.display,
              fontSize: 96,
              fontWeight: 700,
              color: C.confluence,
              lineHeight: 1,
              fontVariantNumeric: 'tabular-nums',
              textShadow: `0 0 ${26 + pulse01(((frame - 90) % 70) / 46) * 30}px rgba(242,199,92,0.4)`,
              whiteSpace: 'nowrap',
            }}
          >
            {leader.v === null ? 'n/a' : formatValue(leader.v, spec.unit)}
          </div>
        </div>
      ) : null}

      <div
        style={{
          position: 'absolute',
          top: 1420,
          left: SAFE.portrait.sides,
          width: VW - SAFE.portrait.sides * 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        {spec.payoff.lines.map((line, i) => (
          <div
            key={i}
            style={{
              fontFamily: F.body,
              fontSize: 32,
              lineHeight: 1.34,
              color: C.muted,
              opacity: lerp(frame, [96 + i * 12, 110 + i * 12], [0, 1]),
            }}
          >
            {line}
          </div>
        ))}
      </div>
    </Void>
  );
};

/* ----------------------------- C4 · the endcard --------------------------- */

/**
 * The endcard contract from FORMULA §G, plus the site — the owner asked for the
 * name, the mark and the address on this content, and the domain is live, so
 * the "no URL until the domain ships" hold from the launch film is discharged
 * here.
 */
export const C4_Endcard: React.FC = () => {
  const {spec} = useChart();
  const frame = useCurrentFrame();
  const markIn = pop(frame, 6, 14, 1);
  const beat = Math.max(pulse01((frame - 56) / 26), pulse01((frame - 118) / 26));
  return (
    <Void depth>
      <AbsoluteFill style={{alignItems: 'center'}}>
        <div
          style={{
            marginTop: 470,
            opacity: Math.min(markIn * 1.3, 1),
            transform: `scale(${0.82 + Math.min(markIn, 1) * 0.18})`,
            filter:
              'drop-shadow(0 0 1px rgba(231,234,238,0.62)) drop-shadow(0 0 6px rgba(231,234,238,0.26)) drop-shadow(0 0 18px rgba(231,234,238,0.10))',
          }}
        >
          <Img src={staticFile('brand/mark.png')} style={{width: 140, height: 140}} />
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            marginTop: 34,
            opacity: lerp(frame, [22, 40], [0, 1]),
          }}
        >
          <span
            style={{
              fontFamily: F.display,
              fontSize: 150,
              fontWeight: 700,
              letterSpacing: '0.08em',
              color: C.ink,
              lineHeight: 1,
            }}
          >
            MAG8
          </span>
          <span
            style={{
              display: 'inline-block',
              width: 20,
              height: 20,
              borderRadius: 99,
              background: C.confluence,
              marginLeft: 2,
              transform: `scale(${1 + beat * 0.4})`,
              boxShadow: `0 0 ${16 + beat * 30}px ${C.confluence}88`,
            }}
          />
        </div>

        <div
          style={{
            marginTop: 28,
            fontFamily: F.body,
            fontSize: 38,
            color: C.muted,
            opacity: lerp(frame, [42, 58], [0, 1]),
          }}
        >
          The next trillion-dollar leaderboard.
        </div>

        <div
          style={{
            marginTop: 22,
            fontFamily: F.mono,
            fontSize: 34,
            letterSpacing: '0.1em',
            color: C.discovery,
            opacity: lerp(frame, [52, 68], [0, 1]),
            textShadow: '0 0 20px rgba(139,124,255,0.35)',
          }}
        >
          themag8.com
        </div>

        <div style={{marginTop: 34, opacity: lerp(frame, [70, 86], [0, 1])}}>
          <Chip color={C.ink} border={C.hairline2} bg={C.panel} size={23}>
            {spec.endcardChip}
          </Chip>
        </div>

        <div style={{marginTop: 76}}>
          <WaitlistCta at={92} />
        </div>

        <div
          style={{
            position: 'absolute',
            bottom: 186,
            fontFamily: F.mono,
            fontSize: 22,
            letterSpacing: '0.16em',
            color: C.muted,
            opacity: lerp(frame, [110, 126], [0, 1]),
            whiteSpace: 'nowrap',
          }}
        >
          RESEARCH, NOT INVESTMENT ADVICE
        </div>
      </AbsoluteFill>
      <Grain opacity={0.05} />
    </Void>
  );
};

export const CHART_SCENE_REGISTRY: Record<string, React.FC> = {
  C1_Hook,
  C2_Race,
  C3_Payoff,
  C4_Endcard,
};
