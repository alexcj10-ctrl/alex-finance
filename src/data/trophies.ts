import type { MacroPhaseId, PhaseId } from './lessons';

export type TrophyId =
  | 'prima-lezione'
  | 'costruttore'
  | 'cinque-lezioni'
  | 'cento-punti'
  | 'specialista-con-palla';

export type TrophyIconId = 'medal' | 'blocks' | 'flame' | 'star' | 'shield';

export type TrophyRule =
  | { kind: 'completed_lessons'; minimum: number }
  | { kind: 'complete_phase'; phase: PhaseId }
  | { kind: 'points'; minimum: number }
  | { kind: 'complete_macro'; macroFase: MacroPhaseId; minimum: number };

export type Trophy = {
  id: TrophyId;
  titolo: string;
  descrizione: string;
  icon: TrophyIconId;
  rule: TrophyRule;
};

export const trophies = [
  {
    id: 'prima-lezione',
    titolo: 'Prima lezione',
    descrizione: 'Completa la prima lezione.',
    icon: 'medal',
    rule: { kind: 'completed_lessons', minimum: 1 },
  },
  {
    id: 'costruttore',
    titolo: 'Costruttore',
    descrizione: 'Completa le lezioni disponibili di Costruzione.',
    icon: 'blocks',
    rule: { kind: 'complete_phase', phase: 'costruzione' },
  },
  {
    id: 'cinque-lezioni',
    titolo: '5 lezioni',
    descrizione: 'Completa cinque lezioni.',
    icon: 'flame',
    rule: { kind: 'completed_lessons', minimum: 5 },
  },
  {
    id: 'cento-punti',
    titolo: '100 punti',
    descrizione: 'Raggiungi cento punti.',
    icon: 'star',
    rule: { kind: 'points', minimum: 100 },
  },
  {
    id: 'specialista-con-palla',
    titolo: 'Specialista con palla',
    descrizione: 'Completa tre lezioni con palla.',
    icon: 'shield',
    rule: { kind: 'complete_macro', macroFase: 'possesso', minimum: 3 },
  },
] as const satisfies readonly Trophy[];
