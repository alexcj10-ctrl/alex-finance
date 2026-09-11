import { useCallback, useRef } from 'react';

import {
  localVideoProgressRepository,
  type VideoProgressRepository,
} from '../services/video-progress-repository';
import type { VideoProgressCheckpoint } from '../types/video-progress';

const percentageCheckpoints = [25, 50, 75] as const;

export function useVideoProgressTracking(
  lessonId: string,
  variantId: string,
  repository: VideoProgressRepository = localVideoProgressRepository,
) {
  const reachedRef = useRef<Set<VideoProgressCheckpoint>>(new Set());
  const activeKeyRef = useRef('');
  const activeRepositoryRef = useRef<VideoProgressRepository | undefined>(undefined);
  const lastPlaybackTimeRef = useRef<number | undefined>(undefined);
  const watchedSecondsRef = useRef<number | undefined>(undefined);
  const storedPercentRef = useRef(0);
  const activeKey = `${lessonId}::${variantId}`;

  const ensureActiveVariant = useCallback(() => {
    if (activeKeyRef.current === activeKey && activeRepositoryRef.current === repository) return;
    const stored = repository.get(lessonId, variantId);
    activeKeyRef.current = activeKey;
    activeRepositoryRef.current = repository;
    reachedRef.current = new Set(stored?.reachedCheckpoints ?? []);
    storedPercentRef.current = stored?.watchedPercent ?? 0;
    watchedSecondsRef.current = undefined;
    lastPlaybackTimeRef.current = undefined;
  }, [activeKey, lessonId, repository, variantId]);

  const readPlayback = useCallback((video: HTMLVideoElement) => {
    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
    const position = Number.isFinite(video.currentTime) ? Math.max(video.currentTime, 0) : 0;
    if (duration === 0) return { duration, position, watchedPercent: storedPercentRef.current };

    if (watchedSecondsRef.current === undefined) {
      watchedSecondsRef.current = (storedPercentRef.current / 100) * duration;
    }

    const previousPosition = lastPlaybackTimeRef.current;
    if (previousPosition !== undefined) {
      const elapsed = position - previousPosition;
      if (elapsed > 0) {
        watchedSecondsRef.current = Math.min(watchedSecondsRef.current + elapsed, duration);
      }
    }
    lastPlaybackTimeRef.current = position;

    return {
      duration,
      position,
      watchedPercent: Math.min(Math.floor((watchedSecondsRef.current / duration) * 100), 100),
    };
  }, []);

  const persist = useCallback(
    (checkpoint: VideoProgressCheckpoint, video: HTMLVideoElement) => {
      ensureActiveVariant();
      if (reachedRef.current.has(checkpoint)) return;

      reachedRef.current.add(checkpoint);
      const playback = readPlayback(video);
      repository.recordCheckpoint({
        lessonId,
        variantId,
        checkpoint,
        watchedPercent: checkpoint === 100 ? 100 : playback.watchedPercent,
        lastPositionSeconds: playback.position,
      });
      storedPercentRef.current = checkpoint === 100 ? 100 : playback.watchedPercent;
    },
    [ensureActiveVariant, lessonId, readPlayback, repository, variantId],
  );

  const onPlay = useCallback(
    (video: HTMLVideoElement) => {
      ensureActiveVariant();
      lastPlaybackTimeRef.current = Number.isFinite(video.currentTime) ? video.currentTime : 0;
      persist('started', video);
    },
    [ensureActiveVariant, persist],
  );

  const onTimeUpdate = useCallback(
    (video: HTMLVideoElement) => {
      ensureActiveVariant();
      const { watchedPercent } = readPlayback(video);
      for (const checkpoint of percentageCheckpoints) {
        if (watchedPercent >= checkpoint) persist(checkpoint, video);
      }
    },
    [ensureActiveVariant, persist, readPlayback],
  );

  const onEnded = useCallback(
    (video: HTMLVideoElement) => {
      ensureActiveVariant();
      const { watchedPercent } = readPlayback(video);
      if (watchedPercent >= 95) persist(100, video);
    },
    [ensureActiveVariant, persist, readPlayback],
  );

  const onSeeking = useCallback(() => {
    ensureActiveVariant();
    lastPlaybackTimeRef.current = undefined;
  }, [ensureActiveVariant]);

  return { onPlay, onTimeUpdate, onEnded, onSeeking };
}
