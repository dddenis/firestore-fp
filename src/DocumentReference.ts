import type { DataLoaderEnv } from '@dddenis/dataloader-fp';
import type * as firestore from '@google-cloud/firestore';
import { reader, readerTaskEither, taskEither } from 'fp-ts';
import { pipe } from 'fp-ts/function';
import type { Option } from 'fp-ts/Option';
import type { ReaderTaskEither } from 'fp-ts/ReaderTaskEither';
import type { TaskEither } from 'fp-ts/TaskEither';
import type { I } from 'ts-toolbelt';
import { mkFirestoreDataloader } from './FirestoreDataLoader';

export interface DocumentReference<E extends Error> {
  readonly find: <R extends DataLoaderEnv, A extends firestore.DocumentData>(
    reference: firestore.DocumentReference<A>,
  ) => ReaderTaskEither<R, E, Option<firestore.QueryDocumentSnapshot<A>>>;

  readonly set: <A extends firestore.DocumentData>(
    data: A,
  ) => <R extends DataLoaderEnv>(
    reference: firestore.DocumentReference<A>,
  ) => ReaderTaskEither<R, E, firestore.WriteResult>;

  readonly setWith: <A extends firestore.DocumentData>(
    data: Partial<A>,
    options: firestore.SetOptions,
  ) => <R extends DataLoaderEnv>(
    reference: firestore.DocumentReference<A>,
  ) => ReaderTaskEither<R, E, firestore.WriteResult>;

  readonly update: <A extends firestore.DocumentData>(
    data: UpdateData<A>,
    precondition?: firestore.Precondition,
  ) => <R extends DataLoaderEnv>(
    reference: firestore.DocumentReference<A>,
  ) => ReaderTaskEither<R, E, firestore.WriteResult>;

  readonly remove: (
    precondition?: firestore.Precondition,
  ) => <R extends DataLoaderEnv, A extends firestore.DocumentData>(
    reference: firestore.DocumentReference<A>,
  ) => ReaderTaskEither<R, E, firestore.WriteResult>;
}

export type DocumentReferenceConfig<E extends Error> = {
  onError: (reason: unknown) => E;
};

export function mkDocumentReference<E extends Error>({
  onError,
}: DocumentReferenceConfig<E>): DocumentReference<E> {
  const tryCatch = <A>(f: () => Promise<A>): TaskEither<E, A> => taskEither.tryCatch(f, onError);

  const find: DocumentReference<E>['find'] = (reference) => {
    return mkFirestoreDataloader(reference.parent, onError).load(reference.id);
  };

  const set: DocumentReference<E>['set'] = (data) => (reference) => {
    return pipe(
      reader.of(tryCatch(() => reference.set(data))),
      readerTaskEither.chainFirstReaderK(() =>
        mkFirestoreDataloader(reference.parent, onError).clear(reference.id),
      ),
    );
  };

  const setWith: DocumentReference<E>['setWith'] = (data, options) => (reference) => {
    return pipe(
      reader.of(tryCatch(() => reference.set(data, options))),
      readerTaskEither.chainFirstReaderK(() =>
        mkFirestoreDataloader(reference.parent, onError).clear(reference.id),
      ),
    );
  };

  const update: DocumentReference<E>['update'] = (data, precondition) => (reference) => {
    return pipe(
      reader.of(
        tryCatch(() =>
          // firestore checks for number of arguments here, can't pass undefined precondition
          precondition ? reference.update(data, precondition) : reference.update(data),
        ),
      ),
      readerTaskEither.chainFirstReaderK(() =>
        mkFirestoreDataloader(reference.parent, onError).clear(reference.id),
      ),
    );
  };

  const remove: DocumentReference<E>['remove'] = (precondition) => (reference) => {
    return pipe(
      reader.of(tryCatch(() => reference.delete(precondition))),
      readerTaskEither.chainFirstReaderK(() =>
        mkFirestoreDataloader(reference.parent, onError).clear(reference.id),
      ),
    );
  };

  return {
    find,
    set,
    setWith,
    update,
    remove,
  };
}

export type UpdateData<T extends firestore.DocumentData> = Partial<{
  [K in Path<T>]: PathValue<T, K>;
}>;

type Path<T> = PathImpl<T> | keyof T;

/* eslint-disable @typescript-eslint/no-explicit-any */
type PathImpl<
  T,
  K extends keyof T = keyof T,
  IT extends I.Iteration = I.IterationOf<0>,
> = 8 extends I.Pos<IT>
  ? never
  : K extends string
  ? T[K] extends Record<string, any> | undefined
    ?
        | K
        | `${K}.${PathImpl<
            NonNullable<T[K]>,
            Exclude<keyof NonNullable<T[K]>, keyof any[]>,
            I.Next<IT>
          >}`
    : K
  : never;
/* eslint-enable @typescript-eslint/no-explicit-any */

type PathValue<T, P extends Path<T>> = P extends `${infer K}.${infer Rest}`
  ? K extends keyof T
    ? Rest extends Path<NonNullable<T[K]>>
      ? PathValue<NonNullable<T[K]>, Rest>
      : never
    : never
  : P extends keyof T
  ? T[P]
  : never;
