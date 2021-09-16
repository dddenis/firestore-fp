import OriginalDataLoader from 'dataloader';
import { either, option, readonlyArray, readonlyRecord, semigroup, taskEither } from 'fp-ts';
import type { Either } from 'fp-ts/Either';
import { identity, pipe } from 'fp-ts/function';
import type { Reader } from 'fp-ts/Reader';
import type { ReaderTask } from 'fp-ts/ReaderTask';
import type { ReaderTaskEither } from 'fp-ts/ReaderTaskEither';

export interface DataLoader<R extends DataLoaderEnv, E extends Error, K, A> {
  readonly load: (key: K) => ReaderTaskEither<R, E, A>;
  readonly loadMany: (keys: ReadonlyArray<K>) => ReaderTask<R, ReadonlyArray<Either<E, A>>>;
  readonly clear: (key: K) => Reader<R, OriginalDataLoader<K, A>>;
  readonly clearAll: () => Reader<R, OriginalDataLoader<K, A>>;
  readonly prime: (key: K) => (value: Either<E, A>) => Reader<R, Either<E, A>>;
}

export type DataLoaderConfig<R, E extends Error, K, A, C = K> = {
  batchLoad: BatchLoadFn<R, E, K, A>;
  key?: unknown;
  options?: OriginalDataLoader.Options<K, A, C>;
};

export function mkDataLoader<R extends DataLoaderEnv, E extends Error, K, A, C = K>(
  config: DataLoaderConfig<R, E, K, A, C>,
): DataLoader<R, E, K, A> {
  const withDataLoader =
    <B>(f: (dataLoader: OriginalDataLoader<K, A, C>) => B) =>
    (env: R): B =>
      f(env.getDataLoader(config)(env));

  return {
    load: (key) =>
      withDataLoader((dataLoader) => {
        return taskEither.tryCatch(() => dataLoader.load(key), identity as (x: unknown) => E);
      }),

    loadMany: (keys) =>
      withDataLoader((dataLoader) => async () => {
        return pipe(
          // error catching here is handled by DataLoader
          // https://github.com/graphql/dataloader/blob/6cbe82e1fd9609dd6e1b2b8374fbf37a3e403c49/src/index.js#L144
          (await dataLoader.loadMany(keys)) as ReadonlyArray<A | E>,
          readonlyArray.map((valueOrError) =>
            valueOrError instanceof Error ? either.left(valueOrError) : either.right(valueOrError),
          ),
        );
      }),

    clear: (key) =>
      withDataLoader((dataLoader) => {
        return dataLoader.clear(key);
      }),

    clearAll: () =>
      withDataLoader((dataLoader) => {
        return dataLoader.clearAll();
      }),

    prime: (key) => (value) =>
      withDataLoader((dataLoader) => {
        dataLoader.clear(key).prime(key, either.toUnion(value));
        return value;
      }),
  };
}

export interface DataLoaderEnv {
  readonly getDataLoader: <R, E extends Error, K, A, C = K>(
    input: DataLoaderConfig<R, E, K, A, C>,
  ) => Reader<R, OriginalDataLoader<K, A, C>>;
}

export type BatchLoadFn<R, E extends Error, K, A> = (
  keys: ReadonlyArray<K>,
) => ReaderTaskEither<R, E, ReadonlyArray<Either<E, A>>>;

export function mkDataLoaderEnv(): DataLoaderEnv {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dataLoaderCache = new Map<unknown, Reader<any, OriginalDataLoader<any, any>>>();

  return {
    getDataLoader: ({ batchLoad, key, options }) => {
      const cacheKey = key != null ? key : batchLoad;

      let dataLoader = dataLoaderCache.get(cacheKey);

      if (!dataLoader) {
        dataLoader = mkOriginalDataLoader(batchLoad, options);
        dataLoaderCache.set(cacheKey, dataLoader);
      }

      return dataLoader;
    },
  };
}

function mkOriginalDataLoader<R, E extends Error, K, A, C = K>(
  batchLoad: BatchLoadFn<R, E, K, A>,
  options?: OriginalDataLoader.Options<K, A, C>,
): Reader<R, OriginalDataLoader<K, A, C>> {
  let originalDataLoader: OriginalDataLoader<K, A, C>;

  return (env) => {
    if (!originalDataLoader) {
      originalDataLoader = new OriginalDataLoader<K, A, C>((keys) => {
        return pipe(
          batchLoad(keys)(env),
          taskEither.map(readonlyArray.map(either.toUnion)),
          taskEither.getOrElse((error) => () => Promise.reject(error)),
        )();
      }, options);
    }

    return originalDataLoader;
  };
}

export function mapEntitiesToIds<A, B, K extends string = string>(
  getId: (entity: A) => K,
  onNone: (id: K) => B,
  onSome: (entity: A) => B,
  ids: ReadonlyArray<K>,
) {
  return (entities: ReadonlyArray<A>): ReadonlyArray<B> => {
    const entitiesMap = readonlyRecord.fromFoldableMap(
      semigroup.first<A>(),
      readonlyArray.Foldable,
    )(entities, (entity) => [getId(entity), entity]);

    return ids.map((id) => {
      return pipe(
        readonlyRecord.lookup(id)(entitiesMap),
        option.fold(() => onNone(id), onSome),
      );
    });
  };
}
