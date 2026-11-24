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
  limit
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';

// ============================================================================
// 1. Data Schema Interfaces (Matching Firestore Collections Exactly)
// ============================================================================

export interface FirestoreUser {
  uid: string;
  fullName: string;
  phone: string;
  role: string;
  assignedClass: string;
  isFirstLogin: boolean;
  username?: string;
  passwordHash?: string;
  assignments?: { stageId: string; stageName: string; role: string }[];
  isProtectedRoot?: boolean;
  isAdminAssistant?: boolean;
  canAssignMakhdomeen?: boolean;
  mustChangePassword?: boolean;
  avatarUrl?: string;
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
  phone: string;
  parentPhone: string;
  parentName?: string;
  parentRelation?: string;
  parentJob?: string;
  parent2Name?: string;
  parent2Phone?: string;
  parent2Relation?: string;
  parent2Job?: string;
}

export interface FirestoreAttendance {
  date: string;
  month: number;
  personId: string;
  personType: string; // 'child' | 'servant' | 'supervisor'
  eventType: string;  // 'mass' | 'sunday_school' | 'festival' | 'mahragan' | 'service_meeting' | 'supervisors_meeting'
  status: string;     // 'present' | 'absent' | 'late' | 'excused'
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
}

export interface FirestoreAnnouncement {
  title: string;
  body: string;
  targetRole: string;
  targetScope?: 'all' | 'general_dock' | 'specific_stages';
  targetStages?: string[];
  createdAt: string;
}

// Collection Names
export const COLLECTIONS = {
  USERS: 'users',
  MAKHDOMEEN: 'makhdomeen',
  ATTENDANCE: 'attendance',
  LIBRARY: 'library',
  ANNOUNCEMENTS: 'announcements',
  PENDING_REGISTRATIONS: 'pending_registrations',
} as const;

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
      const data = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as FirestoreUser),
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

// ============================================================================
// 3. Write / Mutate Operations
// ============================================================================

// --- Makhdomeen ---
export async function addMakhdoomToFirestore(
  makhdoom: FirestoreMakhdoom,
  customId?: string
): Promise<string> {
  try {
    if (customId) {
      await setDoc(doc(db, COLLECTIONS.MAKHDOMEEN, customId), makhdoom);
      return customId;
    } else {
      const ref = await addDoc(collection(db, COLLECTIONS.MAKHDOMEEN), makhdoom);
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
    await setDoc(doc(db, COLLECTIONS.MAKHDOMEEN, id), data, { merge: true });
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
      batch.set(docRef, data);
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, COLLECTIONS.MAKHDOMEEN);
    throw error;
  }
}

