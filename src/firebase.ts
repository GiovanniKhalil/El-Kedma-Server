import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously,
  updatePassword,
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import {
  initializeFirestore,
  doc,
  getDocFromServer,
  setDoc,
  deleteDoc
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase App
export const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore with auto-detect long-polling for resilient connectivity across all networks and iframes
export const db = initializeFirestore(
  app,
  {
    experimentalAutoDetectLongPolling: true,
  },
  firebaseConfig.firestoreDatabaseId
);

// Initialize Firebase Authentication
export const auth = getAuth(app);

/**
 * Generates a unique, case-independent internal Firebase Auth email
 * (e.g. u_<uuid>@stjohn.church) completely decoupled from username casing.
 */
export function generateUniqueInternalAuthEmail(): string {
  let rawId = '';
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    rawId = crypto.randomUUID().replace(/-/g, '');
  } else if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    rawId = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  } else {
    rawId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
  }
  return `u_${rawId.toLowerCase()}@stjohn.church`;
}

// Legacy helper kept only for backward compatibility with older records
export function formatSafeChurchEmail(input: string, domain = 'stjohn.church'): string {
  const clean = input.trim().toLowerCase()
    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());

  if (clean.includes('@') && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
    return clean;
  }

  const asciiSafe = clean.replace(/[^a-z0-9_.]/g, '');
  if (asciiSafe.length >= 3) {
    return `${asciiSafe}@${domain}`;
  }

  // Safe hex encoding for Arabic or unicode usernames
  const bytes = new TextEncoder().encode(clean);
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 24);
  return `user_${hex || 'servant'}@${domain}`;
}

// Helper to ensure password satisfies Firebase Auth 6-char minimum
export function formatSafeFirebasePass(rawPass: string): string {
  const clean = rawPass.trim();
  if (clean.length >= 6) return clean;
  return `${clean}_church`;
}

// Email & Password Sign In strictly using the user's resolved internal authEmail
export async function loginWithFirebaseAuth(
  emailOrUsername: string,
  pass: string,
  options: { resolvedAuthEmail?: string; domain?: string } = {}
): Promise<FirebaseUser> {
  const email = options.resolvedAuthEmail
    ? options.resolvedAuthEmail.trim().toLowerCase()
    : (emailOrUsername.includes('@')
        ? emailOrUsername.trim().toLowerCase()
        : '');
  if (!email) {
    throw new Error('اسم المستخدم أو كلمة السر غير صحيحة');
  }
  const securePass = formatSafeFirebasePass(pass);

  try {
    const cred = await signInWithEmailAndPassword(auth, email, securePass);
    return cred.user;
  } catch (err: any) {
    if (
      err.code === 'auth/user-not-found' ||
      err.code === 'auth/invalid-credential' ||
      err.code === 'auth/invalid-login-credentials'
    ) {
      throw new Error('اسم المستخدم أو كلمة السر غير صحيحة');
    } else if (err.code === 'auth/wrong-password') {
      throw new Error('كلمة السر غير صحيحة');
    } else {
      throw new Error(err.message || 'فشل تسجيل الدخول');
    }
  }
}

/**
 * Creates the Firebase Auth user strictly once during initial Root Admin bootstrap,
 * using a unique internal authEmail independent of username casing.
 */
export async function createRootFirebaseAuthUser(
  _username: string,
  pass: string,
  explicitAuthEmail?: string
): Promise<{ user: FirebaseUser; authEmail: string; createdNew: boolean }> {
  const authEmail = explicitAuthEmail?.trim().toLowerCase() || generateUniqueInternalAuthEmail();
  const securePass = formatSafeFirebasePass(pass);
  const cred = await createUserWithEmailAndPassword(auth, authEmail, securePass);
  return { user: cred.user, authEmail, createdNew: true };
}

/**
 * Creates/provisions a Firebase Auth account using a secondary app instance ('Provisioner')
 * so Amin El-Khedma El-Am does NOT lose their active admin session when approving or adding accounts.
 */
