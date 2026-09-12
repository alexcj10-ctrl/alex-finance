import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { AuthIdentity } from '../auth/auth-types';
import type { Lesson } from '../data/lessons';
import {
  createInitialLearningProgress,
  getLessonProgressStatus,
  selectLearningSummary,
} from '../lib/learning-progress';
import {
  completePlayerLesson,
  loadPlayerLearningSnapshot,
  recordPlayerLogin,
  recordPlayerVideoCheckpoint,
  startPlayerLesson,
  type PlayerLearningSnapshot,
} from '../services/supabase/supabase-player-repository';
import type { VideoProgressCheckpointInput } from '../types/video-progress';

const emptySnapshot: PlayerLearningSnapshot = {
  progress: createInitialLearningProgress(),
  assignedLessonIds: [],
  videos: [],
};

export function useLearningProgress(
  catalog: readonly Lesson[],
  identity: AuthIdentity,
) {
  const [snapshot, setSnapshot] = useState<PlayerLearningSnapshot>(emptySnapshot);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const mountedRef = useRef(true);

  useEffect(() => () => {
    mountedRef.current = false;
  }, []);

  const refresh = useCallback(async () => {
    try {
      const next = await loadPlayerLearningSnapshot(identity);
      if (!mountedRef.current) return;
      setSnapshot(next);
      setError(undefined);
    } catch (loadError) {
      if (!mountedRef.current) return;
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Impossibile caricare il tuo percorso.',
      );
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [identity]);

  useEffect(() => {
    void loadPlayerLearningSnapshot(identity).then(
      (next) => {
        if (!mountedRef.current) return;
        setSnapshot(next);
        setError(undefined);
        setLoading(false);
      },
      (loadError: unknown) => {
        if (!mountedRef.current) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Impossibile caricare il tuo percorso.',
        );
        setLoading(false);
      },
    );
    void recordPlayerLogin(identity).catch(() => {
      // Il riepilogo resta utilizzabile se la telemetria di accesso non parte.
    });
  }, [identity]);

  const startLesson = useCallback(async (lessonId: string) => {
    setError(undefined);
    try {
      await startPlayerLesson(identity, lessonId);
      await refresh();
    } catch (mutationError) {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : 'Non siamo riusciti ad avviare la lezione.',
      );
      throw mutationError;
    }
  }, [identity, refresh]);

  const completeLesson = useCallback(async (lessonId: string) => {
    setError(undefined);
    try {
      await completePlayerLesson(identity, lessonId);
      await refresh();
    } catch (mutationError) {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : 'Non siamo riusciti a completare la lezione.',
      );
      throw mutationError;
    }
  }, [identity, refresh]);

  const recordVideoCheckpoint = useCallback(async (
    input: VideoProgressCheckpointInput,
  ) => {
    setError(undefined);
    try {
      const record = await recordPlayerVideoCheckpoint(identity, input);
      if (mountedRef.current) {
        setSnapshot((current) => ({
          ...current,
          videos: [
            ...current.videos.filter(
              (video) =>
                video.lessonId !== record.lessonId || video.variantId !== record.variantId,
            ),
            record,
          ],
        }));
      }
      return record;
    } catch (mutationError) {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : 'Non siamo riusciti a sincronizzare il video.',
      );
      throw mutationError;
    }
  }, [identity]);

  const assignedIds = useMemo(
    () => new Set(snapshot.assignedLessonIds),
    [snapshot.assignedLessonIds],
  );
  const assignedLessons = useMemo(
    () => catalog.filter((lesson) => assignedIds.has(lesson.id)),
    [assignedIds, catalog],
  );
  const getLessonStatus = useCallback(
    (lessonId: string) => getLessonProgressStatus(snapshot.progress, lessonId),
    [snapshot.progress],
  );
  const getVideoProgress = useCallback(
    (lessonId: string, variantId: string) => snapshot.videos.find(
      (video) => video.lessonId === lessonId && video.variantId === variantId,
    ),
    [snapshot.videos],
  );
  const summary = useMemo(
    () => selectLearningSummary(snapshot.progress, assignedLessons),
    [assignedLessons, snapshot.progress],
  );

  return {
    progress: snapshot.progress,
    assignedLessons,
    summary,
    loading,
    error,
    getLessonStatus,
    getVideoProgress,
    recordVideoCheckpoint,
    refresh,
    startLesson,
    completeLesson,
  };
}
