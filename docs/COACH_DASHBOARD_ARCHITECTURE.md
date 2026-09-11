# ESORDIENTI ANALYST — fondazione Area Coach

## Obiettivo e stato

Questa iterazione aggiunge una seconda esperienza applicativa allo stesso progetto:

- **Player App** (`/`): esperienza esistente per i ragazzi, ancora operativa con Home, Lezioni, Trofei, video e progresso locale.
- **Area Coach** (`/coach`): dashboard separata per leggere attività e progressi della squadra.

L’Area Coach usa attualmente un dataset dimostrativo esplicito. Il client Supabase, lo schema SQL, i tipi e il repository di lettura reale sono predisposti, ma non vengono attivati in assenza di un progetto Supabase e di una sessione autenticata.

## Struttura applicativa

```text
src/
  App.tsx                              Player App esistente
  RootApp.tsx                          separa /coach dalla Player App
  coach/
    CoachApp.tsx                       composizione, loading/error e routing
    coach.css                          stile Coach isolato e responsive
    routes.ts                          History API per le route /coach
    components/                        shell, KPI, liste e indicatori
    pages/                             Panoramica, Giocatori, Lezioni, Risultati
    lib/coach-selectors.ts             record normalizzati → read model Coach
  data/
    lessons.ts                         unico catalogo didattico canonico
    coach-mock.ts                      record dimostrativi, separati dalla UI
  services/
    coach-repository.ts                contratto usato dalla UI
    mock-coach-repository.ts           implementazione attiva nell’MVP
    learning-progress-repository.ts    cache Player locale sostituibile
    video-progress-repository.ts       checkpoint locali per le varianti
    supabase/
      client.ts                        client ufficiale, solo con env valide
      supabase-coach-repository.ts     lettura reale protetta per squadra
  types/                               quiz, Coach, database e video progress
supabase/
  migrations/
    202609110001_coach_dashboard_foundation.sql
```

La UI Coach dipende soltanto da `CoachRepository`. Il mock e Supabase producono lo stesso `CoachReadModel`, quindi il cambio di sorgente non richiede modifiche alle pagine.

## Route Coach

| Route | Funzione |
| --- | --- |
| `/coach` | KPI, avanzamento squadra e “Da controllare” |
| `/coach/giocatori` | rosa, filtri e riepilogo per giocatore |
| `/coach/giocatori/:playerId` | scheda individuale |
| `/coach/lezioni` | aggregati sulle lezioni reali |
| `/coach/risultati` | fondazione per risultati e tentativi quiz |

La navigazione Coach è autonoma. Non compare nella bottom navigation Player. `vercel.json` riscrive soltanto `/coach` e le sotto-route verso la SPA, così anche i refresh diretti funzionano.

## Catalogo lezioni

`src/data/lessons.ts` resta la fonte unica per ID, titolo, fase, sistema e varianti video. I record persistenti e mock salvano soltanto `lesson_id` e si uniscono al catalogo in fase di lettura.

L’Area Coach aggrega solo lezioni con:

```ts
lesson.disponibilita === 'disponibile' && lesson.demo === false
```

Le varianti A/B e DX/SX mantengono un `video_progress` distinto, ma non duplicano lezione, completamento o punti. Nel riepilogo della lezione viene usata la percentuale massima tra le alternative valide.

## Flusso previsto

```text
Player App
  ├─ repository locale (fallback immediato)
  └─ futuro repository/sync Supabase
          │
          ▼
PostgreSQL + Auth + RLS
          │
          ▼
SupabaseCoachRepository
          │
          ▼
CoachReadModel → Area Coach
```

Oggi il primo ramo è reale e conserva la chiave storica `esordienti-analyst:learning-progress`. Il secondo è predisposto ma non attivato. L’Area Coach usa `mockCoachRepository`, dichiarato visivamente come “Dati dimostrativi”. Non esiste un fallback silenzioso da Supabase rotto al mock: la sorgente va scelta intenzionalmente.

## Schema database

Tutte le tabelle operative includono `team_id`, necessario per separare squadre e stagioni:

- `profiles`: nickname/nome visualizzato, ruolo e percorso avatar opzionale;
- `teams`: squadra e stagione;
- `team_members`: appartenenza attiva e ruolo nella squadra;
- `lesson_progress`: assegnazione, stato, percentuale, punti e date;
- `video_progress`: percentuale e checkpoint per `(team, player, lesson, variant)`;
- `quiz_attempts`: risposte corrette, totale e punteggio calcolato dal database;
- `player_trophies`: trofei sbloccati;
- `activity_events`: eventi append-only con allowlist e metadata JSON limitati.

Il database non duplica il catalogo tattico: `lesson_id`, `variant_id` e `trophy_id` si riferiscono agli ID stabili dell’applicazione.

## Privacy by design

Il modello MVP richiede soltanto:

- UUID interno;
- nickname o nome visualizzato breve;
- ruolo;
- appartenenza alla squadra;
- dati didattici strettamente necessari.

Non sono previsti indirizzo, telefono, data di nascita, email mostrata al coach, fotografie reali o dati familiari. `avatar_path` è pensato per un bucket privato, non per URL pubblici esterni. Il mock usa esclusivamente nickname sintetici.

