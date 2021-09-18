import {
  DocumentReference,
  DocumentReferenceConfig,
  mkDocumentReference,
} from './DocumentReference';
import { mkQuery, Query, QueryConfig } from './Query';

export type Firestore<E> = {
  documentReference: DocumentReference<E>;
  query: Query<E>;
};

export type FirestoreConfig<E> = DocumentReferenceConfig<E> & QueryConfig<E>;

export function mkFirestore<E>(config: FirestoreConfig<E>): Firestore<E> {
  const documentReference = mkDocumentReference(config);
  const query = mkQuery(config);

  return {
    documentReference,
    query,
  };
}
