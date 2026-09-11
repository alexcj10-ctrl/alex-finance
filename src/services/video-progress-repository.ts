import type {
  StoredVideoProgress,
  StoredVideoProgressCollection,
  VideoProgressCheckpoint,
  VideoProgressCheckpointInput,
} from '../types/video-progress';

export const videoProgressStorageKey = 'esordienti-analyst:video-progress';

const checkpointOrder: readonly VideoProgressCheckpoint[] = [
  'started',
  25,
  50,
  75,
  100,
];

export type VideoProgressRepository = {
  get: (lessonId: string, variantId: string) => StoredVideoProgress | undefined;
  recordCheckpoint: (input: VideoProgressCheckpointInput) => StoredVideoProgress;
};

function recordKey(lessonId: string, variantId: string) {
  return `${lessonId}::${variantId}`;
}

function emptyCollection(): StoredVideoProgressCollection {
  return { schemaVersion: 1, ownerId: 'local-device', records: {} };
}

function isCheckpoint(value: unknown): value is VideoProgressCheckpoint {
  return value === 'started' || value === 25 || value === 50 || value === 75 || value === 100;
}

function readCollection(): StoredVideoProgressCollection {
  try {
    const raw = window.localStorage.getItem(videoProgressStorageKey);
    if (!raw) return emptyCollection();

    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !('schemaVersion' in parsed)) {
      return emptyCollection();
    }

    const candidate = parsed as Partial<StoredVideoProgressCollection>;
    if (candidate.schemaVersion !== 1 || !candidate.records || typeof candidate.records !== 'object') {
      return emptyCollection();
    }

    const records: Record<string, StoredVideoProgress> = {};
    for (const [key, value] of Object.entries(candidate.records)) {
      if (
        !value ||
        typeof value !== 'object' ||
        typeof value.lessonId !== 'string' ||
        typeof value.variantId !== 'string' ||
        typeof value.watchedPercent !== 'number' ||
        typeof value.lastPositionSeconds !== 'number' ||
        typeof value.completed !== 'boolean' ||
        !Array.isArray(value.reachedCheckpoints) ||
        typeof value.updatedAt !== 'string'
      ) {
        continue;
      }

      records[key] = {
        ...value,
        watchedPercent: Math.min(Math.max(value.watchedPercent, 0), 100),
        lastPositionSeconds: Math.max(value.lastPositionSeconds, 0),
        reachedCheckpoints: value.reachedCheckpoints.filter(isCheckpoint),
      };
    }

    return { schemaVersion: 1, ownerId: 'local-device', records };
  } catch {
    return emptyCollection();
  }
}

function writeCollection(collection: StoredVideoProgressCollection) {
  try {
    window.localStorage.setItem(videoProgressStorageKey, JSON.stringify(collection));
  } catch {
    // Il video continua a funzionare anche se localStorage non è disponibile.
  }
}

export const localVideoProgressRepository: VideoProgressRepository = {
  get(lessonId, variantId) {
    return readCollection().records[recordKey(lessonId, variantId)];
  },
  recordCheckpoint(input) {
    const collection = readCollection();
    const key = recordKey(input.lessonId, input.variantId);
    const previous = collection.records[key];
    const reached = new Set(previous?.reachedCheckpoints ?? []);
    reached.add(input.checkpoint);

    const record: StoredVideoProgress = {
      lessonId: input.lessonId,
      variantId: input.variantId,
      watchedPercent: Math.max(previous?.watchedPercent ?? 0, input.watchedPercent),
      lastPositionSeconds: Math.max(input.lastPositionSeconds, 0),
      completed: previous?.completed === true || input.checkpoint === 100,
      reachedCheckpoints: checkpointOrder.filter((checkpoint) => reached.has(checkpoint)),
      updatedAt: new Date().toISOString(),
    };

    writeCollection({
      ...collection,
      records: { ...collection.records, [key]: record },
    });

    return record;
  },
};
