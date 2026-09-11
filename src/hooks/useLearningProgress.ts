import { useCallback, useEffect, useMemo, useState } from 'react';

import type { Lesson } from '../data/lessons';
import {
  completeLessonProgress,
  getLessonProgressStatus,
  reconcileTrophyUnlocks,
  selectLearningSummary,
  startLessonProgress,
  type StoredLearningProgress,
} from '../lib/learning-progress';
import { localLearningProgressRepository } from '../services/learning-progress-repository';

export function useLearningProgress(catalog: readonly Lesson[]) {
  const [progress, setProgress] = useState<StoredLearningProgress>(() =>
    reconcileTrophyUnlocks(localLearningProgressRepository.read(), catalog),
  );

  useEffect(() => {
    localLearningProgressRepository.write(progress);
  }, [progress]);

  useEffect(() => {
    return localLearningProgressRepository.subscribe((nextProgress) => {
      setProgress(reconcileTrophyUnlocks(nextProgress, catalog));
    });
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
