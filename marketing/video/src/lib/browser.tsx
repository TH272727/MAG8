import React from 'react';
import {Img, staticFile, useCurrentFrame} from 'remotion';
import {C, F} from '../theme';
import {easeOut, lerp, smooth} from './anim';

/**
 * A floating product window: hairline chrome, mono title, and a real
 * screenshot slowly panning inside. The shot is the site — pixel for pixel.
 */
export const BrowserPanel: React.FC<{
  shot: string; // file under public/shots
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  pan: [number, number]; // translateY of the image, display px
  panWindow: [number, number]; // frames
  appear?: number;
  glowColor?: string;
}> = ({shot, label, x, y, w, h, pan, panWindow, appear = 0, glowColor}) => {
  const frame = useCurrentFrame();
  const op = lerp(frame, [appear, appear + 14], [0, 1]);
  const rise = lerp(frame, [appear, appear + 18], [26, 0], easeOut);
  const ty = lerp(frame, panWindow, pan, smooth);
  const CHROME = 46;
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y + rise,
        width: w,
        height: h,
        opacity: op,
        borderRadius: 14,
        background: C.panel,
        border: `1.5px solid ${C.hairline2}`,
        boxShadow: `0 40px 120px rgba(0,0,0,0.6), 0 12px 40px rgba(0,0,0,0.5)${
          glowColor ? `, 0 0 60px ${glowColor}14` : ''
        }`,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          height: CHROME,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 18px',
          borderBottom: `1.5px solid ${C.hairline}`,
          background: C.panel2,
        }}
      >
        {[C.dim, C.dim, C.dim].map((c, i) => (
          <div key={i} style={{width: 11, height: 11, borderRadius: 99, border: `1.5px solid ${c}`, opacity: 0.7}} />
        ))}
        <div
          style={{
            flex: 1,
            textAlign: 'center',
            fontFamily: F.mono,
            fontSize: 15,
            letterSpacing: '0.12em',
            color: C.muted,
          }}
        >
          {label}
        </div>
        <div style={{width: 57}} />
      </div>
      <div style={{position: 'absolute', inset: `${CHROME}px 0 0 0`, overflow: 'hidden'}}>
        <Img
          src={staticFile(`shots/${shot}`)}
          style={{
            width: '100%',
            display: 'block',
            transform: `translateY(${ty}px)`,
          }}
        />
      </div>
    </div>
  );
};