export async function provisionFirebaseAuthUser(
  authEmailOrHint: string,
  pass: string
): Promise<string | null> {
  const email = authEmailOrHint.includes('@')
    ? authEmailOrHint.trim().toLowerCase()
    : generateUniqueInternalAuthEmail();
  const securePass = formatSafeFirebasePass(pass);
  try {
    const existingApp = getApps().find((a) => a.name === 'Provisioner');
    const provApp = existingApp || initializeApp(firebaseConfig, 'Provisioner');
    const provAuth = getAuth(provApp);

    try {
      const cred = await createUserWithEmailAndPassword(provAuth, email, securePass);
      const uid = cred.user.uid;
      await signOut(provAuth);
      return uid;
    } catch (err: any) {
      if (err?.code === 'auth/email-already-in-use') {
        try {
          const signInCred = await signInWithEmailAndPassword(provAuth, email, securePass);
          const uid = signInCred.user.uid;
          await signOut(provAuth);
          return uid;
        } catch {
          return null;
        }
      }
      return null;
    }
  } catch {
    return null;
  }
}

/**
 * Uses anonymous Firebase Auth strictly for submitting isolated signup requests or reading zero-PII bootstrap/alias docs.
 */
export async function signInAnonymouslyForPendingRegistration(): Promise<FirebaseUser> {
  const cred = await signInAnonymously(auth);
  return cred.user;
}

// Helper to update current authenticated user's password
export async function updateFirebaseUserPassword(newPass: string): Promise<void> {
  if (!auth.currentUser) {
    throw new Error('لا يوجد مستخدم مسجل الدخول حالياً');
  }
  const securePass = formatSafeFirebasePass(newPass);
  await updatePassword(auth.currentUser, securePass);
}

// Helper for Sign Out
export async function logoutFirebaseAuth(): Promise<void> {
  await signOut(auth);
}

/**
 * Strips immutable audit/ownership fields (createdAt, ownerUid), undefined values,
 * plaintext passwords, and masked placeholder hashes ('••••••••', '***') from Firestore update payloads.
 */
export function sanitizeFirestoreUpdatePayload<T extends Record<string, any>>(
  data: T,
  options: { allowPasswordHash?: boolean } = {}
): Record<string, any> {
  const { allowPasswordHash = false } = options;
  const sanitized: Record<string, any> = {};
  const maskedValues = new Set(['••••••••', '********', '****', '***', '******', '']);

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    if (key === 'createdAt' || key === 'ownerUid') continue;
    if (key === 'password') continue;
    if (key === 'passwordHash') {
      if (!allowPasswordHash) continue;
      if (
        typeof value !== 'string' ||
        maskedValues.has(value.trim()) ||
        /^[•*]+$/.test(value.trim())
      ) {
        continue;
      }
    }
    sanitized[key] = value;
  }
  return sanitized;
}

// Operation types for logging and error reporting
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.warn('Firestore Operation Error: ', JSON.stringify(errInfo));
}

// Connection status helper
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Please check your Firebase configuration or internet connection.');
      return false;
    }
    return true;
  }
}

/**
 * Update or create user/profile data in Firestore using setDoc with { merge: true }.
 * Sanitizes immutable fields and prevents masked passwords from overwriting real hashes.
 */
export async function setFirestoreUserWithMerge(
  userId: string,
  data: Record<string, any>
): Promise<void> {
  const cleanId = userId.trim();
  const path = `users/${cleanId}`;
  try {
    const docRef = doc(db, 'users', cleanId);
    const sanitized = sanitizeFirestoreUpdatePayload(data, {
      allowPasswordHash: typeof data.passwordHash === 'string' && data.passwordHash.length >= 16,
    });
    await setDoc(
      docRef,
      {
        ...sanitized,
        updatedAt: new Date().toISOString()
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
    throw error;
  }
}

/**
 * Safe deletion of user document in Firestore.
 */
export async function deleteFirestoreUser(userId: string): Promise<void> {
  const cleanId = userId.trim();
  const path = `users/${cleanId}`;
  try {
    const docRef = doc(db, 'users', cleanId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    throw error;
  }
}


