import * as firestore from '@google-cloud/firestore';
import { either, option, reader, readonlyArray, taskEither } from 'fp-ts';
import { flow, pipe } from 'fp-ts/function';
import type { Option } from 'fp-ts/Option';
import {
  BatchLoadFn,
  DataLoader,
  DataLoaderEnv,
  mapEntitiesToIds,
  mkDataLoader,
} from './DataLoader';

export function mkFirestoreDataloader<
  E extends Error,
  A extends firestore.DocumentData,
  K extends string = string,
>(
  collection: firestore.CollectionReference<A>,
  onError: (reason: unknown) => E,
): DataLoader<DataLoaderEnv, E, K, Option<firestore.QueryDocumentSnapshot<A>>> {
  return mkDataLoader({
    batchLoad: mkBatchLoadFn(collection, onError),
    key: collection.path,
  });
}

function mkBatchLoadFn<E extends Error, A extends firestore.DocumentData, K extends string>(
  collection: firestore.CollectionReference<A>,
  onError: (reason: unknown) => E,
): BatchLoadFn<unknown, E, K, Option<firestore.QueryDocumentSnapshot<A>>> {
  return (ids: ReadonlyArray<K>) => {
    return pipe(
      readonlyArray.chunksOf(10)(ids),
      taskEither.traverseArray((idChunk) => {
        return pipe(collection.where(firestore.FieldPath.documentId(), 'in', idChunk), (query) =>
          taskEither.tryCatch(() => query.get(), onError),
        );
      }),
      taskEither.map(
        flow(
          readonlyArray.chain((querySnapshot) => querySnapshot.docs),
          mapEntitiesToIds(
            (documentSnapshot) => documentSnapshot.id as K,
            () => either.right(option.none),
            (documentSnapshot) => either.right(option.some(documentSnapshot)),
            ids,
          ),
        ),
      ),
      reader.of,
    );
  };
}
