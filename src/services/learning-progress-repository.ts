import {
  learningProgressStorageKey,
  parseLearningProgress,
  type StoredLearningProgress,
} from '../lib/learning-progress';

export type LearningProgressRepository = {
  read: () => StoredLearningProgress;
  write: (progress: StoredLearningProgress) => void;
  subscribe: (listener: (progress: StoredLearningProgress) => void) => () => void;
};

function readFromLocalStorage() {
  try {
    return parseLearningProgress(window.localStorage.getItem(learningProgressStorageKey));
  } catch {
    return parseLearningProgress(null);
  }
}

export const localLearningProgressRepository: LearningProgressRepository = {
  read: readFromLocalStorage,
  write(progress) {
    try {
      window.localStorage.setItem(learningProgressStorageKey, JSON.stringify(progress));
    } catch {
      // Il repository mantiene il fallback in memoria quando lo storage non è disponibile.
    }
  },
  subscribe(listener) {
    const syncAcrossTabs = (event: StorageEvent) => {
      if (event.key === learningProgressStorageKey) {
        listener(parseLearningProgress(event.newValue));
      }
    };

    window.addEventListener('storage', syncAcrossTabs);
    return () => window.removeEventListener('storage', syncAcrossTabs);
  },
};
