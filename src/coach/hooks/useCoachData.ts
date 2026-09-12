import { useEffect, useState } from 'react';

import type { CoachRepository } from '../../services/coach-repository';
import type { CoachReadModel } from '../../types/coach';

type CoachDataState =
  | { status: 'loading' }
  | { status: 'ready'; model: CoachReadModel }
  | { status: 'error'; message: string };

export function useCoachData(repository: CoachRepository) {
  const [state, setState] = useState<CoachDataState>({ status: 'loading' });
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let cancelled = false;

    repository.getReadModel().then(
      (model) => {
        if (!cancelled) setState({ status: 'ready', model });
      },
      (error: unknown) => {
        if (cancelled) return;
        setState({
          status: 'error',
          message: error instanceof Error ? error.message : 'Impossibile caricare i dati Coach.',
        });
      },
    );

    return () => {
      cancelled = true;
    };
  }, [repository, revision]);

  return {
    ...state,
    refresh: () => setRevision((current) => current + 1),
  };
}
