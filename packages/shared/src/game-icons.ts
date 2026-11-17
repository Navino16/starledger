// Static Gameforge CDN images, shared by the userscript and the web app (AGENTS.md §4: no game request).

/** Resource sprite (640x192): its last row holds 48x32 icons at y=160. */
export const RESOURCE_SPRITE = 'https://gf3.geo.gfsrv.net/cdned/7f14c18b15064d2604c5476f5d10b3.png';
export const RESOURCE_SPRITE_INDEX = {
  metal: 0,
  crystal: 1,
  deuterium: 2,
  darkMatter: 4,
} as const;
export type SpriteResource = keyof typeof RESOURCE_SPRITE_INDEX;

// Images of the game's own resource-icon.artifact and lithium-icon rules
export const ARTEFACTS_IMAGE = 'https://gf3.geo.gfsrv.net/cdn2b/0e2244125e97c0d38bab285e057e44.png';
export const LITHIUM_IMAGE = 'https://gf2.geo.gfsrv.net/cdna5/ab5e3b93021d20163984bc9bdc3f93.png';

export const SHIP_IMAGES: Record<string, string> = {
  '202': 'https://gf2.geo.gfsrv.net/cdnd9/60555c3c87b9eb3b5ddf76780b5712.jpg',
  '203': 'https://gf1.geo.gfsrv.net/cdn34/fdbcc505474e3e108d10a3ed4a19f4.jpg',
  '204': 'https://gf2.geo.gfsrv.net/cdnd2/9ed5c1b6aea28fa51f84cdb8cb1e7e.jpg',
  '205': 'https://gf1.geo.gfsrv.net/cdnf1/8266a2cbae5ad630c5fedbdf270f3e.jpg',
  '206': 'https://gf2.geo.gfsrv.net/cdn45/b7ee4f9d556a0f39dae8d2133e05b7.jpg',
  '207': 'https://gf1.geo.gfsrv.net/cdn32/3f4a081f4d15662bed33473db53d5b.jpg',
  '208': 'https://gf1.geo.gfsrv.net/cdn6f/41a21e4253d2231f8937ddef1ba43e.jpg',
  '209': 'https://gf1.geo.gfsrv.net/cdn07/6246eb3d7fa67414f6b818fa79dd9b.jpg',
  '210': 'https://gf3.geo.gfsrv.net/cdnb5/347821e80cafc52aec04f27c3a2a4d.jpg',
  '211': 'https://gf1.geo.gfsrv.net/cdnca/4d55a520aed09d0c43e7b962f33e27.jpg',
  '212': 'https://gf2.geo.gfsrv.net/cdnda/665c65072887153d44a6684ec276e9.jpg',
  '213': 'https://gf3.geo.gfsrv.net/cdn2a/c2b9fedc9c93ef22f2739c49fbac52.jpg',
  '214': 'https://gf3.geo.gfsrv.net/cdn84/155e9e24fc1d34ed4660de8d428f45.jpg',
  '215': 'https://gf3.geo.gfsrv.net/cdn5a/24f511ec14a71e2d83fd750aa0dee2.jpg',
  '217': 'https://gf3.geo.gfsrv.net/cdn26/28e8d79a5b489dc795cc47f3adf165.jpg',
  '218': 'https://gf1.geo.gfsrv.net/cdn39/12d016c8bb0d71e053b901560c17cc.jpg',
  '219': 'https://gf3.geo.gfsrv.net/cdne2/b8d8d18f2baf674acedb7504c7cc83.jpg',
};
