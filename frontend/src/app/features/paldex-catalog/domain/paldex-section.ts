export type PaldexSectionId = 'pals' | 'items' | 'gear';

export interface PaldexSectionTab {
  id: PaldexSectionId;
  label: string;
}

export const PALDEX_SECTION_TABS: PaldexSectionTab[] = [
  { id: 'pals', label: 'Pals' },
  { id: 'items', label: 'Items' },
  { id: 'gear', label: 'Gear' }
];
