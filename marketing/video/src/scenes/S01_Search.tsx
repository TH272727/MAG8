import React from 'react';
import {Center, Void} from '../lib/ui';
import {SearchBar} from '../lib/setpieces';

/** S1 — Cold open: the question types itself into a lone search bar. */
export const S01_Search: React.FC = () => (
  <Void depth>
    <Center>
      <SearchBar appear={4} typeDelay={42} />
    </Center>
  </Void>
);
