/* oxlint-disable next/no-img-element -- Vite app: the official local crest is served as a static asset. */
import {
  Blocks,
  Check,
  Flame,
  Lock,
  Medal,
  ShieldCheck,
  Star,
  Trophy,
  Users,
  type LucideIcon,
} from 'lucide-react';

import { Progress, ProgressLabel, ProgressValue } from '@/components/ui/progress';
import { lessons } from '../data/lessons';
import { trophies, type TrophyIconId } from '../data/trophies';
import {
  getTrophyRuleProgress,
  type LearningSummary,
  type StoredLearningProgress,
} from '../lib/learning-progress';

const trophyIcons: Record<TrophyIconId, LucideIcon> = {
  medal: Medal,
  blocks: Blocks,
  flame: Flame,
  star: Star,
  shield: ShieldCheck,
};

type DemoRankingPlayer = {
  position: number;
  name: string;
  points: number;
  trophies: number;
  lessons: number;
  current?: boolean;
};

const demoRanking: readonly DemoRankingPlayer[] = [
  { position: 1, name: 'Giocatore A', points: 180, trophies: 4, lessons: 6 },
  { position: 2, name: 'Tu', points: 120, trophies: 3, lessons: 4, current: true },
  { position: 3, name: 'Giocatore B', points: 95, trophies: 2, lessons: 3 },
] as const;

type TrophiesSectionProps = {
  progress: StoredLearningProgress;
  summary: LearningSummary;
};

export function TrophiesSection({ progress, summary }: TrophiesSectionProps) {
  const trophyItems = trophies.map((trophy) => ({
    trophy,
    isUnlocked: summary.unlockedTrophyIds.includes(trophy.id),
    ruleProgress: getTrophyRuleProgress(trophy, progress, lessons),
  }));
  const nextTrophy = trophyItems.find((item) => !item.isUnlocked);

  return (
    <div className="trophies-view view-shell">
      <header className="view-heading trophies-heading">
        <div>
          <p className="section-kicker">Le tue conquiste</p>
          <h1>Trofei</h1>
        </div>
        <span className="trophy-total">
          <Star className="size-4 fill-current" aria-hidden="true" />
          {summary.totalPoints} punti
        </span>
      </header>

      <section className="trophy-hero" aria-labelledby="trophy-progress-title">
        <img
          className="trophy-crest"
          src="/images/poggio-mirteto-logo.png"
          alt="Stemma del Poggio Mirteto Calcio"
        />
        <div className="trophy-hero-copy">
          <span className="trophy-count" aria-label={`${summary.unlockedTrophyCount} trofei sbloccati`}>
            <Trophy className="size-6" aria-hidden="true" />
            <strong>{summary.unlockedTrophyCount}</strong>
            <small>su {trophies.length}</small>
          </span>
          <Progress value={(summary.unlockedTrophyCount / trophies.length) * 100}>
            <ProgressLabel id="trophy-progress-title">Collezione</ProgressLabel>
            <ProgressValue>
              {() => `${summary.unlockedTrophyCount}/${trophies.length}`}
            </ProgressValue>
          </Progress>
        </div>
      </section>

      {nextTrophy ? (
        <section className="next-trophy" aria-labelledby="next-trophy-title">
          <span className="next-trophy-icon" aria-hidden="true">
            <Lock className="size-5" />
          </span>
          <div className="next-trophy-copy">
            <small>Prossimo obiettivo</small>
            <strong id="next-trophy-title">{nextTrophy.trophy.titolo}</strong>
            <Progress value={nextTrophy.ruleProgress.percentage}>
              <ProgressLabel>{nextTrophy.trophy.descrizione}</ProgressLabel>
              <ProgressValue>
                {() => `${nextTrophy.ruleProgress.current}/${nextTrophy.ruleProgress.target}`}
              </ProgressValue>
            </Progress>
          </div>
        </section>
      ) : null}

      <section className="trophy-section" aria-labelledby="collection-title">
        <header className="section-heading">
          <div>
            <p className="section-kicker">Sfide</p>
            <h2 id="collection-title">La tua collezione</h2>
          </div>
        </header>

        <div className="trophy-grid">
          {trophyItems.map(({ trophy, isUnlocked, ruleProgress }) => {
            const Icon = trophyIcons[trophy.icon];

            return (
              <article
                key={trophy.id}
                className={isUnlocked ? 'trophy-card trophy-card-unlocked' : 'trophy-card'}
              >
                <span className="trophy-card-icon" aria-hidden="true">
                  <Icon className="size-7" />
                  <span className="trophy-card-state">
                    {isUnlocked ? <Check className="size-3.5" /> : <Lock className="size-3.5" />}
                  </span>
                </span>
                <div className="trophy-card-copy">
                  <span className="trophy-status">
                    {isUnlocked ? 'Sbloccato' : 'Bloccato'}
                  </span>
                  <h3>{trophy.titolo}</h3>
                  <p>{trophy.descrizione}</p>
                  <Progress value={ruleProgress.percentage} aria-label={`Progresso ${trophy.titolo}`}>
                    <ProgressValue>
                      {() => `${ruleProgress.current}/${ruleProgress.target}`}
                    </ProgressValue>
                  </Progress>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="ranking-preview" aria-labelledby="ranking-title">
        <header className="ranking-header">
          <span className="ranking-icon" aria-hidden="true">
            <Users className="size-6" />
          </span>
          <div>
            <span className="coming-soon-badge">Anteprima · In arrivo</span>
            <h2 id="ranking-title">Classifica squadra</h2>
          </div>
        </header>

        <table className="ranking-table" aria-label="Esempio futuro della classifica squadra">
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Giocatore</th>
              <th scope="col">PT</th>
              <th scope="col">TR</th>
              <th scope="col">LEZ</th>
            </tr>
          </thead>
          <tbody>
            {demoRanking.map((player) => (
              <tr key={player.position} className={player.current ? 'ranking-row-current' : undefined}>
                <td><strong>{player.position}</strong></td>
                <td>{player.name}</td>
                <td>{player.points}</td>
                <td>{player.trophies}</td>
                <td>{player.lessons}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="ranking-note">Dati dimostrativi · Nessun giocatore reale</p>
      </section>
    </div>
  );
}