export async function batchUpdateMakhdomeenStagesInFirestore(
  updates: { id: string; stage: string }[]
): Promise<void> {
  try {
    const batch = writeBatch(db);
    updates.forEach((u) => {
      const docRef = doc(db, COLLECTIONS.MAKHDOMEEN, u.id);
      batch.update(docRef, { stage: u.stage });
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, COLLECTIONS.MAKHDOMEEN);
    throw error;
  }
}

// --- Users ---
export async function getUserFromFirestore(uidOrIdentifier: string): Promise<FirestoreUser | null> {
  const cleanId = uidOrIdentifier.trim();
  const cleanLower = cleanId.toLowerCase();
  const path = `${COLLECTIONS.USERS}/${cleanId}`;
  try {
    // 1. Direct document lookup by doc ID (exact and lowercase)
    const snapLower = await getDoc(doc(db, COLLECTIONS.USERS, cleanLower));
    if (snapLower.exists()) {
      return { ...(snapLower.data() as Omit<FirestoreUser, 'uid'>), uid: snapLower.id };
    }

    const snap = await getDoc(doc(db, COLLECTIONS.USERS, cleanId));
    if (snap.exists()) {
      return { ...(snap.data() as Omit<FirestoreUser, 'uid'>), uid: snap.id };
    }

    // 2. Query by username (both lowercase and exact)
    const qUsernameLower = query(collection(db, COLLECTIONS.USERS), where('username', '==', cleanLower), limit(1));
    const usernameLowerSnap = await getDocs(qUsernameLower);
    if (!usernameLowerSnap.empty) {
      const firstDoc = usernameLowerSnap.docs[0];
      return { ...(firstDoc.data() as Omit<FirestoreUser, 'uid'>), uid: firstDoc.id };
    }

    const qUsername = query(collection(db, COLLECTIONS.USERS), where('username', '==', cleanId), limit(1));
    const usernameSnap = await getDocs(qUsername);
    if (!usernameSnap.empty) {
      const firstDoc = usernameSnap.docs[0];
      return { ...(firstDoc.data() as Omit<FirestoreUser, 'uid'>), uid: firstDoc.id };
    }

    // 3. Query by phone if identifier was a phone number
    const qPhone = query(collection(db, COLLECTIONS.USERS), where('phone', '==', cleanId), limit(1));
    const phoneSnap = await getDocs(qPhone);
    if (!phoneSnap.empty) {
      const firstDoc = phoneSnap.docs[0];
      return { ...(firstDoc.data() as Omit<FirestoreUser, 'uid'>), uid: firstDoc.id };
    }

    // 4. Query by fullName if identifier was a full name
    const qName = query(collection(db, COLLECTIONS.USERS), where('fullName', '==', cleanId), limit(1));
    const nameSnap = await getDocs(qName);
    if (!nameSnap.empty) {
      const firstDoc = nameSnap.docs[0];
      return { ...(firstDoc.data() as Omit<FirestoreUser, 'uid'>), uid: firstDoc.id };
    }

    // 5. Fallback scan of all users in collection if queries missed case variations
    const allUsersSnap = await getDocs(collection(db, COLLECTIONS.USERS));
    for (const d of allUsersSnap.docs) {
      const data = d.data() as Omit<FirestoreUser, 'uid'>;
      if (
        (data.username && data.username.toLowerCase() === cleanLower) ||
        (data.phone && data.phone.trim() === cleanId) ||
        (data.fullName && data.fullName.toLowerCase() === cleanLower) ||
        d.id.toLowerCase() === cleanLower
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
  const usernameKey = (user.username || user.uid).toLowerCase().trim();
  const path = `${COLLECTIONS.USERS}/${usernameKey}`;
  try {
    const payload = {
      ...user,
      username: (user.username || usernameKey).toLowerCase().trim(),
      updatedAt: new Date().toISOString()
    };
    // 1. Store with document ID = username for instant O(1) lookup
    await setDoc(doc(db, COLLECTIONS.USERS, usernameKey), payload, { merge: true });
    // 2. Also store with document ID = uid if different
    if (user.uid && user.uid !== usernameKey) {
      await setDoc(doc(db, COLLECTIONS.USERS, user.uid), payload, { merge: true });
    }
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
  const cleanLower = cleanId.toLowerCase();
  const path = `${COLLECTIONS.USERS}/${cleanId}`;
  try {
    const payload: Record<string, any> = {
      ...data,
      uid: data.uid || cleanId,
      updatedAt: new Date().toISOString()
    };
    if (data.assignedStage && !data.assignedClass) {
      payload.assignedClass = data.assignedStage;
    }
    if (data.assignedClass && !data.assignedStage) {
      payload.assignedStage = data.assignedClass;
    }
    // Always use setDoc with { merge: true } to create document if not existing
    // and prevent 'FirebaseError: No document to update'
    await setDoc(doc(db, COLLECTIONS.USERS, cleanId), payload, { merge: true });

    // If username is provided, also sync the username-keyed document
    if (data.username) {
      const usernameKey = data.username.toLowerCase().trim();
      if (usernameKey !== cleanId) {
        await setDoc(doc(db, COLLECTIONS.USERS, usernameKey), payload, { merge: true });
      }
    } else if (cleanLower !== cleanId) {
      await setDoc(doc(db, COLLECTIONS.USERS, cleanLower), payload, { merge: true });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
    throw error;
  }
}

export async function deleteUserFromFirestore(uidOrUsername: string): Promise<void> {
  const clean = uidOrUsername.trim();
  const cleanLower = clean.toLowerCase();
  const path = `${COLLECTIONS.USERS}/${clean}`;
  try {
    // 1. Delete document by direct ID
    await deleteDoc(doc(db, COLLECTIONS.USERS, clean));
    if (cleanLower !== clean) {
      await deleteDoc(doc(db, COLLECTIONS.USERS, cleanLower));
    }
    // 2. Query and delete any matching documents by username field
    const qSnap = await getDocs(query(collection(db, COLLECTIONS.USERS), where('username', '==', cleanLower)));
    for (const d of qSnap.docs) {
      await deleteDoc(d.ref);
    }
    // 3. Query and delete any matching documents by uid field
    const qUidSnap = await getDocs(query(collection(db, COLLECTIONS.USERS), where('uid', '==', clean)));
    for (const d of qUidSnap.docs) {
      await deleteDoc(d.ref);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    throw error;
  }
}

export async function clearAllNonAdminUsersFromFirestore(adminUid: string): Promise<void> {
  const usersSnap = await getDocs(collection(db, COLLECTIONS.USERS));
  const batch = writeBatch(db);
  let count = 0;
  for (const d of usersSnap.docs) {
    const data = d.data() as FirestoreUser;
    if (d.id !== adminUid && d.id !== 'admin' && data.role !== 'amin_khedma_am' && data.username?.toLowerCase() !== 'admin') {
      batch.delete(d.ref);
      count++;
    }
  }
  if (count > 0) {
    await batch.commit();
  }
}

export async function clearAllMakhdomeenFromFirestore(): Promise<void> {
  const snap = await getDocs(collection(db, COLLECTIONS.MAKHDOMEEN));
  const batch = writeBatch(db);
  let count = 0;
  for (const d of snap.docs) {
    batch.delete(d.ref);
    count++;
    if (count >= 450) {
      await batch.commit();
      count = 0;
    }
  }
  if (count > 0) {
    await batch.commit();
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
  // Deterministic ID ensures one record per person per event per date
  const docId = `${entry.date}_${entry.eventType}_${entry.personId}`;
  const path = `${COLLECTIONS.ATTENDANCE}/${docId}`;
  try {
    await setDoc(doc(db, COLLECTIONS.ATTENDANCE, docId), entry);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

export async function batchSaveAttendanceToFirestore(
  entries: FirestoreAttendance[]
): Promise<void> {
  try {
    const batch = writeBatch(db);
    entries.forEach((entry) => {
      const docId = `${entry.date}_${entry.eventType}_${entry.personId}`;
      const docRef = doc(db, COLLECTIONS.ATTENDANCE, docId);
      batch.set(docRef, entry);
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
    if (customId) {
      await setDoc(doc(db, COLLECTIONS.LIBRARY, customId), book);
      return customId;
    } else {
      const ref = await addDoc(collection(db, COLLECTIONS.LIBRARY), book);
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
    await setDoc(doc(db, COLLECTIONS.LIBRARY, id), data, { merge: true });
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
    if (customId) {
      await setDoc(doc(db, COLLECTIONS.ANNOUNCEMENTS, customId), announcement);
      return customId;
    } else {
      const ref = await addDoc(collection(db, COLLECTIONS.ANNOUNCEMENTS), announcement);
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
