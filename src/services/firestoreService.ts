import {
  collection,
  doc,
  getDoc,
  setDoc,
  addDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  writeBatch,
  query,
  where,
  limit,
  DocumentReference
} from 'firebase/firestore';
import { signInAnonymously, signOut } from 'firebase/auth';
import {
  auth,
  db,
  handleFirestoreError,
  OperationType,
  sanitizeFirestoreUpdatePayload
} from '../firebase';

// ============================================================================
// 1. Data Schema Interfaces (Matching Firestore Collections Exactly)
// ============================================================================

export interface FirestoreUser {
  uid: string;
  fullName: string;
  phone: string;
  role: string;
  assignedClass: string;
  assignedStage?: string;
  assignedStages?: string[];
  isFirstLogin: boolean;
  username?: string;
  authEmail?: string;
  passwordHash?: string;
  assignments?: { stageId: string; stageName: string; role: string }[];
  isProtectedRoot?: boolean;
  isAdminAssistant?: boolean;
  canAssignMakhdomeen?: boolean;
  mustChangePassword?: boolean;
  isTempPassword?: boolean;
  avatarUrl?: string;
  job?: string;
  area?: string;
  birthDate?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface FirestorePendingRegistration {
  fullName: string;
  username: string;
  phone: string;
  birthDate?: string;
  notes?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export interface FirestoreMakhdoom {
  fullName: string;
  birthDate: string;
  stage: string;
  stageId?: string;
  secondaryStages?: string[];
  assignedServantId?: string;
  classGroup: string;
  points: number;
  age?: number;
  gender?: 'boy' | 'girl';
  area?: string;
  address?: string;
  notes?: string;
  phone: string;
  parentPhone: string;
  parentName?: string;
  parentRelation?: string;
  parentJob?: string;
  parent2Name?: string;
  parent2Phone?: string;
  parent2Relation?: string;
  parent2Job?: string;
  createdAt?: string;
}

export interface FirestoreAttendance {
  date: string;
  month: number;
  personId: string;
  personType: string; // 'child' | 'servant' | 'supervisor'
  eventType: string;
  status: string;     // 'present' | 'absent'
  periodType?: 'weekly' | 'monthly' | 'seasonal_event';
  recordedByUid?: string;
  note?: string;
}

export interface FirestoreLibraryBook {
  title: string;
  category: string;
  targetGrade: string;
  targetStages?: string[];
  visibility?: 'all' | 'specific_stages';
  fileUrl: string;
  author?: string;
  year?: string;
  description?: string;
  contentSummary?: string;
  pdfUrl?: string;
  pdfFileName?: string;
  pdfFileSize?: string;
  coverImage?: string;
  coverBg?: string;
  pageCount?: number;
}

export interface FirestoreAnnouncement {
  title: string;
  body: string;
  targetRole: string;
  targetScope?: 'all' | 'general_dock' | 'specific_stages';
  targetStages?: string[];
  date?: string;
  time?: string;
  type?: 'event' | 'alert' | 'spiritual' | 'meeting';
  createdBy?: string;
  createdAt: string;
}

export interface FirestoreSeasonalEvent {
  name: string;
  startDate: string;
  endDate?: string;
  stageScope: string;
  isActive: boolean;
  createdAt: string;
}

export interface FirestoreStage {
  id: string;
  name: string;
  description?: string;
  supervisorName?: string;
  supervisorPhone?: string;
  assistantSupervisors?: { name: string; phone?: string }[];
  captainName?: string;
  captainPhone?: string;
  firstMateName?: string;
  firstMatePhone?: string;
  meetingTime?: string;
  isCustom?: boolean;
  updatedAt?: string;
}

// Collection Names
export const COLLECTIONS = {
  USERS: 'users',
  MAKHDOMEEN: 'makhdomeen',
  ATTENDANCE: 'attendance',
  LIBRARY: 'library',
  ANNOUNCEMENTS: 'announcements',
  STAGES: 'stages',
  PENDING_REGISTRATIONS: 'pending_registrations',
  SEASONAL_EVENTS: 'seasonal_events',
  APP_META: 'app_meta',
  LOGIN_ALIASES: 'login_aliases',
  TEST: 'test',
} as const;

function stripUndefined<T extends Record<string, any>>(obj: T): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      result[k] = v;
    }
  }
  return result;
}

