import { useEffect, useState, type ComponentType } from 'react';
import { BookOpen, Home, Layers3, Library } from 'lucide-react';

import { cn } from '@/lib/utils';
import { ConceptLibrary } from './components/ConceptLibrary';
import { DashboardHome } from './components/DashboardHome';
import { LessonsSection } from './components/LessonsSection';
import {
  formationOrder,
  phaseOrder,
  TacticalBoard,
} from './components/TacticalBoard';
import { lessons, type FormationId, type PhaseId } from './data/lessons';

type AppView = 'home' | 'lezioni' | 'biblioteca' | 'lavagna';

type NavigationItem = {
  id: AppView;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

const navigationItems: readonly NavigationItem[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'lezioni', label: 'Lezioni', icon: BookOpen },
  { id: 'biblioteca', label: 'Biblioteca', icon: Library },
  { id: 'lavagna', label: 'Lavagna', icon: Layers3 },
];

export default function App() {
  const [activeView, setActiveView] = useState<AppView>('home');
  const [focusedLessonId, setFocusedLessonId] = useState<string | undefined>();
  const [activePhase, setActivePhase] = useState<PhaseId>('costruzione');
  const [activeFormation, setActiveFormation] = useState<FormationId>('1-3-2-3');

  const missionLesson = lessons.find(
    (lesson) => lesson.stato === 'disponibile' && lesson.demo === false,
  );
  const availableLessons = lessons.filter((lesson) => lesson.stato === 'disponibile');

  const openLesson = (lessonId: string) => {
    setFocusedLessonId(lessonId);
    setActiveView('lezioni');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateTo = (view: AppView) => {
    if (view === 'lezioni') setFocusedLessonId(undefined);
    setActiveView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const modelContext = (
      document as Document & {
        modelContext?: {
          registerTool: (
            tool: {
              name: string;
              title: string;
              description: string;
              inputSchema: object;
              annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
              execute: (input: unknown) => Promise<unknown>;
            },
            options: { signal: AbortSignal },
          ) => void | Promise<void>;
        };
      }
    ).modelContext;

    if (!modelContext?.registerTool) return;

    const lifecycle = new AbortController();
    const validPhases = phaseOrder as readonly string[];
    const validFormations = formationOrder as readonly string[];

    void Promise.resolve(
      modelContext.registerTool(
        {
          name: 'configura_scenario_tattico',
          title: 'Configura scenario tattico',
          description:
            'Apre la Lavagna e imposta la fase e il sistema di gioco mostrati da ESORDIENTI ANALYST.',
          inputSchema: {
            type: 'object',
            properties: {
              fase: { type: 'string', enum: phaseOrder },
              sistema: { type: 'string', enum: formationOrder },
            },
            required: ['fase', 'sistema'],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          async execute(input) {
            const candidate = input as { fase?: string; sistema?: string };

            if (!validPhases.includes(candidate.fase ?? '')) {
              throw new Error('Fase non valida.');
            }
            if (!validFormations.includes(candidate.sistema ?? '')) {
              throw new Error('Sistema non valido.');
            }

            setActivePhase(candidate.fase as PhaseId);
            setActiveFormation(candidate.sistema as FormationId);
            setActiveView('lavagna');
            await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

            return {
              stato: 'configurato',
              fase: candidate.fase,
              sistema: candidate.sistema,
            };
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(() => undefined);

    return () => lifecycle.abort();
  }, []);

  return (
    <div className="app-frame min-h-screen bg-background text-foreground">
      <header className="app-header">
        <div className="page-width app-header-inner">
          <button
            type="button"
            className="brand-button"
            aria-label="Vai alla Home"
            onClick={() => navigateTo('home')}
          >
            <span className="brand-mark" aria-hidden="true">
              EA
            </span>
            <span className="min-w-0 text-left">
              <span className="block truncate text-sm font-black tracking-[-0.02em]">
                ESORDIENTI ANALYST
              </span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Percorso tecnico U13
              </span>
            </span>
          </button>

          <nav className="desktop-navigation" aria-label="Navigazione principale">
            {navigationItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={cn('app-nav-button', activeView === item.id && 'app-nav-button-active')}
                aria-current={activeView === item.id ? 'page' : undefined}
                onClick={() => navigateTo(item.id)}
              >
                <item.icon className="size-4" />
                {item.label}
              </button>
            ))}
          </nav>

          <span className="sport-badge">Calcio a 9</span>
        </div>
      </header>

      <main className="app-main page-width" tabIndex={-1}>
        {activeView === 'home' ? (
          <DashboardHome
            missionLesson={missionLesson}
            availableLessons={availableLessons}
            onOpenLesson={openLesson}
            onOpenLessons={() => navigateTo('lezioni')}
            onOpenLibrary={() => navigateTo('biblioteca')}
          />
        ) : null}

        {activeView === 'lezioni' ? (
          <LessonsSection
            key={focusedLessonId ?? 'lesson-catalog'}
            lessons={lessons}
            initialLessonId={focusedLessonId}
          />
        ) : null}

        {activeView === 'biblioteca' ? <ConceptLibrary /> : null}

        {activeView === 'lavagna' ? (
          <TacticalBoard
            activePhase={activePhase}
            activeFormation={activeFormation}
            onPhaseChange={setActivePhase}
            onFormationChange={setActiveFormation}
          />
        ) : null}
      </main>

      <nav className="mobile-navigation" aria-label="Navigazione principale mobile">
        {navigationItems.map((item) => (
          <button
            key={item.id}
            type="button"
            className={cn('mobile-nav-button', activeView === item.id && 'mobile-nav-button-active')}
            aria-current={activeView === item.id ? 'page' : undefined}
            onClick={() => navigateTo(item.id)}
          >
            <item.icon className="size-5" />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
