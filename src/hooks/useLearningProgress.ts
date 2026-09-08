import { useCallback, useEffect, useMemo, useState } from 'react';

import type { Lesson } from '../data/lessons';
import {
  completeLessonProgress,
  getLessonProgressStatus,
  learningProgressStorageKey,
  parseLearningProgress,
  reconcileTrophyUnlocks,
  selectLearningSummary,
  startLessonProgress,
  type StoredLearningProgress,
} from '../lib/learning-progress';

function readStoredProgress(catalog: readonly Lesson[]) {
  try {
    return reconcileTrophyUnlocks(
      parseLearningProgress(window.localStorage.getItem(learningProgressStorageKey)),
      catalog,
    );
  } catch {
    return parseLearningProgress(null);
  }
}

export function useLearningProgress(catalog: readonly Lesson[]) {
  const [progress, setProgress] = useState<StoredLearningProgress>(() =>
    readStoredProgress(catalog),
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(learningProgressStorageKey, JSON.stringify(progress));
    } catch {
      // L'app continua a funzionare in memoria quando lo storage non è disponibile.
    }
  }, [progress]);

  useEffect(() => {
    const syncAcrossTabs = (event: StorageEvent) => {
      if (event.key !== learningProgressStorageKey) return;
      setProgress(reconcileTrophyUnlocks(parseLearningProgress(event.newValue), catalog));
    };

    window.addEventListener('storage', syncAcrossTabs);
    return () => window.removeEventListener('storage', syncAcrossTabs);
  }, [catalog]);

  const startLesson = useCallback((lessonId: string) => {
    setProgress((current) => startLessonProgress(current, lessonId));
  }, []);

  const completeLesson = useCallback(
    (lessonId: string) => {
      setProgress((current) => completeLessonProgress(current, lessonId, catalog));
    },
    [catalog],
  );

  const getLessonStatus = useCallback(
    (lessonId: string) => getLessonProgressStatus(progress, lessonId),
    [progress],
  );

  const summary = useMemo(
    () => selectLearningSummary(progress, catalog),
    [catalog, progress],
  );

  return {
    progress,
    summary,
    getLessonStatus,
    startLesson,
    completeLesson,
  };
}
