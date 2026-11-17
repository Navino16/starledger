import {
  ARTEFACTS_IMAGE,
  RESOURCE_SPRITE,
  RESOURCE_SPRITE_INDEX,
  SHIP_IMAGES,
  type SpriteResource,
} from '@app/shared';
import type { CSSProperties } from 'react';

// AGENTS.md §4: static Gameforge CDN images, never a game server request.

/** A resource icon from the game sprite, drawn at 27x18 like the userscript. */
export function ResourceIcon({ kind }: { kind: SpriteResource | 'artefacts' }) {
  const style: CSSProperties =
    kind === 'artefacts'
      ? {
          width: 18,
          height: 18,
          backgroundImage: `url("${ARTEFACTS_IMAGE}")`,
          backgroundSize: 'contain',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }
      : {
          width: 27,
          height: 18,
          backgroundImage: `url("${RESOURCE_SPRITE}")`,
          backgroundSize: '360px 108px',
          backgroundPosition: `-${RESOURCE_SPRITE_INDEX[kind] * 27}px -90px`,
        };
  return <span aria-hidden="true" className="inline-block flex-none" style={style} />;
}

export const shipImage = (id: string): string | undefined => SHIP_IMAGES[id];
