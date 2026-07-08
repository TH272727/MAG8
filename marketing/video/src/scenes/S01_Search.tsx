import React from 'react';
import {Center, Void} from '../lib/ui';
import {BigQuestion, SearchBar} from '../lib/setpieces';
import {C} from '../theme';

/**
 * S1 — Cold open, big: the question POPS huge, holds long enough to actually
 * read, then shrinks down into the lone search bar (which S2 will bury).
 * The pill lands centered at scale 1 — exactly the state S2 opens on.
 */
export const S01_Search: React.FC = () => (
  <Void depth>
    <Center>
      <BigQuestion
        lines={['the next', 'trillion-dollar stock?']}
        size={150}
        popAt={6}
        growOver={[26, 112]}
        shrinkOver={[116, 146]}
        // land on the pill's text line (left-aligned, 36px) — dx pulls the
        // block center toward the query's resting center inside the pill
        target={{x: -174, y: 0, scale: 36 / 150}}
        fadeOver={[132, 148]}
        accents={{3: C.discovery}}
      />
    </Center>
    <Center>
      <SearchBar done appear={130} />
    </Center>
  </Void>
);
