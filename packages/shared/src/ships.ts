import type { Resources } from './domain';

export const PROBE_ID = '210';

const cost = (metal: number, crystal: number, deuterium: number): Resources => ({
  metal,
  crystal,
  deuterium,
});

export const SHIP_COSTS: Record<string, Resources> = {
  '202': cost(2000, 2000, 0),
  '203': cost(6000, 6000, 0),
  '204': cost(3000, 1000, 0),
  '205': cost(6000, 4000, 0),
  '206': cost(20000, 7000, 2000),
  '207': cost(45000, 15000, 0),
  '208': cost(10000, 20000, 10000),
  '209': cost(10000, 6000, 2000),
  '210': cost(0, 1000, 0),
  '211': cost(50000, 25000, 15000),
  '212': cost(0, 2000, 500),
  '213': cost(60000, 50000, 15000),
  '214': cost(5000000, 4000000, 1000000),
  '215': cost(30000, 40000, 15000),
  '217': cost(2000, 2000, 1000),
  '218': cost(85000, 55000, 20000),
  '219': cost(8000, 15000, 8000),
};

// docs/ogame-data-formats.md §9.2: lowercased technical name (valueless attribute of <technology-icon>) -> ship id
export const SHIP_TECH_NAMES: Record<string, string> = {
  transportersmall: '202',
  transporterlarge: '203',
  fighterlight: '204',
  fighterheavy: '205',
  cruiser: '206',
  battleship: '207',
  colonyship: '208',
  recycler: '209',
  espionageprobe: '210',
  bomber: '211',
  solarsatellite: '212',
  destroyer: '213',
  deathstar: '214',
  interceptor: '215',
  resbuggy: '217',
  reaper: '218',
  explorer: '219',
};
