import { buildCoachReadModel } from '../coach/lib/coach-selectors';
import { mockCoachDataset } from '../data/coach-mock';
import { lessons } from '../data/lessons';
import type { CoachRepository } from './coach-repository';

export const mockCoachRepository: CoachRepository = {
  async getReadModel() {
    return buildCoachReadModel(mockCoachDataset, lessons);
  },
};