function normalizeArabicDigits(val: string): string {
  return val.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

export function toLoginAliasId(prefix: 'u' | 'p', rawValue: string): string {
  const clean = normalizeArabicDigits((rawValue || '').trim());
  if (!clean) return '';
  if (prefix === 'p') {
    const digits = clean.replace(/\D/g, '');
    return digits.length >= 6 ? `p_${digits}`.slice(0, 128) : '';
  }
  // Strictly preserve username letter casing (e.g. u_ayman_khalil !== u_Ayman_Khalil)
  if (/^[a-zA-Z0-9._-]+$/.test(clean)) {
    return `u_${clean}`.slice(0, 128);
  }
  const bytes = new TextEncoder().encode(clean);
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `u_x_${hex}`.slice(0, 128);
}

async function commitChunkedDeletes(refs: DocumentReference[]): Promise<void> {
  for (let i = 0; i < refs.length; i += 450) {
    const batch = writeBatch(db);
    const slice = refs.slice(i, i + 450);
    slice.forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
}

// ============================================================================
// 2. Real-Time Listeners (Read)
// ============================================================================

export function listenToMakhdomeen(
  callback: (makhdomeen: (FirestoreMakhdoom & { id: string })[]) => void
) {
  const colRef = collection(db, COLLECTIONS.MAKHDOMEEN);
  return onSnapshot(
    colRef,
    (snapshot) => {
      if (snapshot.empty) {
        callback([]);
        return;
      }
      const data = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as FirestoreMakhdoom),
      }));
      callback(data);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, COLLECTIONS.MAKHDOMEEN);
    }
  );
}

export function listenToUsers(
  callback: (users: (FirestoreUser & { id: string })[]) => void
) {
  const colRef = collection(db, COLLECTIONS.USERS);
  return onSnapshot(
    colRef,
    (snapshot) => {
      if (snapshot.empty) {
        callback([]);
        return;
      }
      const data = snapshot.docs.map((docSnap) => ({
        ...(docSnap.data() as Omit<FirestoreUser, 'uid'>),
        uid: (docSnap.data() as Partial<FirestoreUser>).uid || docSnap.id,
        id: docSnap.id,
      }));
      callback(data);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, COLLECTIONS.USERS);
    }
  );
}

export function listenToAttendance(
  callback: (attendance: (FirestoreAttendance & { id: string })[]) => void
) {
  const colRef = collection(db, COLLECTIONS.ATTENDANCE);
  return onSnapshot(
    colRef,
    (snapshot) => {
      if (snapshot.empty) {
        callback([]);
        return;
      }
      const data = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as FirestoreAttendance),
      }));
      callback(data);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, COLLECTIONS.ATTENDANCE);
    }
  );
}

export function listenToLibrary(
  callback: (books: (FirestoreLibraryBook & { id: string })[]) => void
) {
  const colRef = collection(db, COLLECTIONS.LIBRARY);
  return onSnapshot(
    colRef,
    (snapshot) => {
      if (snapshot.empty) {
        callback([]);
        return;
      }
      const data = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as FirestoreLibraryBook),
      }));
      callback(data);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, COLLECTIONS.LIBRARY);
    }
  );
}

export function listenToAnnouncements(
  callback: (announcements: (FirestoreAnnouncement & { id: string })[]) => void
) {
  const colRef = collection(db, COLLECTIONS.ANNOUNCEMENTS);
  return onSnapshot(
    colRef,
    (snapshot) => {
      if (snapshot.empty) {
        callback([]);
        return;
      }
      const data = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as FirestoreAnnouncement),
      }));
      callback(data);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, COLLECTIONS.ANNOUNCEMENTS);
    }
  );
}

export function listenToSeasonalEvents(
  callback: (events: (FirestoreSeasonalEvent & { id: string })[]) => void
) {
  const colRef = collection(db, COLLECTIONS.SEASONAL_EVENTS);
  return onSnapshot(
    colRef,
    (snapshot) => {
      if (snapshot.empty) {
        callback([]);
        return;
      }
      const data = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as FirestoreSeasonalEvent),
      }));
      callback(data);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, COLLECTIONS.SEASONAL_EVENTS);
    }
  );
}

export function listenToStages(
  callback: (stages: FirestoreStage[]) => void
) {
  const colRef = collection(db, COLLECTIONS.STAGES);
  return onSnapshot(
    colRef,
    (snapshot) => {
      if (snapshot.empty) {
        callback([]);
        return;
      }
      const data = snapshot.docs.map((docSnap) => ({
        ...(docSnap.data() as Omit<FirestoreStage, 'id'>),
        id: docSnap.id,
      }));
      callback(data);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, COLLECTIONS.STAGES);
    }
  );
}

