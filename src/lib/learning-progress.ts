import type { Lesson, LessonProgressStatus } from '../data/lessons';
import { trophies, type Trophy } from '../data/trophies';

export const learningProgressStorageKey = 'esordienti-analyst:learning-progress';

export type StoredLessonProgress = {
  startedAt: string;
  completedAt?: string;
  pointsAwarded?: number;
};

export type StoredLearningProgress = {
  schemaVersion: 1;
  ownerId: string;
  lessonProgress: Record<string, StoredLessonProgress>;
  trophyUnlocks: Record<string, { unlockedAt: string }>;
  updatedAt: string;
};

export type LearningSummary = {
  completedLessonIds: readonly string[];
  inProgressLessonIds: readonly string[];
  completedLessonCount: number;
  availableLessonCount: number;
  todoLessonCount: number;
  totalPoints: number;
  overallProgress: number;
  unlockedTrophyIds: readonly string[];
  unlockedTrophyCount: number;
  nextLessonId?: string;
};

export type TrophyRuleProgress = {
  current: number;
  target: number;
  percentage: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nowIso() {
  return new Date().toISOString();
}

export function createInitialLearningProgress(
  updatedAt = nowIso(),
): StoredLearningProgress {
  return {
    schemaVersion: 1,
    ownerId: 'local-device',
    lessonProgress: {},
    trophyUnlocks: {},
    updatedAt,
  };
}

export function parseLearningProgress(serialized: string | null): StoredLearningProgress {
  if (!serialized) return createInitialLearningProgress();

  try {
    const value: unknown = JSON.parse(serialized);
    if (!isRecord(value) || value.schemaVersion !== 1) {
      return createInitialLearningProgress();
    }

    const lessonProgress: Record<string, StoredLessonProgress> = {};
    if (isRecord(value.lessonProgress)) {
      for (const [lessonId, rawProgress] of Object.entries(value.lessonProgress)) {
        if (!isRecord(rawProgress) || typeof rawProgress.startedAt !== 'string') continue;

        lessonProgress[lessonId] = {
          startedAt: rawProgress.startedAt,
          ...(typeof rawProgress.completedAt === 'string'
            ? { completedAt: rawProgress.completedAt }
            : {}),
          ...(typeof rawProgress.pointsAwarded === 'number' &&
          Number.isFinite(rawProgress.pointsAwarded) &&
          rawProgress.pointsAwarded >= 0
            ? { pointsAwarded: rawProgress.pointsAwarded }
            : {}),
        };
      }
    }

    const trophyUnlocks: Record<string, { unlockedAt: string }> = {};
    if (isRecord(value.trophyUnlocks)) {
      for (const [trophyId, rawUnlock] of Object.entries(value.trophyUnlocks)) {
        if (isRecord(rawUnlock) && typeof rawUnlock.unlockedAt === 'string') {
          trophyUnlocks[trophyId] = { unlockedAt: rawUnlock.unlockedAt };
        }
      }
    }

    return {
      schemaVersion: 1,
      ownerId: 'local-device',
      lessonProgress,
      trophyUnlocks,
      updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : nowIso(),
    };
  } catch {
    return createInitialLearningProgress();
  }
}

export function getLessonProgressStatus(
  progress: StoredLearningProgress,
  lessonId: string,
): LessonProgressStatus {
  const lessonProgress = progress.lessonProgress[lessonId];
  if (lessonProgress?.completedAt) return 'completata';
  if (lessonProgress?.startedAt) return 'in_corso';
  return 'da_fare';
}

function completedLessonIds(progress: StoredLearningProgress) {
  return new Set(
    Object.entries(progress.lessonProgress)
      .filter(([, value]) => Boolean(value.completedAt))
      .map(([lessonId]) => lessonId),
  );
}

function pointsTotal(progress: StoredLearningProgress) {
  return Object.values(progress.lessonProgress).reduce(
    (total, item) => total + (item.completedAt ? (item.pointsAwarded ?? 0) : 0),
    0,
  );
}

function trophyRuleIsSatisfied(
  trophy: Trophy,
  progress: StoredLearningProgress,
  catalog: readonly Lesson[],
) {
  const availableLessons = catalog.filter(
    (lesson) => lesson.disponibilita === 'disponibile',
  );
  const completedIds = completedLessonIds(progress);

  switch (trophy.rule.kind) {
    case 'completed_lessons':
      return availableLessons.filter((lesson) => completedIds.has(lesson.id)).length >= trophy.rule.minimum;
    case 'complete_phase': {
      const { phase } = trophy.rule;
      const phaseLessons = availableLessons.filter(
        (lesson) => lesson.fase === phase,
      );
      return phaseLessons.length > 0 && phaseLessons.every((lesson) => completedIds.has(lesson.id));
    }
    case 'points':
      return pointsTotal(progress) >= trophy.rule.minimum;
    case 'complete_macro': {
      const { macroFase, minimum } = trophy.rule;
      return (
        availableLessons.filter(
          (lesson) =>
            lesson.macroFase === macroFase && completedIds.has(lesson.id),
        ).length >= minimum
      );
    }
  }
}

export function reconcileTrophyUnlocks(
  progress: StoredLearningProgress,
  catalog: readonly Lesson[],
  unlockedAt = nowIso(),
): StoredLearningProgress {
  let changed = false;
  const trophyUnlocks = { ...progress.trophyUnlocks };

  for (const trophy of trophies) {
    if (trophyUnlocks[trophy.id] || !trophyRuleIsSatisfied(trophy, progress, catalog)) {
      continue;
    }

    trophyUnlocks[trophy.id] = { unlockedAt };
    changed = true;
  }

  return changed
    ? { ...progress, trophyUnlocks, updatedAt: unlockedAt }
    : progress;
}

export function startLessonProgress(
  progress: StoredLearningProgress,
  lessonId: string,
  startedAt = nowIso(),
): StoredLearningProgress {
  const current = progress.lessonProgress[lessonId];
  if (current?.startedAt || current?.completedAt) return progress;

  return {
    ...progress,
    lessonProgress: {
      ...progress.lessonProgress,
      [lessonId]: { startedAt },
    },
    updatedAt: startedAt,
  };
}

export function completeLessonProgress(
  progress: StoredLearningProgress,
  lessonId: string,
  catalog: readonly Lesson[],
  completedAt = nowIso(),
): StoredLearningProgress {
  const lesson = catalog.find((candidate) => candidate.id === lessonId);
  if (!lesson || lesson.disponibilita !== 'disponibile') return progress;

  const current = progress.lessonProgress[lessonId];
  if (current?.completedAt) return progress;

  const nextProgress: StoredLearningProgress = {
    ...progress,
    lessonProgress: {
      ...progress.lessonProgress,
      [lessonId]: {
        startedAt: current?.startedAt ?? completedAt,
        completedAt,
        pointsAwarded: lesson.punti,
      },
    },
    updatedAt: completedAt,
  };

  return reconcileTrophyUnlocks(nextProgress, catalog, completedAt);
}

export function selectLearningSummary(
  progress: StoredLearningProgress,
  catalog: readonly Lesson[],
): LearningSummary {
  const availableLessons = catalog.filter(
    (lesson) => lesson.disponibilita === 'disponibile',
  );
  const completedIds = completedLessonIds(progress);
  const completed = availableLessons.filter((lesson) => completedIds.has(lesson.id));
  const inProgress = availableLessons.filter(
    (lesson) =>
      !completedIds.has(lesson.id) && Boolean(progress.lessonProgress[lesson.id]?.startedAt),
  );
  const nextLesson =
    inProgress[0] ?? availableLessons.find((lesson) => !completedIds.has(lesson.id));
  const availableLessonCount = availableLessons.length;
  const completedLessonCount = completed.length;

  return {
    completedLessonIds: completed.map((lesson) => lesson.id),
    inProgressLessonIds: inProgress.map((lesson) => lesson.id),
    completedLessonCount,
    availableLessonCount,
    todoLessonCount: Math.max(availableLessonCount - completedLessonCount, 0),
    totalPoints: pointsTotal(progress),
    overallProgress:
      availableLessonCount === 0
        ? 0
        : Math.round((completedLessonCount / availableLessonCount) * 100),
    unlockedTrophyIds: Object.keys(progress.trophyUnlocks),
    unlockedTrophyCount: Object.keys(progress.trophyUnlocks).length,
    nextLessonId: nextLesson?.id,
  };
}

export function getTrophyRuleProgress(
  trophy: Trophy,
  progress: StoredLearningProgress,
  catalog: readonly Lesson[],
): TrophyRuleProgress {
  const availableLessons = catalog.filter(
    (lesson) => lesson.disponibilita === 'disponibile',
  );
  const completedIds = completedLessonIds(progress);
  let current = 0;
  let target = 1;

  switch (trophy.rule.kind) {
    case 'completed_lessons':
      current = availableLessons.filter((lesson) => completedIds.has(lesson.id)).length;
      target = trophy.rule.minimum;
      break;
    case 'complete_phase': {
      const { phase } = trophy.rule;
      const phaseLessons = availableLessons.filter(
        (lesson) => lesson.fase === phase,
      );
      current = phaseLessons.filter((lesson) => completedIds.has(lesson.id)).length;
      target = Math.max(phaseLessons.length, 1);
      break;
    }
    case 'points':
      current = pointsTotal(progress);
      target = trophy.rule.minimum;
      break;
    case 'complete_macro': {
      const { macroFase, minimum } = trophy.rule;
      current = availableLessons.filter(
        (lesson) =>
          lesson.macroFase === macroFase && completedIds.has(lesson.id),
      ).length;
      target = minimum;
      break;
    }
  }

  return {
    current: Math.min(current, target),
    target,
    percentage: Math.min(Math.round((current / target) * 100), 100),
  };
}