## Ruoli e RLS

La migration abilita RLS su tutte le tabelle pubbliche e revoca i privilegi impliciti prima di concedere quelli minimi:

- il **player** legge i propri record e può avanzare soltanto i propri progressi/video nella squadra attiva;
- il **coach** legge i giocatori attivi appartenenti alle proprie squadre;
- il frontend non può cambiare ruoli o membership;
- `points_earned`, tentativi quiz e trofei restano affidati a processi trusted;
- non è esposto alcun accesso `anon`;
- non esistono operazioni `DELETE` dal client.

Gli helper `SECURITY DEFINER` sono nello schema `private`, con `search_path = ''`, e impediscono la ricorsione delle policy su `team_members`. Lo schema `private` non deve essere aggiunto agli Exposed Schemas di Supabase. Il trigger di creazione profilo forza sempre `player` e ignora eventuali ruoli contenuti nei metadata utente.

RLS e grant devono essere entrambi corretti: la policy decide quali righe sono visibili, mentre i privilegi SQL decidono quali operazioni/colonne sono permesse. Riferimenti ufficiali: [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security), [sicurezza delle API](https://supabase.com/docs/guides/api/securing-your-api) e [gestione dei dati utente](https://supabase.com/docs/guides/auth/managing-user-data).

## Tracking video

Il Player registra localmente soltanto:

- `started` al primo play;
- `25`, `50`, `75` al superamento delle soglie;
- `100` sull’evento `ended` dopo almeno il 95% di riproduzione accumulata.

Non viene scritto un evento ogni secondo. Il tempo riprodotto viene accumulato in memoria, i salti del cursore non assegnano automaticamente i checkpoint attraversati e solo le soglie vengono persistite. La chiave logica è `lessonId + variantId`, quindi due varianti della stessa lezione restano distinguibili. Il completamento video non completa automaticamente la lezione: il comportamento manuale Player rimane invariato.

Nel database `last_checkpoint` usa `0` per lo stato “iniziato/non ancora al 25%” e i trigger impediscono regressioni di percentuale o checkpoint.

## Quiz futuri

Il tipo `Lesson.quiz` è opzionale e supporta 2–3 domande a scelta multipla, risposta corretta e breve feedback. Nessuna domanda reale è stata inventata in questa fase.

La tabella `quiz_attempts` calcola `score` da `correct_answers / total_questions`. La dashboard è già predisposta per media, corrette/totale, percentuale e numero di tentativi. Prima dell’uso reale, la correzione deve avvenire tramite una funzione/RPC trusted: il browser non deve potersi assegnare autonomamente un punteggio.

## Collegamento a Supabase

Variabili richieste:

```dotenv
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

Usare la publishable key nel browser; non inserire mai `service_role` o secret key in variabili `VITE_*`. Vedere [API keys](https://supabase.com/docs/guides/getting-started/api-keys), [inizializzazione del client JavaScript](https://supabase.com/docs/reference/javascript/initializing) e [supporto TypeScript](https://supabase.com/docs/reference/javascript/typescript-support).

Passaggi successivi:

1. creare un progetto Supabase e applicare la migration;
2. verificare che `private` non sia esposto;
3. configurare Auth e un provisioning trusted per coach, squadra e membership;
4. generare i tipi dal database e confrontarli con `src/types/database.ts`;
5. impostare le due variabili su Vercel Preview;
6. istanziare `createSupabaseCoachRepository(teamId)` solo dopo una sessione Coach valida;
7. aggiungere il repository/sync Player mantenendo localStorage come cache/fallback controllato.

## Stato reale e stato mock

Funziona realmente in questa iterazione:

- routing e navigazione Coach;
- tutti i calcoli del read model a partire da record normalizzati;
- filtri, schede giocatore e aggregati per lezione;
- Player App e storage storico;
- lettura e riproduzione delle varianti video;
- salvataggio locale dei checkpoint video;
- client e repository Supabase compilabili;
- schema, grant e policy RLS versionati.

Usa ancora dati mock:

- rosa e nickname Coach;
- assegnazioni e progressi mostrati in `/coach`;
- risultati quiz, punti, trofei e attività della dashboard.

## Prima di testare con utenti reali

- applicare la migration a un database di test e poi a quello target;
- aggiungere test RLS/pgTAP per player, coach, cross-team e membership inattive;
- implementare login e provisioning con consenso e procedure adeguate ai minori;
- definire retention, informativa privacy, ruoli organizzativi e processo di cancellazione;
- rendere autorevoli punti, quiz e trofei con RPC/Edge Function server-side;
- aggiungere idempotenza e rate limiting per `activity_events`;
- validare nel database gli ID del catalogo o sincronizzare un catalogo autorevole;
- testare migrazione e sincronizzazione dal progresso locale esistente;
- verificare accessibilità, dispositivi reali e comportamento offline.

La migration è stata revisionata staticamente. In questo ambiente non sono disponibili credenziali né un database Supabase su cui eseguire `migration up`; build TypeScript e lint non validano l’esecuzione effettiva delle policy SQL.