export function listenToPendingRegistrations(
  callback: (registrations: (FirestorePendingRegistration & { id: string })[]) => void
) {
  const colRef = collection(db, COLLECTIONS.PENDING_REGISTRATIONS);
  return onSnapshot(
    colRef,
    (snapshot) => {
      if (snapshot.empty) {
        callback([]);
        return;
      }
      const data = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as FirestorePendingRegistration),
      }));
      callback(data);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, COLLECTIONS.PENDING_REGISTRATIONS);
    }
  );
}

// ============================================================================
// 3. Write / Mutate Operations
// ============================================================================

// --- Makhdomeen ---
export async function addMakhdoomToFirestore(
  makhdoom: FirestoreMakhdoom,
  customId?: string
): Promise<string> {
  try {
    const cleanData = stripUndefined(makhdoom);
    if (customId) {
      await setDoc(doc(db, COLLECTIONS.MAKHDOMEEN, customId), cleanData);
      return customId;
    } else {
      const ref = await addDoc(collection(db, COLLECTIONS.MAKHDOMEEN), cleanData);
      return ref.id;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, COLLECTIONS.MAKHDOMEEN);
    throw error;
  }
}

export async function updateMakhdoomInFirestore(
  id: string,
  data: Partial<FirestoreMakhdoom>
): Promise<void> {
  const path = `${COLLECTIONS.MAKHDOMEEN}/${id}`;
  try {
    const cleanData = sanitizeFirestoreUpdatePayload(data);
    await setDoc(doc(db, COLLECTIONS.MAKHDOMEEN, id), cleanData, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
    throw error;
  }
}

export async function deleteMakhdoomFromFirestore(id: string): Promise<void> {
  const path = `${COLLECTIONS.MAKHDOMEEN}/${id}`;
  try {
    await deleteDoc(doc(db, COLLECTIONS.MAKHDOMEEN, id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    throw error;
  }
}

export async function batchAddMakhdomeenToFirestore(
  makhdomeen: (FirestoreMakhdoom & { id: string })[]
): Promise<void> {
  try {
    const batch = writeBatch(db);
    makhdomeen.forEach((m) => {
      const docRef = doc(db, COLLECTIONS.MAKHDOMEEN, m.id);
      const { id, ...data } = m;
      batch.set(docRef, stripUndefined(data));
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, COLLECTIONS.MAKHDOMEEN);
    throw error;
  }
}

export async function batchUpdateMakhdomeenStagesInFirestore(
  updates: { id: string; stage: string; stageId?: string }[]
): Promise<void> {
  if (updates.length === 0) return;
  try {
    const batch = writeBatch(db);
    updates.forEach((u) => {
      const docRef = doc(db, COLLECTIONS.MAKHDOMEEN, u.id);
      const patch: Record<string, any> = { stage: u.stage };
      if (u.stageId) patch.stageId = u.stageId;
      batch.update(docRef, patch);
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, COLLECTIONS.MAKHDOMEEN);
    throw error;
  }
}

// --- Users (Canonical Single Document Keyed by uid, Strict Case-Sensitive Username) ---
export async function getUserFromFirestore(uidOrIdentifier: string): Promise<FirestoreUser | null> {
  const cleanId = uidOrIdentifier.trim();
  const path = `${COLLECTIONS.USERS}/${cleanId}`;
  try {
    // 1. Direct lookup by document ID (Auth UID or canonical ID)
    const snap = await getDoc(doc(db, COLLECTIONS.USERS, cleanId));
    if (snap.exists()) {
      return { ...(snap.data() as Omit<FirestoreUser, 'uid'>), uid: snap.id };
    }

    // 2. Exact case-sensitive query by username (===)
    const qUsername = query(collection(db, COLLECTIONS.USERS), where('username', '==', cleanId), limit(1));
    const usernameSnap = await getDocs(qUsername);
    if (!usernameSnap.empty) {
      const firstDoc = usernameSnap.docs[0];
      const data = firstDoc.data() as Omit<FirestoreUser, 'uid'>;
      if (data.username === cleanId) {
        return { ...data, uid: firstDoc.id };
      }
    }

    // 3. Query by phone
    const qPhone = query(collection(db, COLLECTIONS.USERS), where('phone', '==', cleanId), limit(1));
    const phoneSnap = await getDocs(qPhone);
    if (!phoneSnap.empty) {
      const firstDoc = phoneSnap.docs[0];
      return { ...(firstDoc.data() as Omit<FirestoreUser, 'uid'>), uid: firstDoc.id };
    }

    // 4. Query by fullName
    const qName = query(collection(db, COLLECTIONS.USERS), where('fullName', '==', cleanId), limit(1));
    const nameSnap = await getDocs(qName);
    if (!nameSnap.empty) {
      const firstDoc = nameSnap.docs[0];
      return { ...(firstDoc.data() as Omit<FirestoreUser, 'uid'>), uid: firstDoc.id };
    }

    // 5. Fallback scan (strict case-sensitive username equality)
    const allUsersSnap = await getDocs(collection(db, COLLECTIONS.USERS));
    for (const d of allUsersSnap.docs) {
      const data = d.data() as Omit<FirestoreUser, 'uid'>;
      if (
        (data.username && data.username === cleanId) ||
        (data.phone && data.phone.trim() === cleanId) ||
        (data.fullName && data.fullName === cleanId) ||
        d.id === cleanId
      ) {
        return { ...data, uid: d.id };
      }
    }

    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
}

export async function addUserToFirestore(user: FirestoreUser): Promise<void> {
  const canonicalUid = (user.uid || `u_${Date.now()}`).trim();
  const path = `${COLLECTIONS.USERS}/${canonicalUid}`;
  try {
    const payload = stripUndefined({
      ...user,
      uid: canonicalUid,
      username: (user.username || canonicalUid).trim(),
      updatedAt: new Date().toISOString()
    });
    // Single canonical document keyed strictly by uid (zero dual-writing)
    await setDoc(doc(db, COLLECTIONS.USERS, canonicalUid), payload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

export async function updateUserInFirestore(
  uid: string,
  data: Partial<FirestoreUser> & Record<string, any>
): Promise<void> {
  const cleanId = uid.trim();
  const path = `${COLLECTIONS.USERS}/${cleanId}`;
  try {
    const sanitized = sanitizeFirestoreUpdatePayload(data, {
      allowPasswordHash: typeof data.passwordHash === 'string' && data.passwordHash.length >= 16,
    });
    const payload: Record<string, any> = {
      ...sanitized,
      uid: data.uid || cleanId,
      updatedAt: new Date().toISOString()
    };
    if (payload.assignedStage && !payload.assignedClass) {
      payload.assignedClass = payload.assignedStage;
    }
    if (payload.assignedClass && !payload.assignedStage) {
      payload.assignedStage = payload.assignedClass;
    }
    // Single canonical document update keyed strictly by uid
    await setDoc(doc(db, COLLECTIONS.USERS, cleanId), payload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
    throw error;
  }
}

export async function batchUpdateUsersInFirestore(
  updates: { id: string; data: Partial<FirestoreUser> & Record<string, any> }[]
): Promise<void> {
  if (updates.length === 0) return;
  try {
    const batch = writeBatch(db);
    const now = new Date().toISOString();
    updates.forEach(({ id, data }) => {
      const cleanId = id.trim();
      const docRef = doc(db, COLLECTIONS.USERS, cleanId);
      const sanitized = sanitizeFirestoreUpdatePayload(data, {
        allowPasswordHash: typeof data.passwordHash === 'string' && data.passwordHash.length >= 16,
      });
      batch.set(docRef, { ...sanitized, updatedAt: now }, { merge: true });
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, COLLECTIONS.USERS);
    throw error;
  }
}

export async function deleteUserFromFirestore(uidOrUsername: string): Promise<void> {
  const clean = uidOrUsername.trim();
  const path = `${COLLECTIONS.USERS}/${clean}`;
  const aliasRefsToDelete: DocumentReference[] = [];
  const collectAliases = (data?: Partial<FirestoreUser>) => {
    if (!data) return;
    const uAlias = data.username ? toLoginAliasId('u', data.username) : '';
    const pAlias = data.phone ? toLoginAliasId('p', data.phone) : '';
    if (uAlias) aliasRefsToDelete.push(doc(db, COLLECTIONS.LOGIN_ALIASES, uAlias));
    if (pAlias) aliasRefsToDelete.push(doc(db, COLLECTIONS.LOGIN_ALIASES, pAlias));
  };

  try {
    const directSnap = await getDoc(doc(db, COLLECTIONS.USERS, clean));
    if (directSnap.exists()) {
      collectAliases(directSnap.data() as Partial<FirestoreUser>);
    }
    await deleteDoc(doc(db, COLLECTIONS.USERS, clean));
    const qSnap = await getDocs(query(collection(db, COLLECTIONS.USERS), where('username', '==', clean)));
    for (const d of qSnap.docs) {
      collectAliases(d.data() as Partial<FirestoreUser>);
      await deleteDoc(d.ref);
    }
    const qUidSnap = await getDocs(query(collection(db, COLLECTIONS.USERS), where('uid', '==', clean)));
    for (const d of qUidSnap.docs) {
      collectAliases(d.data() as Partial<FirestoreUser>);
      await deleteDoc(d.ref);
    }
    const directAlias = toLoginAliasId('u', clean);
    if (directAlias) {
      aliasRefsToDelete.push(doc(db, COLLECTIONS.LOGIN_ALIASES, directAlias));
    }
    for (const ref of aliasRefsToDelete) {
      await deleteDoc(ref).catch(() => undefined);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    throw error;
  }
}

export async function checkRootBootstrapStatusFromFirestore(): Promise<boolean> {
  let createdAnonSession = false;
  try {
    if (!auth.currentUser) {
      await signInAnonymously(auth);
      createdAnonSession = true;
    }
    const snap = await getDoc(doc(db, COLLECTIONS.APP_META, 'root_status'));
    return snap.exists() && snap.data()?.initialized === true;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `${COLLECTIONS.APP_META}/root_status`);
    // Fail-safe to true if network unavailable so normal login form remains usable
    return true;
  } finally {
    if (createdAnonSession && auth.currentUser?.isAnonymous) {
      await signOut(auth).catch(() => undefined);
    }
  }
}

export async function ensureRootBootstrapLockInFirestore(rootUid?: string): Promise<void> {
  try {
    const lockRef = doc(db, COLLECTIONS.APP_META, 'root_status');
    const snap = await getDoc(lockRef);
    const existingData = snap.exists() ? snap.data() : undefined;
    if (!snap.exists() || (rootUid && !existingData?.rootUid)) {
      await setDoc(
        lockRef,
        {
          initialized: true,
          ...(rootUid ? { rootUid } : {}),
          createdAt: existingData?.createdAt || new Date().toISOString()
        },
        { merge: true }
      );
    }
  } catch {
    // Ignore if already exists or unauthorized
  }
}

export async function seedRootAdminOnceInFirestore(
  user: FirestoreUser,
  authEmail: string
): Promise<{ seeded: boolean; alreadyExists?: boolean }> {
  const path = `${COLLECTIONS.USERS}/${user.uid}`;
  try {
    const usersSnap = await getDocs(query(collection(db, COLLECTIONS.USERS), limit(1)));
    if (!usersSnap.empty) {
      await ensureRootBootstrapLockInFirestore();
      return { seeded: false, alreadyExists: true };
    }

    const now = new Date().toISOString();

    // 1. Create the canonical /users/{uid} document FIRST so subsequent rules (isAdmin) succeed cleanly
    await setDoc(
      doc(db, COLLECTIONS.USERS, user.uid),
      stripUndefined({
        ...user,
        uid: user.uid,
        role: 'amin_khedma_am',
        isProtectedRoot: true,
        authEmail,
        username: (user.username || user.uid).trim(),
        createdAt: user.createdAt || now,
        updatedAt: now
      })
    );

    // 2. Lock root bootstrap in /app_meta/root_status AFTER /users/{uid} exists
    await setDoc(
      doc(db, COLLECTIONS.APP_META, 'root_status'),
      {
        initialized: true,
        rootUid: user.uid,
        createdAt: now
      },
      { merge: true }
    );

    // 3. Register zero-PII login aliases for username & phone
    const uAlias = toLoginAliasId('u', user.username || '');
    if (uAlias) {
      await setDoc(doc(db, COLLECTIONS.LOGIN_ALIASES, uAlias), { authEmail: authEmail.toLowerCase() });
    }
    const pAlias = toLoginAliasId('p', user.phone || '');
    if (pAlias) {
      await setDoc(doc(db, COLLECTIONS.LOGIN_ALIASES, pAlias), { authEmail: authEmail.toLowerCase() });
    }

    return { seeded: true };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
    throw error;
  }
}

export async function doesExactUsernameAliasExist(username: string): Promise<boolean> {
  const clean = (username || '').trim();
  if (!clean) return false;
  const uAlias = toLoginAliasId('u', clean);
  if (!uAlias) return false;
  try {
    const snap = await getDoc(doc(db, COLLECTIONS.LOGIN_ALIASES, uAlias));
    return snap.exists();
  } catch {
    return false;
  }
}

export async function resolveAuthEmailViaAlias(identifier: string): Promise<string | null> {
  const clean = (identifier || '').trim();
  if (!clean) return null;

  let createdAnonSession = false;
  try {
    if (!auth.currentUser) {
      await signInAnonymously(auth);
      createdAnonSession = true;
    }

    const candidateIds: string[] = [];
    const uAlias = toLoginAliasId('u', clean);
    if (uAlias) candidateIds.push(uAlias);

    // Only attempt phone alias lookup if identifier has no username letters
    if (!/[a-zA-Z]/.test(clean)) {
      const pAlias = toLoginAliasId('p', clean);
      if (pAlias) candidateIds.push(pAlias);
    }

    for (const aliasId of candidateIds) {
      try {
        const snap = await getDoc(doc(db, COLLECTIONS.LOGIN_ALIASES, aliasId));
        if (snap.exists() && typeof snap.data()?.authEmail === 'string') {
          return snap.data()!.authEmail as string;
        }
      } catch {
        // Ignore single alias lookup error
      }
    }
    return null;
  } catch {
    return null;
  } finally {
    if (createdAnonSession && auth.currentUser?.isAnonymous) {
      await signOut(auth).catch(() => undefined);
    }
  }
}

export async function syncUserLoginAliases(params: {
  authEmail: string;
  username?: string;
  phone?: string;
  oldUsername?: string;
  oldPhone?: string;
}): Promise<void> {
  const cleanAuthEmail = (params.authEmail || '').trim().toLowerCase();
  if (!cleanAuthEmail) return;

  try {
    const newUserAlias = params.username ? toLoginAliasId('u', params.username) : '';
    const newPhoneAlias = params.phone ? toLoginAliasId('p', params.phone) : '';
    const oldUserAlias = params.oldUsername ? toLoginAliasId('u', params.oldUsername) : '';
    const oldPhoneAlias = params.oldPhone ? toLoginAliasId('p', params.oldPhone) : '';

    if (oldUserAlias && oldUserAlias !== newUserAlias) {
      await deleteDoc(doc(db, COLLECTIONS.LOGIN_ALIASES, oldUserAlias)).catch(() => undefined);
    }
    if (oldPhoneAlias && oldPhoneAlias !== newPhoneAlias) {
      await deleteDoc(doc(db, COLLECTIONS.LOGIN_ALIASES, oldPhoneAlias)).catch(() => undefined);
    }
    if (newUserAlias) {
      await setDoc(doc(db, COLLECTIONS.LOGIN_ALIASES, newUserAlias), { authEmail: cleanAuthEmail });
    }
    if (newPhoneAlias) {
      await setDoc(doc(db, COLLECTIONS.LOGIN_ALIASES, newPhoneAlias), { authEmail: cleanAuthEmail });
    }
  } catch {
    // Alias sync is best-effort for lookup convenience
  }
}

export async function clearAllNonAdminUsersFromFirestore(adminUid: string): Promise<void> {
  const usersSnap = await getDocs(collection(db, COLLECTIONS.USERS));
  const toDelete: DocumentReference[] = [];
  for (const d of usersSnap.docs) {
    const data = d.data() as FirestoreUser;
    if (
      d.id !== adminUid &&
      data.role !== 'amin_khedma_am' &&
      !data.isProtectedRoot
    ) {
      toDelete.push(d.ref);
    }
  }
  if (toDelete.length > 0) {
    await commitChunkedDeletes(toDelete);
  }
}

export async function clearAllMakhdomeenFromFirestore(): Promise<void> {
  const snap = await getDocs(collection(db, COLLECTIONS.MAKHDOMEEN));
  const refs = snap.docs.map((d) => d.ref);
  if (refs.length > 0) {
    await commitChunkedDeletes(refs);
  }
}

export async function wipeAllDatabaseFromFirestore(options: {
  protectedRootUid?: string;
  protectedAuthEmail?: string;
}): Promise<void> {
  const collectionsToEmpty = [
    COLLECTIONS.MAKHDOMEEN,
    COLLECTIONS.ATTENDANCE,
    COLLECTIONS.LIBRARY,
    COLLECTIONS.ANNOUNCEMENTS,
    COLLECTIONS.PENDING_REGISTRATIONS,
    COLLECTIONS.STAGES,
    COLLECTIONS.SEASONAL_EVENTS,
    COLLECTIONS.TEST
  ];

  for (const colName of collectionsToEmpty) {
    try {
      const snap = await getDocs(collection(db, colName));
      if (!snap.empty) {
        await commitChunkedDeletes(snap.docs.map((d) => d.ref));
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, colName);
      throw err;
    }
  }

  // Clean non-root login aliases while preserving root admin aliases
  try {
    const aliasesSnap = await getDocs(collection(db, COLLECTIONS.LOGIN_ALIASES));
    const aliasRefsToDelete = aliasesSnap.docs
      .filter((d) => {
        const email = String(d.data()?.authEmail || '').toLowerCase();
        if (options.protectedAuthEmail && email === options.protectedAuthEmail.toLowerCase()) {
          return false;
        }
        return true;
      })
      .map((d) => d.ref);
    if (aliasRefsToDelete.length > 0) {
      await commitChunkedDeletes(aliasRefsToDelete);
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, COLLECTIONS.LOGIN_ALIASES);
  }

  // Clean all non-root users while strictly preserving isProtectedRoot / amin_khedma_am
  const usersSnap = await getDocs(collection(db, COLLECTIONS.USERS));
  const userRefsToDelete = usersSnap.docs
    .filter((d) => {
      const data = d.data() as FirestoreUser;
      if (data.isProtectedRoot === true || data.role === 'amin_khedma_am') return false;
      if (options.protectedRootUid && d.id === options.protectedRootUid) return false;
      return true;
    })
    .map((d) => d.ref);
  if (userRefsToDelete.length > 0) {
    await commitChunkedDeletes(userRefsToDelete);
  }
}

// --- Pending Registrations Queue ---
export async function submitPendingRegistrationToFirestore(
  registration: FirestorePendingRegistration,
  customId?: string
): Promise<string> {
  const docId = customId || `reg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const path = `${COLLECTIONS.PENDING_REGISTRATIONS}/${docId}`;
  try {
    const cleanData = stripUndefined({
      ...registration,
      status: 'pending',
    });
    await setDoc(doc(db, COLLECTIONS.PENDING_REGISTRATIONS, docId), cleanData);
    return docId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
    throw error;
  }
}

export async function updatePendingRegistrationStatusInFirestore(
  id: string,
  status: 'pending' | 'approved' | 'rejected'
): Promise<void> {
  const path = `${COLLECTIONS.PENDING_REGISTRATIONS}/${id}`;
  try {
    await setDoc(doc(db, COLLECTIONS.PENDING_REGISTRATIONS, id), { status }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
    throw error;
  }
}

export async function deletePendingRegistrationFromFirestore(id: string): Promise<void> {
  const path = `${COLLECTIONS.PENDING_REGISTRATIONS}/${id}`;
  try {
    await deleteDoc(doc(db, COLLECTIONS.PENDING_REGISTRATIONS, id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    throw error;
  }
}

// --- Stages ---
export async function saveStageToFirestore(stage: FirestoreStage): Promise<void> {
  const cleanId = stage.id.trim();
  const path = `${COLLECTIONS.STAGES}/${cleanId}`;
  try {
    const payload = stripUndefined({
      ...stage,
      id: cleanId,
      updatedAt: new Date().toISOString(),
    });
    await setDoc(doc(db, COLLECTIONS.STAGES, cleanId), payload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

export async function batchSaveStagesToFirestore(stages: FirestoreStage[]): Promise<void> {
  if (stages.length === 0) return;
  try {
    const batch = writeBatch(db);
    const now = new Date().toISOString();
    stages.forEach((stage) => {
      const cleanId = stage.id.trim();
      const docRef = doc(db, COLLECTIONS.STAGES, cleanId);
      batch.set(docRef, stripUndefined({ ...stage, id: cleanId, updatedAt: now }), { merge: true });
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, COLLECTIONS.STAGES);
    throw error;
  }
}

export async function deleteStageFromFirestore(stageId: string): Promise<void> {
  const cleanId = stageId.trim();
  const path = `${COLLECTIONS.STAGES}/${cleanId}`;
  try {
    await deleteDoc(doc(db, COLLECTIONS.STAGES, cleanId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    throw error;
  }
}

export async function testFirestoreLiveSync(): Promise<{ success: boolean; latencyMs: number; message: string }> {
  const start = Date.now();
  try {
    const testDocRef = doc(db, 'test', 'live_sync_check');
    const testPayload = {
      timestamp: new Date().toISOString(),
      clientCheck: 'church_admin_verification',
      status: 'active'
    };
    await setDoc(testDocRef, testPayload);
    const snap = await getDoc(testDocRef);
    const latencyMs = Date.now() - start;
    if (snap.exists() && snap.data()?.status === 'active') {
      return {
        success: true,
        latencyMs,
        message: `تم التحقق بنجاح! قاعدة البيانات السحابية (Firestore) متصلة وتستجيب بسرعة (${latencyMs}ms).`
      };
    }
    return {
      success: false,
      latencyMs,
      message: 'تعذر التحقق من قراءة البيانات بعد الكتابة.'
    };
  } catch (err: any) {
    return {
      success: false,
      latencyMs: Date.now() - start,
      message: err.message || 'فشل الاتصال بقاعدة بيانات Firebase Firestore'
    };
  }
}

// --- Attendance ---
export async function saveAttendanceToFirestore(
  entry: FirestoreAttendance
): Promise<void> {
  const docId = `${entry.date}_${entry.eventType}_${entry.personId}`;
  const path = `${COLLECTIONS.ATTENDANCE}/${docId}`;
  try {
    await setDoc(doc(db, COLLECTIONS.ATTENDANCE, docId), stripUndefined(entry));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

export async function batchSaveAttendanceToFirestore(
  entries: FirestoreAttendance[]
): Promise<void> {
  if (entries.length === 0) return;
  try {
    const batch = writeBatch(db);
    entries.forEach((entry) => {
      const docId = `${entry.date}_${entry.eventType}_${entry.personId}`;
      const docRef = doc(db, COLLECTIONS.ATTENDANCE, docId);
      batch.set(docRef, stripUndefined(entry));
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, COLLECTIONS.ATTENDANCE);
    throw error;
  }
}

// --- Library ---
export async function addLibraryBookToFirestore(
  book: FirestoreLibraryBook,
  customId?: string
): Promise<string> {
  try {
    const cleanData = stripUndefined(book);
    if (customId) {
      await setDoc(doc(db, COLLECTIONS.LIBRARY, customId), cleanData);
      return customId;
    } else {
      const ref = await addDoc(collection(db, COLLECTIONS.LIBRARY), cleanData);
      return ref.id;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, COLLECTIONS.LIBRARY);
    throw error;
  }
}

export async function updateLibraryBookInFirestore(
  id: string,
  data: Partial<FirestoreLibraryBook>
): Promise<void> {
  const path = `${COLLECTIONS.LIBRARY}/${id}`;
  try {
    await setDoc(doc(db, COLLECTIONS.LIBRARY, id), sanitizeFirestoreUpdatePayload(data), { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
    throw error;
  }
}

export async function deleteLibraryBookFromFirestore(id: string): Promise<void> {
  const path = `${COLLECTIONS.LIBRARY}/${id}`;
  try {
    await deleteDoc(doc(db, COLLECTIONS.LIBRARY, id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    throw error;
  }
}

// --- Announcements ---
export async function addAnnouncementToFirestore(
  announcement: FirestoreAnnouncement,
  customId?: string
): Promise<string> {
  try {
    const cleanData = stripUndefined(announcement);
    if (customId) {
      await setDoc(doc(db, COLLECTIONS.ANNOUNCEMENTS, customId), cleanData);
      return customId;
    } else {
      const ref = await addDoc(collection(db, COLLECTIONS.ANNOUNCEMENTS), cleanData);
      return ref.id;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, COLLECTIONS.ANNOUNCEMENTS);
    throw error;
  }
}

export async function deleteAnnouncementFromFirestore(id: string): Promise<void> {
  const path = `${COLLECTIONS.ANNOUNCEMENTS}/${id}`;
  try {
    await deleteDoc(doc(db, COLLECTIONS.ANNOUNCEMENTS, id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    throw error;
  }
}

// --- Seasonal Events ---
export async function addSeasonalEventToFirestore(
  event: FirestoreSeasonalEvent,
  customId?: string
): Promise<string> {
  try {
    const cleanData = stripUndefined(event);
    if (customId) {
      await setDoc(doc(db, COLLECTIONS.SEASONAL_EVENTS, customId), cleanData);
      return customId;
    } else {
      const ref = await addDoc(collection(db, COLLECTIONS.SEASONAL_EVENTS), cleanData);
      return ref.id;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, COLLECTIONS.SEASONAL_EVENTS);
    throw error;
  }
}

export async function updateSeasonalEventInFirestore(
  id: string,
  data: Partial<FirestoreSeasonalEvent>
): Promise<void> {
  const path = `${COLLECTIONS.SEASONAL_EVENTS}/${id}`;
  try {
    await setDoc(doc(db, COLLECTIONS.SEASONAL_EVENTS, id), sanitizeFirestoreUpdatePayload(data), { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
    throw error;
  }
}

export async function deleteSeasonalEventFromFirestore(id: string): Promise<void> {
  const path = `${COLLECTIONS.SEASONAL_EVENTS}/${id}`;
  try {
    await deleteDoc(doc(db, COLLECTIONS.SEASONAL_EVENTS, id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    throw error;
  }
}
