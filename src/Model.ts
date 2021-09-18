import {
  CollectionReference,
  DocumentData,
  FieldPath,
  Precondition,
  SetOptions,
  WriteResult,
} from '@google-cloud/firestore';
import { either, option, reader, readerTaskEither, readonlyArray, taskEither } from 'fp-ts';
import { flow, pipe } from 'fp-ts/function';
import type { Option } from 'fp-ts/Option';
import type { ReaderTaskEither } from 'fp-ts/ReaderTaskEither';
import { BatchLoadFn, DataLoaderEnv, mapEntitiesToIds, mkDataLoader } from './DataLoader';
import { UpdateData } from './DocumentReference';
import type { Firestore } from './Firestore';

export interface Model<E extends Error, A extends DocumentData, K extends string = string> {
  readonly getAll: <R extends DataLoaderEnv>() => ReaderTaskEither<
    R,
    E,
    ReadonlyArray<Document<A, K>>
  >;

  readonly find: <R extends DataLoaderEnv>(id: K) => ReaderTaskEither<R, E, Option<Document<A, K>>>;

  readonly set: <R extends DataLoaderEnv>(
    document: Document<A, K>,
  ) => ReaderTaskEither<R, E, WriteResult>;

  readonly setWith: <R extends DataLoaderEnv>(
    document: Document<Partial<A>, K>,
    options: SetOptions,
  ) => ReaderTaskEither<R, E, WriteResult>;

  readonly update: <R extends DataLoaderEnv>(
    document: Document<UpdateData<A>, K>,
    precondition?: Precondition,
  ) => ReaderTaskEither<R, E, WriteResult>;

  readonly remove: <R extends DataLoaderEnv>(
    id: K,
    precondition?: Precondition,
  ) => ReaderTaskEither<R, E, WriteResult>;
}

export type Document<A extends DocumentData = DocumentData, K extends string = string> = {
  readonly id: K;
  readonly data: A;
};

export type ModelConfig<E extends Error, A> = {
  collection: CollectionReference<A>;
  firestore: Firestore<E>;
};

export function mkModel<E extends Error, A extends DocumentData, K extends string = string>(
  config: ModelConfig<E, A>,
): Model<E, A, K> {
  const { collection, firestore } = config;

  const dataLoader = mkDataLoader({
    batchLoad: mkBatchLoadFn<E, A, K>(config),
    key: collection.path,
  });

  type _Model = Model<E, A, K>;

  const getAll: _Model['getAll'] = () => {
    return pipe(
      reader.of(firestore.query.get(collection)),
      readerTaskEither.chainReaderK((querySnapshot) => {
        return pipe(
          querySnapshot.docs,
          reader.traverseArray((documentSnapshot) => {
            return pipe(
              reader.of({
                id: documentSnapshot.id as K,
                data: documentSnapshot.data(),
              }),
              reader.chainFirst((document) =>
                dataLoader.prime(document.id)(either.right(option.some(document))),
              ),
            );
          }),
        );
      }),
    );
  };

  const find: _Model['find'] = (id) => {
    return dataLoader.load(id);
  };

  const set: _Model['set'] = (document) => {
    return pipe(
      collection.doc(document.id),
      firestore.documentReference.set(document.data),
      reader.of,
      readerTaskEither.chainFirstReaderK(() =>
        dataLoader.prime(document.id)(either.right(option.some(document))),
      ),
    );
  };

  const setWith: _Model['setWith'] = (document, options) => {
    return pipe(
      collection.doc(document.id),
      firestore.documentReference.setWith(document.data, options),
      reader.of,
      readerTaskEither.chainFirstReaderK(() => dataLoader.clear(document.id)),
    );
  };

  const update: _Model['update'] = (document, precondition) => {
    return pipe(
      collection.doc(document.id),
      firestore.documentReference.update(document.data, precondition),
      reader.of,
      readerTaskEither.chainFirstReaderK(() => dataLoader.clear(document.id)),
    );
  };

  const remove: _Model['remove'] = (id, precondition) => {
    return pipe(
      collection.doc(id),
      firestore.documentReference.remove(precondition),
      reader.of,
      readerTaskEither.chainFirstReaderK(() => dataLoader.clear(id)),
    );
  };

  return {
    getAll,
    find,
    set,
    setWith,
    update,
    remove,
  };
}

function mkBatchLoadFn<E extends Error, A extends DocumentData, K extends string>({
  collection,
  firestore,
}: ModelConfig<E, A>): BatchLoadFn<unknown, E, K, Option<Document<A, K>>> {
  return (ids) => {
    return pipe(
      readonlyArray.chunksOf(10)(ids),
      taskEither.traverseArray((idChunk) => {
        return pipe(collection.where(FieldPath.documentId(), 'in', idChunk), firestore.query.get);
      }),
      taskEither.map(
        flow(
          readonlyArray.chain((querySnapshot) => querySnapshot.docs),
          mapEntitiesToIds(
            (documentSnapshot) => documentSnapshot.id as K,
            () => either.right(option.none),
            (documentSnapshot) =>
              either.right(
                option.some({
                  id: documentSnapshot.id as K,
                  data: documentSnapshot.data(),
                }),
              ),
            ids,
          ),
        ),
      ),
      reader.of,
    );
  };
}
