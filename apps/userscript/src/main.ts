import { main } from './app';
import { realGm } from './gm';

//! AGENTS.md §4: passive read of page globals, no game function called
main(realGm, document, unsafeWindow as unknown as Parameters<typeof main>[2]);
