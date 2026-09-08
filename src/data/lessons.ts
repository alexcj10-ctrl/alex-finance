export type MacroPhaseId = 'possesso' | 'non_possesso';

export type PhaseId =
  | 'costruzione'
  | 'progressione'
  | 'finalizzazione'
  | 'pressione_alta'
  | 'pressione_bassa';

export type FormationId = '1-3-2-3';
export type LessonAvailability = 'disponibile' | 'prossimamente';
export type LessonProgressStatus = 'da_fare' | 'in_corso' | 'completata';

export type LessonVideoVariant = {
  id: string;
  etichetta: string;
  percorsoVideo: `/videos/${string}.mp4`;
  percorsoSottotitoli?: `/videos/${string}.vtt`;
};

type LessonKeyPoints =
  | readonly [string]
  | readonly [string, string]
  | readonly [string, string, string];

export type Lesson = {
  id: string;
  titolo: string;
  macroFase: MacroPhaseId;
  fase: PhaseId;
  sistema: FormationId;
  descrizioneBreve: string;
  puntiChiave: LessonKeyPoints;
  variantiVideo: readonly [LessonVideoVariant, ...LessonVideoVariant[]];
  punti: number;
  disponibilita: LessonAvailability;
  trofeoCollegato?: string;
  concetti: readonly string[];
  demo: boolean;
};

export const macroPhaseLabels: Record<MacroPhaseId, string> = {
  possesso: 'Con palla',
  non_possesso: 'Senza palla',
};

export const phaseLabels: Record<PhaseId, string> = {
  costruzione: 'Costruzione',
  progressione: 'Progressione',
  finalizzazione: 'Finalizzazione',
  pressione_alta: 'Pressione alta',
  pressione_bassa: 'Pressione bassa',
};

export const phaseOrderByMacro: Record<MacroPhaseId, readonly PhaseId[]> = {
  possesso: ['costruzione', 'progressione', 'finalizzazione'],
  non_possesso: ['pressione_alta', 'pressione_bassa'],
};

export const lessons = [
  {
    id: 'costruzione-creare-ampiezza',
    titolo: 'Massima ampiezza dalla rimessa dal fondo',
    macroFase: 'possesso',
    fase: 'costruzione',
    sistema: '1-3-2-3',
    descrizioneBreve: 'Apri il campo e dai al portiere linee di passaggio pulite.',
    puntiChiave: [
      'Apriti e occupa tutta la larghezza del campo.',
      'Mettiti dove il portiere può vederti e servirti.',
      'Lascia sempre una linea di passaggio pulita tra te e la palla.',
    ],
    variantiVideo: [
      {
        id: 'variante-a',
        etichetta: 'Variante A',
        percorsoVideo: '/videos/ampiezza-costruzione.mp4',
      },
      {
        id: 'variante-b',
        etichetta: 'Variante B',
        percorsoVideo: '/videos/ampiezza-costruzione-variante-b.mp4',
      },
    ],
    punti: 60,
    disponibilita: 'disponibile',
    trofeoCollegato: 'prima-lezione',
    concetti: ['Ampiezza', 'Linea di passaggio'],
    demo: false,
  },
  {
    id: 'demo-progressione-terzo-uomo',
    titolo: 'Avanzare con il terzo uomo',
    macroFase: 'possesso',
    fase: 'progressione',
    sistema: '1-3-2-3',
    descrizioneBreve: 'Gioca corto per liberare un compagno già rivolto verso la porta.',
    puntiChiave: [
      'Avvicinati per offrire un appoggio sicuro.',
      'Gioca con pochi tocchi quando il compagno è libero.',
      'Dopo lo scarico, attacca lo spazio davanti a te.',
    ],
    variantiVideo: [
      {
        id: 'variante-a',
        etichetta: 'Variante A',
        percorsoVideo: '/videos/demo-progressione-terzo-uomo.mp4',
      },
    ],
    punti: 40,
    disponibilita: 'prossimamente',
    concetti: ['Terzo uomo'],
    demo: true,
  },
  {
    id: 'demo-finalizzazione-tre-zone',
    titolo: 'Attaccare tre zone',
    macroFase: 'possesso',
    fase: 'finalizzazione',
    sistema: '1-3-2-3',
    descrizioneBreve: 'Arriva davanti alla porta in zone e tempi diversi dai compagni.',
    puntiChiave: [
      'Non correre tutti verso la stessa zona.',
      'Attacca la porta con tempi diversi dai compagni.',
      'Un giocatore resta pronto fuori dall’area.',
    ],
    variantiVideo: [
      {
        id: 'variante-a',
        etichetta: 'Variante A',
        percorsoVideo: '/videos/demo-finalizzazione-tre-zone.mp4',
      },
    ],
    punti: 50,
    disponibilita: 'prossimamente',
    concetti: ['Attacco dell’area'],
    demo: true,
  },
  {
    id: 'demo-pressione-alta-squadra-corta',
    titolo: 'Pressare tutti insieme',
    macroFase: 'non_possesso',
    fase: 'pressione_alta',
    sistema: '1-3-2-3',
    descrizioneBreve: 'Accorcia in avanti con i compagni quando parte la pressione.',
    puntiChiave: [
      'Parti insieme ai compagni.',
      'Chiudi la linea di passaggio più vicina.',
      'Resta vicino alla squadra.',
    ],
    variantiVideo: [
      {
        id: 'variante-a',
        etichetta: 'Variante A',
        percorsoVideo: '/videos/demo-pressione-alta.mp4',
      },
    ],
    punti: 50,
    disponibilita: 'prossimamente',
    concetti: ['Pressione coordinata'],
    demo: true,
  },
  {
    id: 'demo-pressione-bassa-proteggi-centro',
    titolo: 'Proteggere il centro',
    macroFase: 'non_possesso',
    fase: 'pressione_bassa',
    sistema: '1-3-2-3',
    descrizioneBreve: 'Difendi la zona centrale e accompagna la palla verso l’esterno.',
    puntiChiave: [
      'Stringi verso il centro.',
      'Scivola insieme alla squadra.',
      'Comunica con il compagno vicino.',
    ],
    variantiVideo: [
      {
        id: 'variante-a',
        etichetta: 'Variante A',
        percorsoVideo: '/videos/demo-pressione-bassa.mp4',
      },
    ],
    punti: 50,
    disponibilita: 'prossimamente',
    concetti: ['Blocco compatto'],
    demo: true,
  },
] as const satisfies readonly Lesson[];
