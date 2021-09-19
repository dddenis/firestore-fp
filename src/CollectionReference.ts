import type { DataLoaderEnv } from '@dddenis/dataloader-fp';
import type * as firestore from '@google-cloud/firestore';
import { either, option, reader, readerTaskEither, taskEither } from 'fp-ts';
import { pipe } from 'fp-ts/function';
import type { ReaderTaskEither } from 'fp-ts/ReaderTaskEither';
import type { TaskEither } from 'fp-ts/TaskEither';
import { mkFirestoreDataloader } from './FirestoreDataLoader';

export interface CollectionReference<E extends Error> {
  readonly get: <R extends DataLoaderEnv, A extends firestore.DocumentData>(
    query: firestore.CollectionReference<A>,
  ) => ReaderTaskEither<R, E, firestore.QuerySnapshot<A>>;
}

export type CollectionReferenceConfig<E extends Error> = {
  onError: (reason: unknown) => E;
};

export function mkCollectionReference<E extends Error>({
  onError,
}: CollectionReferenceConfig<E>): CollectionReference<E> {
  const tryCatch = <A>(f: () => Promise<A>): TaskEither<E, A> => taskEither.tryCatch(f, onError);

  const get: CollectionReference<E>['get'] = (reference) => {
    return pipe(
      reader.of(tryCatch(() => reference.get())),
      readerTaskEither.chainFirstReaderK((querySnapshot) => {
        return pipe(
          querySnapshot.docs,
          reader.traverseArray((documentSnapshot) => {
            return mkFirestoreDataloader(reference, onError).prime(documentSnapshot.id)(
              either.right(option.some(documentSnapshot)),
            );
          }),
        );
      }),
    );
  };

  return {
    get,
  };
}
