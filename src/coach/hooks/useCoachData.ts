import { useCallback, useEffect, useRef, useState } from 'react';

import type { CoachRepository } from '../../services/coach-repository';
import type { CoachReadModel } from '../../types/coach';

type CoachDataState =
  | { status: 'loading' }
  | { status: 'ready'; model: CoachReadModel }
  | { status: 'error'; message: string };

export function useCoachData(repository: CoachRepository) {
  const [state, setState] = useState<CoachDataState>({ status: 'loading' });
  const mountedRef = useRef(true);
  const inFlightRef = useRef<Promise<void> | null>(null);

  const load = useCallback(() => {
    if (inFlightRef.current) return inFlightRef.current;

    const request = repository.getReadModel().then(
      (model) => {
        if (mountedRef.current) setState({ status: 'ready', model });
      },
      (error: unknown) => {
        if (!mountedRef.current) return;
        setState({
          status: 'error',
          message: error instanceof Error ? error.message : 'Impossibile caricare i dati Coach.',
        });
      },
    ).finally(() => {
      inFlightRef.current = null;
    });

    inFlightRef.current = request;
    return request;
  }, [repository]);

  useEffect(() => {
    mountedRef.current = true;
    void load();
    return () => {
      mountedRef.current = false;
    };
  }, [load]);

  useEffect(() => {
    const refreshVisibleData = () => {
      if (document.visibilityState === 'visible') void load();
    };
    const interval = window.setInterval(refreshVisibleData, 10_000);
    window.addEventListener('focus', refreshVisibleData);
    document.addEventListener('visibilitychange', refreshVisibleData);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshVisibleData);
      document.removeEventListener('visibilitychange', refreshVisibleData);
    };
  }, [load]);

  return {
    ...state,
    refresh: () => {
      void load();
    },
  };
}
