export type PhaseId = 'costruzione' | 'progressione' | 'finalizzazione';
export type FormationId = '1-3-2-3' | '1-4-1-3' | '1-4-1-2-1';
export type LessonLevel = 'base' | 'avanzato' | 'entrambi';
export type LessonStatus = 'disponibile' | 'prossimamente';

type LessonKeyPoints =
  | readonly [string]
  | readonly [string, string]
  | readonly [string, string, string];

export type Lesson = {
  id: string;
  titolo: string;
  fase: PhaseId;
  sistema: FormationId;
  livello: LessonLevel;
  descrizione: string;
  obiettivo: string;
  puntiChiave: LessonKeyPoints;
  percorsoVideo: `/videos/${string}.mp4`;
  percorsoSottotitoli?: `/videos/${string}.vtt`;
  stato: LessonStatus;
  demo: boolean;
};

/**
 * Catalogo dimostrativo iniziale.
 * Testi e principi servono soltanto a provare la struttura delle lezioni:
 * non rappresentano ancora la metodologia definitiva di ESORDIENTI ANALYST.
 */
export const lessons = [
  {
    id: 'costruzione-creare-ampiezza',
    titolo: 'Creare ampiezza',
    fase: 'costruzione',
    sistema: '1-3-2-3',
    livello: 'entrambi',
    descrizione:
      'Impariamo a occupare bene la larghezza del campo per dare spazio e linee di passaggio ai compagni.',
    obiettivo:
      'Creare spazio e soluzioni di passaggio attraverso una corretta occupazione dell\'ampiezza.',
    puntiChiave: [
      'Apriti quando la squadra ha bisogno di spazio',
      'Non stare sulla stessa linea del compagno',
      'Fatti vedere con una linea di passaggio chiara',
    ],
    percorsoVideo: '/videos/ampiezza-costruzione.mp4',
    stato: 'disponibile',
    demo: false,
  },
  {
    id: 'demo-progressione-terzo-uomo',
    titolo: 'Demo — Avanzare con il terzo uomo',
    fase: 'progressione',
    sistema: '1-4-1-3',
    livello: 'entrambi',
    descrizione:
      'Esempio dimostrativo per capire come un compagno può liberarne un altro e far avanzare l’azione.',
    obiettivo:
      'Riconoscere il momento in cui giocare corto per trovare un compagno già orientato verso la porta avversaria.',
    puntiChiave: [
      'Avvicinati per offrire un appoggio sicuro.',
      'Gioca con pochi tocchi quando il compagno è libero.',
      'Dopo lo scarico, attacca lo spazio davanti a te.',
    ],
    percorsoVideo: '/videos/demo-progressione-terzo-uomo.mp4',
    stato: 'prossimamente',
    demo: true,
  },
  {
    id: 'demo-finalizzazione-tre-zone',
    titolo: 'Demo — Attaccare tre zone davanti alla porta',
    fase: 'finalizzazione',
    sistema: '1-4-1-2-1',
    livello: 'avanzato',
    descrizione:
      'Esempio dimostrativo sugli arrivi coordinati quando la palla entra nell’ultimo terzo di campo.',
    obiettivo:
      'Occupare zone diverse davanti alla porta per offrire più soluzioni e restare pronti sulla seconda palla.',
    puntiChiave: [
      'Non correre tutti verso la stessa zona.',
      'Attacca la porta con tempi diversi dai compagni.',
      'Un giocatore resta pronto fuori dall’area.',
    ],
    percorsoVideo: '/videos/demo-finalizzazione-tre-zone.mp4',
    stato: 'prossimamente',
    demo: true,
  },
] as const satisfies readonly Lesson[];
