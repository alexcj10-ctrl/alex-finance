import type { LessonQuiz } from '../types/quiz';
import type { PlayerBirthYear } from '../types/database';

export type MacroPhaseId = 'possesso' | 'non_possesso';

export type PhaseId =
  | 'costruzione'
  | 'progressione'
  | 'finalizzazione'
  | 'pressione_alta'
  | 'pressione_bassa'
  | 'transizione';

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
  eligibleBirthYears: readonly PlayerBirthYear[];
  quiz?: LessonQuiz;
  demo: boolean;
};

export function formatLessonAudience(years: readonly PlayerBirthYear[]) {
  if (years.length === 1) return `Solo ${years[0]}`;
  return years.join(' · ');
}

export function isLessonEligibleForBirthYear(
  lesson: Pick<Lesson, 'eligibleBirthYears'>,
  birthYear: PlayerBirthYear | null,
) {
  return birthYear === null || lesson.eligibleBirthYears.includes(birthYear);
}

const allPlayerBirthYears = [2014, 2015] as const satisfies readonly PlayerBirthYear[];

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
  transizione: 'Transizione',
};

export const phaseOrderByMacro: Record<MacroPhaseId, readonly PhaseId[]> = {
  possesso: ['costruzione', 'progressione', 'finalizzazione'],
  non_possesso: ['pressione_alta', 'pressione_bassa', 'transizione'],
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
    eligibleBirthYears: allPlayerBirthYears,
    demo: false,
  },
  {
    id: 'costruzione-attira-uomo-libero',
    titolo: 'Attira e trova l’uomo libero',
    macroFase: 'possesso',
    fase: 'costruzione',
    sistema: '1-3-2-3',
    descrizioneBreve:
      'Attiriamo la pressione, usiamo il terzo uomo e troviamo il compagno libero.',
    puntiChiave: [
      'Attira prima di giocare.',
      'Usa il terzo uomo.',
      'Cerca chi è rimasto libero.',
    ],
    variantiVideo: [
      {
        id: 'terzo-uomo-dx',
        etichetta: 'Variante DX',
        percorsoVideo: '/videos/terzo-uomo-dx.mp4',
      },
    ],
    punti: 60,
    disponibilita: 'disponibile',
    concetti: ['Attrazione della pressione', 'Terzo uomo', 'Uomo libero'],
    eligibleBirthYears: allPlayerBirthYears,
    demo: false,
  },
  {
    id: 'costruzione-linea-di-passaggio',
    titolo: 'Libera la linea di passaggio',
    macroFase: 'possesso',
    fase: 'costruzione',
    sistema: '1-3-2-3',
    descrizioneBreve:
      'Prima di ricevere, controlla la linea tra te e la palla. Se è chiusa, muoviti per diventare giocabile.',
    puntiChiave: [
      'Guarda se la linea tra te e il portatore è libera.',
      'Se un avversario chiude la linea, non restare fermo.',
      'Muoviti e crea un nuovo angolo per diventare giocabile.',
    ],
    variantiVideo: [
      {
        id: 'linea-passaggio',
        etichetta: 'Linea di passaggio',
        percorsoVideo: '/videos/linea-di-passaggio.mp4',
      },
    ],
    punti: 60,
    disponibilita: 'disponibile',
    concetti: ['Linea di passaggio', 'Smarcamento', 'Rendersi giocabile'],
    eligibleBirthYears: allPlayerBirthYears,
    demo: false,
  },
  {
    id: 'progressione-positiva-negativa',
    titolo: 'Progressione: positiva o negativa',
    macroFase: 'possesso',
    fase: 'progressione',
    sistema: '1-3-2-3',
    descrizioneBreve:
      'Se sei l\'uomo libero, osserva lo spazio davanti a te: se puoi creare vantaggio, progredisci; se lo spazio è chiuso, non forzare e ricomincia la giocata.',
    puntiChiave: [
      'Riconosci se sei tu l\'uomo libero.',
      'Se davanti hai spazio utile e puoi creare vantaggio, progredisci.',
      'Se lo spazio è chiuso, non forzare: ricomincia e cerca nuovamente l\'uomo libero.',
    ],
    variantiVideo: [
      {
        id: 'progressione-positiva',
        etichetta: 'Progressione positiva',
        percorsoVideo: '/videos/progressione_positiva.mp4',
      },
      {
        id: 'progressione-negativa',
        etichetta: 'Progressione negativa',
        percorsoVideo: '/videos/progressione_negativa.mp4',
      },
    ],
    punti: 60,
    disponibilita: 'disponibile',
    concetti: ['Uomo libero', 'Progressione', 'Creare vantaggio'],
    eligibleBirthYears: allPlayerBirthYears,
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
    eligibleBirthYears: allPlayerBirthYears,
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
    eligibleBirthYears: allPlayerBirthYears,
    demo: true,
  },
  {
    id: 'pressione-alta-chiudi-centro-porta-fuori',
    titolo: 'Chiudi il centro, porta fuori',
    macroFase: 'non_possesso',
    fase: 'pressione_alta',
    sistema: '1-3-2-3',
    descrizioneBreve:
      'Chiudiamo il centro e accompagniamo il gioco avversario verso un lato del campo.',
    puntiChiave: [
      'Prima proteggi il centro.',
      'Orienta l’avversario verso la fascia.',
      'Muoviamoci insieme per chiudere le soluzioni.',
    ],
    variantiVideo: [
      {
        id: 'pressione-alta-dx',
        etichetta: 'Variante DX',
        percorsoVideo: '/videos/pressing-alto-dx.mp4',
      },
      {
        id: 'pressione-alta-sx',
        etichetta: 'Variante SX',
        percorsoVideo: '/videos/pressing-alto-sx.mp4',
      },
    ],
    punti: 50,
    disponibilita: 'disponibile',
    concetti: ['Chiusura del centro', 'Orientamento verso la fascia', 'Pressione coordinata'],
    eligibleBirthYears: allPlayerBirthYears,
    demo: false,
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
    eligibleBirthYears: allPlayerBirthYears,
    demo: true,
  },
  {
    id: 'transizione-inferiorita-numerica',
    titolo: 'Inferiorità numerica',
    macroFase: 'non_possesso',
    fase: 'transizione',
    sistema: '1-3-2-3',
    descrizioneBreve:
      'Se siamo in inferiorità numerica, non usciamo in pressione: scappiamo, togliamo profondità e proteggiamo lo spazio davanti alla nostra porta.',
    puntiChiave: [
      'Riconosci quando gli avversari hanno superiorità numerica.',
      'Non uscire in pressione: scappa e togli profondità.',
      'Proteggi lo spazio tra i difensori e la propria porta.',
    ],
    variantiVideo: [
      {
        id: 'inferiorita-numerica',
        etichetta: 'Inferiorità numerica',
        percorsoVideo: '/videos/inferiorità_numerica.mp4',
      },
    ],
    punti: 60,
    disponibilita: 'disponibile',
    concetti: [
      'Inferiorità numerica',
      'Togliere profondità',
      'Protezione della porta',
    ],
    eligibleBirthYears: allPlayerBirthYears,
    demo: false,
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
    eligibleBirthYears: allPlayerBirthYears,
    demo: true,
  },
] as const satisfies readonly Lesson[];
