import type * as firestore from '@google-cloud/firestore';
import { taskEither } from 'fp-ts';
import type { TaskEither } from 'fp-ts/TaskEither';
import type { I } from 'ts-toolbelt';

export interface DocumentReference<E> {
  readonly get: <A extends firestore.DocumentData>(
    reference: firestore.DocumentReference<A>,
  ) => TaskEither<E, firestore.DocumentSnapshot<A>>;

  readonly set: <A extends firestore.DocumentData>(
    data: A,
  ) => (reference: firestore.DocumentReference<A>) => TaskEither<E, firestore.WriteResult>;

  readonly setWith: <A extends firestore.DocumentData>(
    data: Partial<A>,
    options: firestore.SetOptions,
  ) => (reference: firestore.DocumentReference<A>) => TaskEither<E, firestore.WriteResult>;

  readonly update: <A extends firestore.DocumentData>(
    data: UpdateData<A>,
    precondition?: firestore.Precondition,
  ) => (reference: firestore.DocumentReference<A>) => TaskEither<E, firestore.WriteResult>;

  readonly remove: (
    precondition?: firestore.Precondition,
  ) => <A>(reference: firestore.DocumentReference<A>) => TaskEither<E, firestore.WriteResult>;
}

export type DocumentReferenceConfig<E> = {
  onError: (reason: unknown) => E;
};

export function mkDocumentReference<E>({
  onError,
}: DocumentReferenceConfig<E>): DocumentReference<E> {
  const tryCatch = <A>(f: () => Promise<A>): TaskEither<E, A> => taskEither.tryCatch(f, onError);

  const get: DocumentReference<E>['get'] = (reference) => {
    return tryCatch(() => reference.get());
  };

  const set: DocumentReference<E>['set'] = (data) => (reference) => {
    return tryCatch(() => reference.set(data));
  };

  const setWith: DocumentReference<E>['setWith'] = (data, options) => (reference) => {
    return tryCatch(() => reference.set(data, options));
  };

  const update: DocumentReference<E>['update'] = (data, precondition) => (reference) => {
    return tryCatch(() =>
      // firestore checks for number of arguments here, can't pass undefined precondition
      precondition ? reference.update(data, precondition) : reference.update(data),
    );
  };

  const remove: DocumentReference<E>['remove'] = (precondition) => (reference) => {
    return tryCatch(() => reference.delete(precondition));
  };

  return {
    get,
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
