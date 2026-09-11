export type VideoProgressCheckpoint = 'started' | 25 | 50 | 75 | 100;

export type StoredVideoProgress = {
  lessonId: string;
  variantId: string;
  watchedPercent: number;
  lastPositionSeconds: number;
  completed: boolean;
  reachedCheckpoints: readonly VideoProgressCheckpoint[];
  updatedAt: string;
};

export type StoredVideoProgressCollection = {
  schemaVersion: 1;
  ownerId: 'local-device';
  records: Record<string, StoredVideoProgress>;
};

export type VideoProgressCheckpointInput = {
  lessonId: string;
  variantId: string;
  checkpoint: VideoProgressCheckpoint;
  watchedPercent: number;
  lastPositionSeconds: number;
};
