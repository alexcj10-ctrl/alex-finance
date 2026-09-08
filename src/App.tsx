/* oxlint-disable next/no-img-element -- Vite app: the official local crest is served as a static asset. */
import { useState, type ComponentType } from 'react';
import { BookOpen, CircleDot, Home, Trophy } from 'lucide-react';

import { cn } from '@/lib/utils';
import { DashboardHome } from './components/DashboardHome';
import { LessonsSection } from './components/LessonsSection';
import { TrophiesSection } from './components/TrophiesSection';
import { lessons } from './data/lessons';
import { useLearningProgress } from './hooks/useLearningProgress';

type AppView = 'home' | 'lezioni' | 'trofei';

type NavigationItem = {
  id: AppView;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

const navigationItems: readonly NavigationItem[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'lezioni', label: 'Lezioni', icon: BookOpen },
  { id: 'trofei', label: 'Trofei', icon: Trophy },
];

export default function App() {
  const [activeView, setActiveView] = useState<AppView>('home');
  const [focusedLessonId, setFocusedLessonId] = useState<string | undefined>();
  const progress = useLearningProgress(lessons);
  const missionLesson = lessons.find(
    (lesson) => lesson.id === progress.summary.nextLessonId,
  );

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

  return (
    <div className="app-frame min-h-screen bg-background text-foreground">
      <a className="skip-link" href="#main-content">
        Vai al contenuto
      </a>

      <header className="app-header">
        <div className="page-width app-header-inner">
          <button
            type="button"
            className="brand-button"
            aria-label="Vai alla Home"
            onClick={() => navigateTo('home')}
          >
            <span className="brand-mark" aria-hidden="true">
              <img src="/images/poggio-mirteto-logo.png" alt="" />
            </span>
            <span className="brand-copy">
              <span className="brand-team">Poggio Mirteto Calcio</span>
              <span className="brand-product">ESORDIENTI ANALYST</span>
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
                <item.icon className="size-4" aria-hidden="true" />
                {item.label}
              </button>
            ))}
          </nav>

          <span className="sport-badge">
            <CircleDot className="size-4" aria-hidden="true" /> 1-3-2-3
          </span>
        </div>
      </header>

      <main id="main-content" className="app-main page-width" tabIndex={-1}>
        {activeView === 'home' ? (
          <DashboardHome
            lessons={lessons}
            missionLesson={missionLesson}
            summary={progress.summary}
            getLessonStatus={progress.getLessonStatus}
            onOpenLesson={openLesson}
            onOpenLessons={() => navigateTo('lezioni')}
            onOpenTrophies={() => navigateTo('trofei')}
          />
        ) : null}

        {activeView === 'lezioni' ? (
          <LessonsSection
            key={focusedLessonId ?? 'lesson-hub'}
            lessons={lessons}
            initialLessonId={focusedLessonId}
            getLessonStatus={progress.getLessonStatus}
            onLessonStarted={progress.startLesson}
            onCompleteLesson={progress.completeLesson}
          />
        ) : null}

        {activeView === 'trofei' ? (
          <TrophiesSection progress={progress.progress} summary={progress.summary} />
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
            <item.icon className="size-5" aria-hidden="true" />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
