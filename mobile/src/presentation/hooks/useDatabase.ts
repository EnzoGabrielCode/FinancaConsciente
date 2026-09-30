import {useCallback, useEffect, useState} from 'react';

import {getDatabase} from '../../data/database/connection';

export type DatabaseState =
  | {status: 'carregando'}
  | {status: 'pronto'; schemaVersion: number}
  | {status: 'erro'; message: string};

export function useDatabase(): DatabaseState & {retry: () => void} {
  const [state, setState] = useState<DatabaseState>({status: 'carregando'});
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setState({status: 'carregando'});
    getDatabase()
      .then(({schemaVersion}) => {
        if (active) {
          setState({status: 'pronto', schemaVersion});
        }
      })
      .catch((error: unknown) => {
        if (active) {
          const message =
            error instanceof Error ? error.message : String(error);
          setState({status: 'erro', message});
        }
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt(n => n + 1), []);

  return {...state, retry};
}
