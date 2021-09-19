import { mkCollectionReference, mkDocumentReference } from '@dddenis/firestore-fp';
import { DocumentReference, Firestore } from '@google-cloud/firestore';
import { option, readerTaskEither } from 'fp-ts';
import { pipe } from 'fp-ts/function';

const root = new Firestore();

declare const config: {
  onError: (reason: unknown) => Error;
};

type Entity = {
  x: number;
  y: {
    z: boolean;
  };
};

/**
 * CollectionReference API
 */

const collectionReference = mkCollectionReference(config);

const collection = root.collection('some-collection');

// get all documents in collection
pipe(
  collectionReference.get(collection),
  readerTaskEither.map((querySnapshot) => querySnapshot.docs),
);

/**
 * DocumentReference API
 */

const documentReference = mkDocumentReference(config);

const document = collection.doc('some-document') as DocumentReference<Entity>;

// find document
pipe(
  documentReference.find(document),
  readerTaskEither.map(option.map((documentSnapshot) => documentSnapshot.data())),
);

// set document
pipe(
  document,
  documentReference.set<Entity>({
    x: 42,
    y: {
      z: true,
    },
  }),
);

// merge document
pipe(
  document,
  documentReference.setMerge<Entity>({
    x: 42,
  }),
);

// update document
pipe(
  document,
  documentReference.update<Entity>({
    'y.z': true,
  }),
);

// remove document
pipe(document, documentReference.remove());
