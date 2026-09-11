import type { CoachReadModel } from '../types/coach';

export type CoachRepository = {
  getReadModel: () => Promise<CoachReadModel>;
};
