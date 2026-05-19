import * as admin from 'firebase-admin';

if (admin.apps.length === 0) {
  admin.initializeApp();
  // Firestore rejects undefined values by default — ignore them instead.
  admin.firestore().settings({ ignoreUndefinedProperties: true });
}

export default admin;
export const getDb = (): admin.firestore.Firestore => admin.firestore();
