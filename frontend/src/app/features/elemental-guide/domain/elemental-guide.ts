export interface ElementalRelation {
  name: string;
  icon: string;
}

export interface ElementalMatchup {
  element: ElementalRelation;
  strongAgainst: ElementalRelation[];
  weakAgainst: ElementalRelation[];
}

export interface ElementalReference extends ElementalRelation {
  note: string;
}

const element = (name: string, key: string): ElementalRelation => ({
  name,
  icon: `/images/elements/${key}.png`
});

const fire = element('Fuego', 'fire');
const water = element('Agua', 'water');
const grass = element('Planta', 'grass');
const ice = element('Hielo', 'ice');
const electric = element('Rayo', 'electric');
const ground = element('Tierra', 'ground');
const dark = element('Oscuridad', 'dark');
const dragon = element('Dragón', 'dragon');
const neutral = element('No elemental', 'neutral');
const none = { ...neutral, name: 'Ninguno' };

export const ELEMENTAL_MATCHUPS: ElementalMatchup[] = [
  { element: water, strongAgainst: [fire], weakAgainst: [electric] },
  { element: dragon, strongAgainst: [dark], weakAgainst: [ice] },
  { element: fire, strongAgainst: [ice, grass], weakAgainst: [water] },
  { element: ice, strongAgainst: [dragon], weakAgainst: [fire] },
  { element: neutral, strongAgainst: [none], weakAgainst: [dark] },
  { element: dark, strongAgainst: [neutral], weakAgainst: [dragon] },
  { element: grass, strongAgainst: [ground], weakAgainst: [fire] },
  { element: electric, strongAgainst: [water], weakAgainst: [ground] },
  { element: ground, strongAgainst: [electric], weakAgainst: [grass] }
];

export const ELEMENTAL_REFERENCES: ElementalReference[] = [
  { ...fire, note: 'Daño alto contra Hielo y Planta.' },
  { ...water, note: 'Presiona a Fuego y recibe de Rayo.' },
  { ...grass, note: 'Ventaja contra Tierra y debilidad a Fuego.' },
  { ...ice, note: 'Golpea Dragón y cae ante Fuego.' },
  { ...electric, note: 'Efectivo contra Agua y vulnerable a Tierra.' },
  { ...ground, note: 'Castiga a Rayo y Planta lo frena.' },
  { ...dark, note: 'Presiona No elemental y Dragón lo castiga.' },
  { ...dragon, note: 'Fuerte contra Oscuridad, débil ante Hielo.' },
  { ...neutral, note: 'Sin ventaja ofensiva clara.' }
];
