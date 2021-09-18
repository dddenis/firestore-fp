import type * as firestore from '@google-cloud/firestore';
import { taskEither } from 'fp-ts';
import type { TaskEither } from 'fp-ts/TaskEither';

export interface Query<E> {
  readonly get: <A extends firestore.DocumentData>(
    query: firestore.Query<A>,
  ) => TaskEither<E, firestore.QuerySnapshot<A>>;
}

export type QueryConfig<E> = {
  onError: (reason: unknown) => E;
};

export function mkQuery<E>({ onError }: QueryConfig<E>): Query<E> {
  const tryCatch = <A>(f: () => Promise<A>): TaskEither<E, A> => taskEither.tryCatch(f, onError);

  const get: Query<E>['get'] = (query) => {
    return tryCatch(() => query.get());
  };

  return {
    get,
  };
}
