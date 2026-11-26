import React, { createContext, useContext, useState, useEffect, useRef, useMemo } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import {
  Role, Stage, StageItem, AssistantSupervisor, ClassAssignment, ClassAssignmentRole,
  Child, Servant, Supervisor, Book, AttendanceRecord, AttendanceStatus,
  ChildEventType, StaffEventType, FilterState, AppUser, ChurchEventNotification,
  ThemeMode, PendingRegistration, SeasonalEvent
} from '../types';
import { calculateDynamicAge } from '../utils/ageUtils';
import {
  hashPassword,
  hashPasswordSync,
  verifyPassword,
  validateUsername,
  isPasswordEncrypted,
  generateRandomTempPassword
} from '../utils/cryptoUtils';
import {
  listenToMakhdomeen,
  listenToUsers,
  listenToAttendance,
  listenToLibrary,
  listenToAnnouncements,
  listenToStages,
  listenToPendingRegistrations,
  listenToSeasonalEvents,
  addMakhdoomToFirestore,
  updateMakhdoomInFirestore,
  deleteMakhdoomFromFirestore,
  batchAddMakhdomeenToFirestore,
  batchUpdateMakhdomeenStagesInFirestore,
  addUserToFirestore,
  updateUserInFirestore,
  batchUpdateUsersInFirestore,
  deleteUserFromFirestore,
  saveAttendanceToFirestore,
  batchSaveAttendanceToFirestore,
  addLibraryBookToFirestore,
  updateLibraryBookInFirestore,
  deleteLibraryBookFromFirestore,
  addAnnouncementToFirestore,
  deleteAnnouncementFromFirestore,
  addSeasonalEventToFirestore,
  updateSeasonalEventInFirestore,
  deleteSeasonalEventFromFirestore,
  saveStageToFirestore,
  batchSaveStagesToFirestore,
  deleteStageFromFirestore,
  submitPendingRegistrationToFirestore,
  updatePendingRegistrationStatusInFirestore,
  deletePendingRegistrationFromFirestore,
  getUserFromFirestore,
  clearAllNonAdminUsersFromFirestore,
  clearAllMakhdomeenFromFirestore,
  checkRootBootstrapStatusFromFirestore,
  ensureRootBootstrapLockInFirestore,
  seedRootAdminOnceInFirestore,
  doesExactUsernameAliasExist,
  resolveAuthEmailViaAlias,
  syncUserLoginAliases,
  migrateUserAuthUidInFirestore,
  wipeAllDatabaseFromFirestore
} from '../services/firestoreService';
import {
  auth,
  generateUniqueInternalAuthEmail,
  createRootFirebaseAuthUser,
  loginWithFirebaseAuth,
  provisionFirebaseAuthUser,
  signInAnonymouslyForPendingRegistration,
  updateFirebaseUserPassword,
  formatSafeFirebasePass,
  logoutFirebaseAuth,
  setFirestoreUserWithMerge
} from '../firebase';

export type TabId =
  | 'home'
  | 'library'
  | 'children_directory'
  | 'children_attendance'
  | 'servants_directory'
  | 'servants_attendance'
  | 'supervisors_directory'
  | 'supervisors_attendance';

interface AppContextType {
  role: Role;
  effectiveRole: Role;
  setRole: (role: Role) => void;
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;

  // Multi-Class Tree Context Switcher
  activeStageId: string;
  activeStageName: string;
  activeRoleInStage: Role | 'all';
  setActiveStageContext: (stageIdOrName: string) => void;

  // Stages & Services List Management
  stagesList: StageItem[];
  addStage: (name: string, description?: string, supervisorName?: string, supervisorPhone?: string) => Promise<void>;
  updateStage: (
    stageId: string,
    updatedData: {
      name: string;
      description?: string;
      supervisorName?: string;
      supervisorPhone?: string;
      assistantSupervisors?: AssistantSupervisor[];
      meetingTime?: string;
    }
  ) => Promise<void>;
  deleteStage: (stageName: string) => Promise<void>;

  // Auth & User State
  currentUser: AppUser | null;
  users: AppUser[];
  pendingRegistrations: PendingRegistration[];
  isRootInitialized: boolean | null;
  initializeRootAdmin: (data: {
    name: string;
    username: string;
    phone: string;
    password: string;
  }) => Promise<{ success: boolean; error?: string }>;
  login: (username: string, pass: string) => Promise<{ success: boolean; error?: string; isTemp?: boolean }>;
  registerServant: (data: {
    name: string;
    username: string;
    password?: string;
    phone: string;
    area?: string;
    job?: string;
    birthDate: string;
    assignedStage: string;
    notes?: string;
  }) => Promise<{ success: boolean; error?: string; pendingApproval?: boolean }>;
  approvePendingRegistration: (
    regId: string,
    options: {
      role: Role;
      assignedStage: Stage;
      assignments?: ClassAssignment[];
      tempPassword?: string;
    }
  ) => Promise<{ success: boolean; error?: string }>;
  rejectPendingRegistration: (regId: string) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (userId: string, newPass: string) => Promise<void>;
  createUser: (userData: Omit<AppUser, 'id' | 'createdAt'>) => Promise<{ success: boolean; error?: string }>;
  updateUser: (id: string, userData: Partial<AppUser>) => Promise<{ success: boolean; error?: string }>;
  deleteUser: (id: string) => Promise<void>;
  resetUserTempPassword: (id: string, tempPass: string) => Promise<{ success: boolean; error?: string }>;
  clearAllNonAdminUsers: () => Promise<void>;
  clearAllMakhdomeen: () => Promise<void>;

  // Notifications & Events
  notifications: ChurchEventNotification[];
  addNotification: (notif: Omit<ChurchEventNotification, 'id' | 'createdAt'>) => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;

  // Seasonal Events
  seasonalEvents: SeasonalEvent[];
  addSeasonalEvent: (event: Omit<SeasonalEvent, 'id' | 'createdAt'>) => Promise<void>;
  updateSeasonalEvent: (id: string, data: Partial<SeasonalEvent>) => Promise<void>;
  deleteSeasonalEvent: (id: string) => Promise<void>;

  // Stage Scoping
  selectedStageScope: Stage | 'all';
  setSelectedStageScope: (stage: Stage | 'all') => void;

  // Data State
  children: Child[];
  servants: Servant[];
  supervisors: Supervisor[];
  books: Book[];
  attendance: AttendanceRecord[];

  // Children Actions
  addChild: (child: Omit<Child, 'id' | 'createdAt'>) => Promise<void>;
  batchAddChildren: (children: Omit<Child, 'id' | 'createdAt'>[]) => Promise<void>;
  updateChild: (id: string, child: Partial<Child>) => Promise<void>;
  deleteChild: (id: string) => Promise<void>;

  // Servants Actions
  addServant: (servant: Omit<Servant, 'id' | 'createdAt'>) => Promise<void>;
  updateServant: (id: string, servant: Partial<Servant>) => Promise<void>;
  deleteServant: (id: string) => Promise<void>;

  // Supervisors Actions
  addSupervisor: (supervisor: Omit<Supervisor, 'id' | 'createdAt'> & { servantId?: string }) => Promise<void>;
  updateSupervisor: (id: string, supervisor: Partial<Supervisor>) => Promise<void>;
  deleteSupervisor: (id: string) => Promise<void>;

  // Books Actions
  addBook: (book: Omit<Book, 'id'>) => Promise<void>;
  updateBook: (id: string, book: Partial<Book>) => Promise<void>;
  deleteBook: (id: string) => Promise<void>;

  // Attendance Actions
  markAttendance: (
    targetType: 'child' | 'servant' | 'supervisor',
    eventType: ChildEventType | StaffEventType,
    date: string,
    personId: string,
    status: AttendanceStatus,
    note?: string
  ) => Promise<void>;
  markAllAttendance: (
    targetType: 'child' | 'servant' | 'supervisor',
    eventType: ChildEventType | StaffEventType,
    date: string,
    personIds: string[],
    status: AttendanceStatus
  ) => Promise<void>;
  getAttendanceRecord: (
    targetType: 'child' | 'servant' | 'supervisor',
    eventType: ChildEventType | StaffEventType,
    date: string
  ) => AttendanceRecord | undefined;

  // Database Management
  clearAllDatabase: () => Promise<void>;
  exportDatabaseJSON: () => string;
  importDatabaseJSON: (jsonString: string) => { success: boolean; error?: string };

  // Operations
  unassignAllServantsFromClasses: () => { servantsUpdated: number; supervisorsUpdated: number; classesCleared: number };
  moveServantsToGeneralDock: (stageOrAll?: string) => Promise<number>;
  assignServantRole: (
    servantId: string,
    stage: string,
    roleType?: 'captain' | 'first_mate' | 'crew' | 'general_dock',
    roleTitle?: string,
    additionalAssignments?: ClassAssignment[]
  ) => Promise<void>;
  updatePersonalProfile: (profileData: Partial<AppUser>) => Promise<void>;
  promoteAllStages: () => { promotedCount: number; graduationCount: number; details: Record<string, number> };

  // Global Search & Filters
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  resetFilters: () => void;

  // Theme & Dark Mode
  theme: ThemeMode;
  toggleTheme: () => void;
  setTheme: (theme: ThemeMode) => void;
}

const defaultFilters: FilterState = {
  searchQuery: '',
  stageFilter: 'all',
  birthMonthFilter: 'all',
  ageFilter: 'all',
  areaFilter: 'all'
};

const AppContext = createContext<AppContextType | undefined>(undefined);

const DOMAIN_STORAGE_KEYS = [
  'church_app_stages_list',
  'church_app_users',
  'church_app_role',
  'church_app_current_user',
  'church_app_notifications',
  'church_app_children',
  'church_app_servants',
  'church_app_supervisors',
  'church_app_books',
  'church_app_attendance',
  'church_app_seasonal_events'
] as const;

function purgeDomainLocalStorage(): void {
  try {
    DOMAIN_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
  } catch {
    // ignore storage errors
  }
}

const RANK_WEIGHT: Record<string, number> = {
  amin_khedma_am: 5,
  amin_fasl: 4,
  mosaed_amin: 3,
  khadem: 2,
  general_dock: 1
};

function resolveStageItem(stageKey: string, stages: StageItem[]): StageItem | undefined {
  const clean = (stageKey || '').trim();
  if (!clean) return undefined;
  return stages.find(s => s.id === clean || s.name === clean);
}

function buildAssignmentsForUser(
  user: Partial<AppUser>,
  stages: StageItem[]
): ClassAssignment[] {
  const rawList: ClassAssignment[] = [];
  if (Array.isArray(user.assignments) && user.assignments.length > 0) {
    user.assignments.forEach(a => {
      if (!a || (!a.stageId && !a.stageName)) return;
      const found = resolveStageItem(a.stageId || a.stageName, stages);
      const stageName = found?.name || a.stageName || a.stageId;
      const stageId = found?.id || a.stageId || stageName;
      if (!stageName || stageName === 'في انتظار التعيين') return;
      const roleVal: ClassAssignmentRole =
        a.role === 'amin_fasl' || a.role === 'mosaed_amin' || a.role === 'khadem'
          ? a.role
          : 'khadem';
      rawList.push({ stageId, stageName, role: roleVal });
    });
  } else if (user.role !== 'amin_khedma_am') {
    const primaryStage = (user.assignedStage || '').trim();
    if (primaryStage && primaryStage !== 'عامة' && primaryStage !== 'في انتظار التعيين') {
      const found = resolveStageItem(primaryStage, stages);
      const primaryRole: ClassAssignmentRole =
        user.role === 'amin_fasl' || user.role === 'mosaed_amin' ? user.role : 'khadem';
      rawList.push({
        stageId: found?.id || primaryStage,
        stageName: found?.name || primaryStage,
        role: primaryRole
      });
    }
    if (Array.isArray(user.assignedStages)) {
      user.assignedStages.forEach(st => {
        const cleanSt = (st || '').trim();
        if (!cleanSt || cleanSt === 'عامة' || cleanSt === 'في انتظار التعيين') return;
        const found = resolveStageItem(cleanSt, stages);
        rawList.push({
          stageId: found?.id || cleanSt,
          stageName: found?.name || cleanSt,
          role: 'khadem'
        });
      });
    }
  }

  // Strictly deduplicate same stage within assignments
  const deduped = new Map<string, ClassAssignment>();
  rawList.forEach(item => {
    const key = (item.stageName || item.stageId).trim();
    const existing = deduped.get(key);
    if (!existing || RANK_WEIGHT[item.role] > RANK_WEIGHT[existing.role]) {
      deduped.set(key, item);
    }
  });
  return Array.from(deduped.values());
}

function validateAssignmentsInvariants(
  targetUserId: string | null,
  candidateAssignments: ClassAssignment[],
  allUsers: AppUser[],
  targetRole: Role
): string | null {
  // 1. Check no duplicate stage in candidate assignments
  const seenStages = new Set<string>();
  for (const a of candidateAssignments) {
    const key = (a.stageName || a.stageId).trim();
    if (!key) continue;
    if (seenStages.has(key)) {
      return `لا يمكن تكرار نفس المرحلة (${key}) أكثر من مرة لنفس الخادم.`;
    }
    seenStages.add(key);
  }

  // 2. Enforce strictly max 1 amin_fasl per stage across all users
  if (targetRole !== 'amin_khedma_am') {
    for (const a of candidateAssignments) {
      if (a.role === 'amin_fasl') {
        const stageName = (a.stageName || a.stageId).trim();
        const conflict = allUsers.find(u => {
          if (targetUserId && (u.id === targetUserId || u.uid === targetUserId)) return false;
          if (u.role === 'amin_khedma_am') return false;
          if (Array.isArray(u.assignments) && u.assignments.length > 0) {
            return u.assignments.some(
              ua => ua.role === 'amin_fasl' && (ua.stageName === stageName || ua.stageId === a.stageId)
            );
          }
          return u.role === 'amin_fasl' && u.assignedStage === stageName;
        });
        if (conflict) {
          return `يوجد بالفعل أمين فصل معيّن لمرحلة (${stageName}) وهو: ${conflict.name}. لا يمكن تعيين أكثر من أمين فصل لنفس المرحلة.`;
        }
      }
    }
  }

  return null;
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children: childrenProps }) => {
  const [firebaseAuthState, setFirebaseAuthState] = useState<{ uid: string | null; isAnonymous: boolean }>({
    uid: auth.currentUser?.uid || null,
    isAnonymous: Boolean(auth.currentUser?.isAnonymous)
  });
  const [approvedCurrentUserLoaded, setApprovedCurrentUserLoaded] = useState<boolean>(false);
  const inFlightAuthTransitionRef = useRef<boolean>(false);
  const authCheckSeqRef = useRef<number>(0);

  // Purge any legacy localStorage copies of Firestore collections on mount
  useEffect(() => {
    purgeDomainLocalStorage();
  }, []);

  // Stages / Services State (Strictly hydrated from Firestore onSnapshot — zero localStorage copy)
  const [stagesList, setStagesList] = useState<StageItem[]>([]);
  const [isRootInitialized, setIsRootInitialized] = useState<boolean | null>(null);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [pendingRegistrations, setPendingRegistrations] = useState<PendingRegistration[]>([]);

  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => {
    const saved = sessionStorage.getItem('church_app_current_user');
    if (saved) {
      try {
        const u: AppUser = JSON.parse(saved);
        if (u.password && !isPasswordEncrypted(u.password)) {
          u.password = hashPasswordSync(u.password);
        }
        return u;
      } catch {
        return null;
      }
    }
    return null;
  });

  const [role, setRoleState] = useState<Role>(() => {
    if (currentUser) return currentUser.role;
    return 'khadem';
  });

  const [activeTab, setActiveTabState] = useState<TabId>(() => {
    try {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const tabParam = params.get('tab') as TabId;
        const validTabs: TabId[] = [
          'home',
          'library',
          'children_directory',
          'children_attendance',
          'servants_directory',
          'servants_attendance',
          'supervisors_directory',
          'supervisors_attendance'
        ];
        if (tabParam && validTabs.includes(tabParam)) {
          return tabParam;
        }
      }
    } catch {
      // ignore
    }
    return 'home';
  });

  useEffect(() => {
    const handlePopState = () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const tabParam = (params.get('tab') as TabId) || 'home';
        setActiveTabState(tabParam);
      } catch {
        // ignore
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Multi-Class Context Switcher State
  const [activeStageId, setActiveStageId] = useState<string>(() => {
    if (currentUser?.role === 'amin_khedma_am' || currentUser?.isAdminAssistant) return 'all';
    const firstAssign = currentUser?.assignments?.[0];
    if (firstAssign) return firstAssign.stageId;
    if (currentUser?.assignedStage && currentUser.assignedStage !== 'عامة' && currentUser.assignedStage !== 'في انتظار التعيين') {
      const found = resolveStageItem(currentUser.assignedStage, stagesList);
      return found?.id || currentUser.assignedStage;
    }
    return 'all';
  });

  const [activeRoleInStage, setActiveRoleInStage] = useState<Role | 'all'>(() => {
    if (!currentUser) return 'khadem';
    if (currentUser.role === 'amin_khedma_am') return 'amin_khedma_am';
    const firstAssign = currentUser.assignments?.[0];
    if (firstAssign) return firstAssign.role;
    return currentUser.role;
  });

  const [selectedStageScope, setSelectedStageScopeState] = useState<Stage | 'all'>(() => {
    if (currentUser?.role === 'amin_khedma_am' || currentUser?.isAdminAssistant) return 'all';
    const firstAssign = currentUser?.assignments?.[0];
    if (firstAssign) return firstAssign.stageName;
    if (currentUser && currentUser.assignedStage && currentUser.assignedStage !== 'عامة' && currentUser.assignedStage !== 'في انتظار التعيين') {
      return currentUser.assignedStage;
    }
    return 'all';
  });

  const effectiveRole: Role = useMemo(() => {
    if (!currentUser) return role;
    if (currentUser.role === 'amin_khedma_am') return 'amin_khedma_am';
    if (currentUser.isAdminAssistant) return 'amin_khedma_am';
    if (activeRoleInStage && activeRoleInStage !== 'all') return activeRoleInStage;
    return currentUser.role;
  }, [currentUser, activeRoleInStage, role]);

  const activeStageName: string = useMemo(() => {
    if (activeStageId === 'all') return 'all';
    const found = resolveStageItem(activeStageId, stagesList);
    if (found) return found.name;
    if (selectedStageScope !== 'all') return selectedStageScope;
    return activeStageId;
  }, [activeStageId, stagesList, selectedStageScope]);

  // Theme & Dark Mode State
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('church_app_theme');
    if (saved === 'dark' || saved === 'light') return saved as ThemeMode;
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  });

  useEffect(() => {
    try {
      localStorage.setItem('church_app_theme', theme);
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } catch (e) {
      console.error(e);
    }
  }, [theme]);

  const toggleTheme = () => setThemeState(prev => (prev === 'light' ? 'dark' : 'light'));
  const setTheme = (newTheme: ThemeMode) => setThemeState(newTheme);

  const [notifications, setNotifications] = useState<ChurchEventNotification[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [servants, setServants] = useState<Servant[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [seasonalEvents, setSeasonalEvents] = useState<SeasonalEvent[]>([]);

  // Auth listener clears stale session/memory on sign-out and verifies /users/{uid} before enabling Firestore listeners
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      const checkSeq = ++authCheckSeqRef.current;
      setFirebaseAuthState({
        uid: fbUser?.uid || null,
        isAnonymous: Boolean(fbUser?.isAnonymous)
      });

      if (!fbUser || fbUser.isAnonymous) {
        if (!inFlightAuthTransitionRef.current) {
          setApprovedCurrentUserLoaded(false);
          setCurrentUser(null);
          sessionStorage.removeItem('church_app_current_user');
          purgeDomainLocalStorage();
          setUsers([]);
          setChildren([]);
          setServants([]);
          setSupervisors([]);
          setBooks([]);
          setAttendance([]);
          setNotifications([]);
          setStagesList([]);
          setSeasonalEvents([]);
          setPendingRegistrations([]);
        }
        return;
      }

      // Skip re-verification if initializeRootAdmin or login is actively managing the transition
      if (inFlightAuthTransitionRef.current) {
        return;
      }

      try {
        let firestoreUser = await getUserFromFirestore(fbUser.uid);
        if (!firestoreUser && fbUser.email) {
          const emailLocal = fbUser.email.split('@')[0];
          if (emailLocal) {
            firestoreUser = await getUserFromFirestore(emailLocal);
          }
        }

        if (checkSeq !== authCheckSeqRef.current || inFlightAuthTransitionRef.current) {
          return;
        }

        if (!firestoreUser) {
          setApprovedCurrentUserLoaded(false);
          setCurrentUser(null);
          sessionStorage.removeItem('church_app_current_user');
          return;
        }

        const docId = firestoreUser.uid;
        const rawRole = (firestoreUser.role as Role) || 'khadem';
        const effectiveStage = (firestoreUser.assignedStage || firestoreUser.assignedClass || 'عامة') as Stage;
        const assignments = buildAssignmentsForUser(
          {
            role: rawRole,
            assignedStage: effectiveStage,
            assignedStages: firestoreUser.assignedStages,
            assignments: firestoreUser.assignments as ClassAssignment[] | undefined
          },
          stagesListRef.current
        );
        const existingCurr = currentUserRef.current;
        const mappedUser: AppUser = {
          id: docId,
          uid: docId,
          username: firestoreUser.username || docId,
          authEmail: firestoreUser.authEmail || fbUser.email || '',
          name: firestoreUser.fullName || existingCurr?.name || firestoreUser.username || docId,
          phone: firestoreUser.phone || existingCurr?.phone || '',
          avatarUrl: firestoreUser.avatarUrl || existingCurr?.avatarUrl || '',
          role: rawRole,
          assignedStage: (assignments[0]?.stageName || effectiveStage) as Stage,
          assignedStages: assignments.slice(1).map(a => a.stageName),
          assignments,
          isProtectedRoot: Boolean(firestoreUser.isProtectedRoot || rawRole === 'amin_khedma_am'),
          isAdminAssistant: Boolean(firestoreUser.isAdminAssistant),
          canAssignMakhdomeen: firestoreUser.canAssignMakhdomeen !== undefined ? Boolean(firestoreUser.canAssignMakhdomeen) : true,
          mustChangePassword: Boolean(firestoreUser.mustChangePassword || firestoreUser.isFirstLogin),
          isTempPassword: Boolean(firestoreUser.isFirstLogin || firestoreUser.mustChangePassword),
          password: firestoreUser.passwordHash || existingCurr?.password || '',
          birthDate: firestoreUser.birthDate || existingCurr?.birthDate,
          job: firestoreUser.job || existingCurr?.job,
          area: firestoreUser.area || existingCurr?.area,
          notes: firestoreUser.notes || existingCurr?.notes,
          createdAt: firestoreUser.createdAt || existingCurr?.createdAt || new Date().toISOString().split('T')[0],
          updatedAt: firestoreUser.updatedAt
        };

        const isNewUserSession = existingCurr?.id !== mappedUser.id;
        setCurrentUser(mappedUser);
        setRoleState(mappedUser.role);
        setIsRootInitialized(true);
        if (isNewUserSession) {
          applyStageContextForUser(mappedUser);
        }
        setApprovedCurrentUserLoaded(true);
      } catch {
        if (checkSeq === authCheckSeqRef.current && !inFlightAuthTransitionRef.current) {
          setApprovedCurrentUserLoaded(false);
        }
      }
    });
    return () => unsub();
  }, []);

  const addSeasonalEvent = async (eventData: Omit<SeasonalEvent, 'id' | 'createdAt'>) => {
    const newEvent: SeasonalEvent = {
      id: `ev_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      ...eventData,
      createdAt: new Date().toISOString().split('T')[0]
    };
    setSeasonalEvents(prev => [newEvent, ...prev]);
    try {
      await addSeasonalEventToFirestore(newEvent, newEvent.id);
    } catch (err) {
      console.warn('Failed to add seasonal event to Firestore:', err);
    }
  };

  const updateSeasonalEvent = async (id: string, data: Partial<SeasonalEvent>) => {
    setSeasonalEvents(prev => prev.map(e => (e.id === id ? { ...e, ...data } : e)));
    try {
      await updateSeasonalEventInFirestore(id, data);
    } catch (err) {
      console.warn('Failed to update seasonal event in Firestore:', err);
    }
  };

  const deleteSeasonalEvent = async (id: string) => {
    setSeasonalEvents(prev => prev.filter(e => e.id !== id));
    try {
      await deleteSeasonalEventFromFirestore(id);
    } catch (err) {
      console.warn('Failed to delete seasonal event from Firestore:', err);
    }
  };

  const [filters, setFilters] = useState<FilterState>(defaultFilters);

  // Live Refs (Prevent stale closures in async & batch operations)
  const usersRef = useRef(users);
  const childrenRef = useRef(children);
  const servantsRef = useRef(servants);
  const supervisorsRef = useRef(supervisors);
  const stagesListRef = useRef(stagesList);
  const currentUserRef = useRef(currentUser);

  useEffect(() => { usersRef.current = users; }, [users]);
  useEffect(() => { childrenRef.current = children; }, [children]);
  useEffect(() => { servantsRef.current = servants; }, [servants]);
  useEffect(() => { supervisorsRef.current = supervisors; }, [supervisors]);
  useEffect(() => { stagesListRef.current = stagesList; }, [stagesList]);
  useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);

  // Keep only tab-scoped active session user (no localStorage copies of Firestore collections)
  useEffect(() => {
    if (currentUser) {
      sessionStorage.setItem('church_app_current_user', JSON.stringify(currentUser));
      setRoleState(effectiveRole);
    } else {
      sessionStorage.removeItem('church_app_current_user');
    }
  }, [currentUser, effectiveRole]);

  // Helper to apply user context cleanly after login or context switch
  const applyStageContextForUser = (u: AppUser, targetStageKey?: string) => {
    const stages = stagesListRef.current;
    const normalizedAssignments = buildAssignmentsForUser(u, stages);

    if (u.role === 'amin_khedma_am' || u.isAdminAssistant) {
      if (targetStageKey && targetStageKey !== 'all') {
        const stg = resolveStageItem(targetStageKey, stages);
        const stgId = stg?.id || targetStageKey;
        const stgName = stg?.name || targetStageKey;
        setActiveStageId(stgId);
        setActiveRoleInStage('amin_khedma_am');
        setSelectedStageScopeState(stgName);
        setFilters(prev => ({ ...prev, stageFilter: stgName }));
      } else {
        setActiveStageId('all');
        setActiveRoleInStage('amin_khedma_am');
        setSelectedStageScopeState('all');
        setFilters(prev => ({ ...prev, stageFilter: 'all' }));
      }
      return;
    }

    if (normalizedAssignments.length > 0) {
      const matched = targetStageKey
        ? normalizedAssignments.find(a => a.stageId === targetStageKey || a.stageName === targetStageKey)
        : undefined;
      const chosen = matched || normalizedAssignments[0];
      setActiveStageId(chosen.stageId);
      setActiveRoleInStage(chosen.role);
      setSelectedStageScopeState(chosen.stageName);
      setFilters(prev => ({ ...prev, stageFilter: chosen.stageName }));

      // Guard tabs when switching into a stage where user is strictly a khadem
      if (chosen.role === 'khadem') {
        setActiveTabState(currTab =>
          currTab === 'servants_directory' ||
          currTab === 'servants_attendance' ||
          currTab === 'supervisors_directory' ||
          currTab === 'supervisors_attendance'
            ? 'children_attendance'
            : currTab
        );
      }
      return;
    }

    const fallbackStage = (u.assignedStage && u.assignedStage !== 'عامة' && u.assignedStage !== 'في انتظار التعيين')
      ? u.assignedStage
      : 'عامة';
    const stgItem = resolveStageItem(fallbackStage, stages);
    setActiveStageId(stgItem?.id || fallbackStage);
    setActiveRoleInStage(u.role);
    setSelectedStageScopeState(fallbackStage === 'عامة' ? 'all' : fallbackStage);
    setFilters(prev => ({ ...prev, stageFilter: fallbackStage === 'عامة' ? 'all' : fallbackStage }));
  };

  const setActiveStageContext = (stageIdOrName: string) => {
    if (!currentUserRef.current) return;
    applyStageContextForUser(currentUserRef.current, stageIdOrName);
  };

  // Check Root Admin bootstrap status cleanly when unauthenticated
  useEffect(() => {
    if (currentUser) {
      setIsRootInitialized(true);
      return;
    }
    let mounted = true;
    checkRootBootstrapStatusFromFirestore()
      .then((initialized) => {
        if (mounted) setIsRootInitialized(initialized);
      })
      .catch(() => {
        if (mounted) setIsRootInitialized(true);
      });
    return () => {
      mounted = false;
    };
  }, [currentUser]);

  // ============================================================================
  // Real-Time Firebase Firestore Subscriptions (Gated on Verified /users/{uid} Doc)
  // ============================================================================
  useEffect(() => {
    if (
      !firebaseAuthState.uid ||
      firebaseAuthState.isAnonymous ||
      !approvedCurrentUserLoaded ||
      !currentUser
    ) {
      return;
    }

    // 1. Real-time listener for Stages (Unconditional — zero auto-seeding of dummy stages)
    const unsubStages = listenToStages((firestoreStages) => {
      const mapped: StageItem[] = firestoreStages.map(st => ({
        id: st.id,
        name: st.name,
        description: st.description || '',
        supervisorName: st.supervisorName || '',
        supervisorPhone: st.supervisorPhone || '',
        assistantSupervisors: Array.isArray(st.assistantSupervisors) ? st.assistantSupervisors : [],
        captainName: st.captainName || st.supervisorName || '',
        captainPhone: st.captainPhone || st.supervisorPhone || '',
        firstMateName: st.firstMateName || '',
        firstMatePhone: st.firstMatePhone || '',
        meetingTime: st.meetingTime || '',
        isCustom: Boolean(st.isCustom)
      }));
      setStagesList(mapped);
    });

    // 2. Real-time listener for Makhdomeen (Unconditional — empty array clears deleted items!)
    const unsubMakhdomeen = listenToMakhdomeen((firestoreMakhdomeen) => {
      const mappedChildren: Child[] = firestoreMakhdomeen.map(m => {
        const age = calculateDynamicAge(m.birthDate || '2017-01-01', m.age);
        const birthMonth = m.birthDate && m.birthDate.includes('-')
          ? (parseInt(m.birthDate.split('-')[1], 10) || 1)
          : 1;

        return {
          id: m.id,
          name: m.fullName || 'بدون اسم',
          stageId: m.stageId,
          stage: m.stage || 'عامة',
          secondaryStages: Array.isArray(m.secondaryStages) ? m.secondaryStages : [],
          assignedServantId: m.assignedServantId,
          age,
          birthDate: m.birthDate || '2017-01-01',
          birthMonth,
          area: m.area || 'شبرا - مسرة',
          address: m.address || '',
          notes: m.notes || '',
          phone: m.phone || '',
          parentName: m.parentName || (m.parentPhone ? `ولي أمر (${m.fullName})` : 'ولي الأمر'),
          parentRelation: m.parentRelation || 'الأب',
          parentPhone: m.parentPhone || '',
          parentJob: m.parentJob || '',
          parent2Name: m.parent2Name || '',
          parent2Relation: m.parent2Relation || (m.parent2Name ? 'الأم' : ''),
          parent2Phone: m.parent2Phone || '',
          parent2Job: m.parent2Job || '',
          gender: m.gender === 'girl' ? 'girl' : 'boy',
          createdAt: m.createdAt || new Date().toISOString().split('T')[0]
        };
      });
      setChildren(mappedChildren);
    });

    // 3. Real-time listener for Users -> Deduplicate -> Hydrate Users, Servants & Supervisors
    const unsubUsers = listenToUsers((firestoreUsers) => {
      if (firestoreUsers.length === 0) {
        setUsers([]);
        setServants([]);
        setSupervisors([]);
        setApprovedCurrentUserLoaded(false);
        setCurrentUser(null);
        sessionStorage.removeItem('church_app_current_user');
        return;
      }
      setUsers(prev => {
        // Strict deduplication by canonical uid (preserving distinct case-sensitive accounts)
        const uniqueFirestoreUsersMap = new Map<string, typeof firestoreUsers[number]>();
        firestoreUsers.forEach(fu => {
          const key = fu.uid || fu.id || (fu.username || '').trim();
          if (!key) return;

          const existing = uniqueFirestoreUsersMap.get(key);
          if (!existing) {
            uniqueFirestoreUsersMap.set(key, fu);
          } else {
            const existingStage = (existing.assignedStage || existing.assignedClass || '').trim();
            const newStage = (fu.assignedStage || fu.assignedClass || '').trim();
            const preferNew =
              (existingStage === '' || existingStage === 'في انتظار التعيين') &&
              (newStage !== '' && newStage !== 'في انتظار التعيين');

            const existingTime = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
            const newTime = fu.updatedAt ? new Date(fu.updatedAt).getTime() : 0;
            // Also prefer canonical doc whose ID equals fu.uid
            const existingCanonical = existing.id === existing.uid;
            const newCanonical = fu.id === fu.uid;

            if (preferNew || newTime > existingTime || (!existingCanonical && newCanonical)) {
              uniqueFirestoreUsersMap.set(key, fu);
            }
          }
        });

        const dedupedFirestoreUsers = Array.from(uniqueFirestoreUsersMap.values());

        const localPasswords = new Map<string, string>();
        prev.forEach(u => {
          if (u.password) {
            localPasswords.set(u.id, u.password);
            if (u.username) localPasswords.set(u.username, u.password);
          }
        });

        const activeStages = stagesListRef.current;

        const mappedUsers: AppUser[] = dedupedFirestoreUsers.map(fu => {
          const docId = fu.uid || fu.id;
          const rawUsername = (fu.username || docId || '').trim();
          const pass = fu.passwordHash || localPasswords.get(docId) || localPasswords.get(rawUsername) || '';
          const prevUser = prev.find(
            p => p.id === docId || p.username === rawUsername
          );

          const firestoreStage = (fu.assignedStage || fu.assignedClass || '').trim();
          let effectiveStage = firestoreStage || prevUser?.assignedStage || 'في انتظار التعيين';
          if (
            (!firestoreStage || firestoreStage === 'في انتظار التعيين') &&
            prevUser?.assignedStage &&
            prevUser.assignedStage !== 'في انتظار التعيين'
          ) {
            effectiveStage = prevUser.assignedStage;
          }

          const rawRole = (fu.role as Role) || prevUser?.role || 'khadem';
          const normalizedAssignments = buildAssignmentsForUser(
            {
              role: rawRole,
              assignedStage: effectiveStage,
              assignedStages: fu.assignedStages || prevUser?.assignedStages,
              assignments: (fu.assignments as ClassAssignment[] | undefined) || prevUser?.assignments
            },
            activeStages
          );

          const derivedStageNames = normalizedAssignments.map(a => a.stageName);

          return {
            id: docId,
            uid: docId,
            username: rawUsername,
            authEmail: fu.authEmail || prevUser?.authEmail || '',
            name: fu.fullName || prevUser?.name || rawUsername,
            phone: fu.phone || prevUser?.phone || '',
            avatarUrl: fu.avatarUrl || prevUser?.avatarUrl || '',
            role: rawRole,
            assignedStage: (normalizedAssignments[0]?.stageName || effectiveStage) as Stage,
            assignedStages: derivedStageNames.slice(1),
            assignments: normalizedAssignments,
            isProtectedRoot: Boolean(fu.isProtectedRoot || rawRole === 'amin_khedma_am'),
            isAdminAssistant: Boolean(fu.isAdminAssistant),
            canAssignMakhdomeen: fu.canAssignMakhdomeen !== undefined ? Boolean(fu.canAssignMakhdomeen) : true,
            mustChangePassword: Boolean(fu.mustChangePassword || fu.isFirstLogin),
            isTempPassword: Boolean(fu.isFirstLogin || fu.mustChangePassword),
            password: pass,
            birthDate: fu.birthDate || prevUser?.birthDate,
            job: fu.job || prevUser?.job,
            area: fu.area || prevUser?.area,
            notes: fu.notes || prevUser?.notes,
            createdAt: fu.createdAt || prevUser?.createdAt || new Date().toISOString().split('T')[0],
            updatedAt: fu.updatedAt
          };
        });

        // Deduplicate by exact case-sensitive username (===)
        const byUsername = new Map<string, AppUser>();
        for (const u of mappedUsers) {
          const key = u.username;
          const existing = byUsername.get(key);
          if (!existing) {
            byUsername.set(key, u);
          } else {
            const preferNewStage = existing.assignedStage === 'في انتظار التعيين' && u.assignedStage !== 'في انتظار التعيين';
            byUsername.set(key, {
              ...existing,
              ...u,
              assignedStage: preferNewStage ? u.assignedStage : (existing.assignedStage !== 'في انتظار التعيين' ? existing.assignedStage : u.assignedStage),
              assignments: (u.assignments && u.assignments.length >= (existing.assignments?.length || 0)) ? u.assignments : existing.assignments,
              password: existing.password || u.password
            });
          }
        }
        const result: AppUser[] = Array.from(byUsername.values());

        // Real-time synchronization of currentUser
        setCurrentUser(curr => {
          if (!curr) return null;
          const updated = result.find(
            u => u.id === curr.id || u.username === curr.username
          );
          if (updated) {
            const merged: AppUser = {
              ...curr,
              ...updated,
              password: updated.password || curr.password
            };
            sessionStorage.setItem('church_app_current_user', JSON.stringify(merged));
            return merged;
          }
          return curr;
        });

        // Derive Servants Directory (strictly excludes amin_khedma_am)
        const directoryEligibleUsers = result.filter(
          u =>
            u.role !== 'amin_khedma_am' &&
            !u.isProtectedRoot &&
            (u.role === 'khadem' || u.role === 'amin_fasl' || u.role === 'mosaed_amin' || u.role === 'general_dock')
        );

        const nextServants: Servant[] = [];
        const seenIds = new Set<string>();

        directoryEligibleUsers.forEach(u => {
          if (seenIds.has(u.id)) return;
          seenIds.add(u.id);

          const assignments = u.assignments || [];
          // Determine highest rank across user's assignments
          let highestRank: Role = u.role;
          if (assignments.length > 0) {
            const sorted = [...assignments].sort((a, b) => (RANK_WEIGHT[b.role] || 0) - (RANK_WEIGHT[a.role] || 0));
            highestRank = sorted[0].role;
          }

          const stage = assignments[0]?.stageName || u.assignedStage || 'في انتظار التعيين';
          const isPending = stage === 'في انتظار التعيين';
          const isDock = u.role === 'general_dock' || stage === 'عامة';

          let roleType: Servant['roleType'] = 'crew';
          let roleTitle = `خادم مرحلة (${stage})`;

          if (highestRank === 'amin_fasl') {
            roleType = 'captain';
            roleTitle = `أمين مرحلة (${stage})`;
          } else if (highestRank === 'mosaed_amin') {
            roleType = 'first_mate';
            roleTitle = `مساعد أمين مرحلة (${stage})`;
          } else if (isPending) {
            roleType = 'general_dock';
            roleTitle = 'في انتظار التعيين';
          } else if (isDock) {
            roleType = 'general_dock';
            roleTitle = 'خادم عام';
          }

          nextServants.push({
            id: u.id,
            name: u.name || u.username,
            phone: u.phone || '',
            assignedStage: stage,
            assignedStages: assignments.slice(1).map(a => a.stageName),
            assignments,
            area: u.area || 'المعراج السفلي',
            job: u.job || 'خادم',
            birthDate: u.birthDate || '1995-01-01',
            birthMonth: u.birthDate ? parseInt(u.birthDate.split('-')[1], 10) || 1 : 1,
            roleType,
            roleTitle,
            notes: u.notes || '',
            is_directory_visible: true,
            createdAt: u.createdAt || new Date().toISOString().split('T')[0]
          });
        });

        setServants(nextServants);

        // Derive Supervisors Directory (amin_fasl + mosaed_amin, strictly excludes amin_khedma_am)
        const nextSupervisors: Supervisor[] = [];
        const seenSupIds = new Set<string>();

        directoryEligibleUsers.forEach(u => {
          const assignments = u.assignments || [];
          const leaderAssignments = assignments.filter(a => a.role === 'amin_fasl' || a.role === 'mosaed_amin');
          const primaryLeaderRole: Role | null =
            leaderAssignments.length > 0
              ? leaderAssignments[0].role
              : (u.role === 'amin_fasl' || u.role === 'mosaed_amin' ? u.role : null);

          if (!primaryLeaderRole) return;
          if (seenSupIds.has(u.id)) return;
          seenSupIds.add(u.id);

          const isAssistant = primaryLeaderRole === 'mosaed_amin';
          const stage = leaderAssignments[0]?.stageName || u.assignedStage || 'عامة';
          nextSupervisors.push({
            id: u.id,
            name: u.name || u.username,
            phone: u.phone || '',
            supervisedStage: stage,
            assignedStage: stage,
            isAssistant,
            roleType: isAssistant ? 'assistant_supervisor' : 'supervisor',
            title: isAssistant ? `مساعد أمين مرحلة (${stage})` : `أمين مرحلة (${stage})`,
            area: u.area || 'المعراج السفلي',
            job: u.job || 'خادم',
            birthDate: u.birthDate || '1995-01-01',
            birthMonth: u.birthDate ? parseInt(u.birthDate.split('-')[1], 10) || 1 : 1,
            notes: u.notes || '',
            is_directory_visible: true,
            createdAt: u.createdAt || new Date().toISOString().split('T')[0]
          });
        });

        setSupervisors(nextSupervisors);
        return result;
      });
    });

    // 4. Real-time listener for Library (Unconditional)
    const unsubLibrary = listenToLibrary((firestoreBooks) => {
      const mappedBooks: Book[] = firestoreBooks.map(b => {
        const stagesArr =
          Array.isArray(b.targetStages) && b.targetStages.length > 0
            ? b.targetStages
            : [b.targetGrade || 'عامة'];
        return {
          id: b.id,
          title: b.title,
          category: (b.category as Book['category']) || 'khedma',
          visibility: b.visibility || (stagesArr.includes('عامة') ? 'all' : 'specific_stages'),
          targetStage: b.targetGrade || stagesArr[0] || 'عامة',
          targetStages: stagesArr,
          pdfUrl: b.pdfUrl || b.fileUrl || '',
          fileUrl: b.fileUrl || b.pdfUrl || '',
          pdfFileName: b.pdfFileName,
          pdfFileSize: b.pdfFileSize,
          coverImage: b.coverImage,
          coverBg: b.coverBg,
          author: b.author || '',
          year: b.year || '',
          description: b.description || b.title,
          contentSummary: b.contentSummary || '',
          pageCount: b.pageCount || 100
        };
      });
      setBooks(mappedBooks);
    });

    // 5. Real-time listener for Announcements (Unconditional)
    const unsubAnnouncements = listenToAnnouncements((firestoreAnnouncements) => {
      const mappedNotifs: ChurchEventNotification[] = firestoreAnnouncements.map(a => ({
        id: a.id,
        title: a.title,
        description: a.body,
        targetStage: (a.targetStages && a.targetStages[0]) || a.targetRole || 'عامة',
        targetScope: a.targetScope || (a.targetRole === 'عامة' || a.targetRole === 'all' ? 'all' : 'specific_stages'),
        targetStages: Array.isArray(a.targetStages) ? a.targetStages : (a.targetRole ? [a.targetRole] : ['عامة']),
        type: a.type || 'alert',
        date: a.date || (a.createdAt ? a.createdAt.split('T')[0] : new Date().toISOString().split('T')[0]),
        time: a.time || '',
        createdBy: a.createdBy || 'أمين الخدمة',
        createdAt: a.createdAt
      }));
      setNotifications(mappedNotifs);
    });

    const unsubSeasonalEvents = listenToSeasonalEvents((firestoreEvents) => {
      const mapped: SeasonalEvent[] = firestoreEvents.map(ev => ({
        id: ev.id,
        name: ev.name,
        startDate: ev.startDate,
        endDate: ev.endDate,
        stageScope: ev.stageScope || 'all',
        isActive: ev.isActive !== undefined ? ev.isActive : true,
        createdAt: ev.createdAt || new Date().toISOString().split('T')[0]
      }));
      setSeasonalEvents(mapped);
    });

    // 6. Real-time listener for Attendance (Unconditional)
    const unsubAttendance = listenToAttendance((rawAttendance) => {
      const groups: Record<string, AttendanceRecord> = {};
      rawAttendance.forEach(item => {
        const key = `${item.personType}_${item.eventType}_${item.date}`;
        if (!groups[key]) {
          groups[key] = {
            id: `att_${key}`,
            date: item.date,
            periodType: item.periodType || 'weekly',
            targetType: (item.personType as AttendanceRecord['targetType']) || 'child',
            eventType: (item.eventType as AttendanceRecord['eventType']) || 'sunday_school',
            recordedByUid: item.recordedByUid,
            records: {}
          };
        }
        groups[key].records[item.personId] = {
          status: item.status as AttendanceStatus,
          note: item.note,
          recordedByUid: item.recordedByUid
        };
      });
      setAttendance(Object.values(groups));
    });

    return () => {
      unsubStages();
      unsubMakhdomeen();
      unsubUsers();
      unsubLibrary();
      unsubAnnouncements();
      unsubSeasonalEvents();
      unsubAttendance();
    };
  }, [firebaseAuthState.uid, firebaseAuthState.isAnonymous, approvedCurrentUserLoaded, currentUser?.id]);

  // 7. Pending Registrations Listener (strictly for verified amin_khedma_am or admin assistant)
  useEffect(() => {
    const canReviewPending =
      Boolean(firebaseAuthState.uid) &&
      !firebaseAuthState.isAnonymous &&
      approvedCurrentUserLoaded &&
      (currentUser?.role === 'amin_khedma_am' || Boolean(currentUser?.isAdminAssistant));

    if (!canReviewPending) {
      setPendingRegistrations([]);
      return;
    }

    const unsubPending = listenToPendingRegistrations((regs) => {
      setPendingRegistrations(
        regs.map(r => ({
          id: r.id,
          fullName: r.fullName,
          username: r.username,
          phone: r.phone,
          tempPassword: r.tempPassword,
          birthDate: r.birthDate,
          notes: r.notes,
          status: r.status,
          createdAt: r.createdAt
        }))
      );
    });

    return () => unsubPending();
  }, [firebaseAuthState.uid, firebaseAuthState.isAnonymous, approvedCurrentUserLoaded, currentUser?.role, currentUser?.isAdminAssistant]);

  // ============================================================================
  // Auth Methods (Seed-Once Protected Root + Alias-Aware Sign-In)
  // ============================================================================
  const initializeRootAdmin = async (data: {
    name: string;
    username: string;
    phone: string;
    password: string;
  }): Promise<{ success: boolean; error?: string }> => {
    const cleanName = data.name.trim();
    const cleanUsername = data.username.trim();
    const cleanPhone = data.phone.trim();
    const cleanPass = data.password.trim();

    if (!cleanName) {
      return { success: false, error: 'يرجى إدخال اسم أمين الخدمة العام بالكامل.' };
    }
    const usernameCheck = validateUsername(cleanUsername, []);
    if (!usernameCheck.valid) {
      return { success: false, error: usernameCheck.error || 'اسم المستخدم غير صالح.' };
    }
    if (!cleanPhone || cleanPhone.length < 6) {
      return { success: false, error: 'يرجى إدخال رقم هاتف صحيح (6 أرقام على الأقل).' };
    }
    if (!cleanPass || cleanPass.length < 4) {
      return { success: false, error: 'كلمة السر يجب ألا تقل عن 4 خانات.' };
    }

    let createdAuthUser = null as Awaited<ReturnType<typeof createRootFirebaseAuthUser>>['user'] | null;
    let didCreateAuthUser = false;

    inFlightAuthTransitionRef.current = true;
    setApprovedCurrentUserLoaded(false);

    try {
      const authEmail = generateUniqueInternalAuthEmail();
      const authRes = await createRootFirebaseAuthUser(cleanUsername, cleanPass, authEmail);
      createdAuthUser = authRes.user;
      didCreateAuthUser = authRes.createdNew;
      const canonicalUid = authRes.user.uid;
      const encryptedHash = await hashPassword(cleanPass);
      const createdAt = new Date().toISOString();

      // 1. Wait for /users/{uid} (plus root_status & login_aliases) to succeed BEFORE starting any onSnapshot listeners
      const seedResult = await seedRootAdminOnceInFirestore(
        {
          uid: canonicalUid,
          username: cleanUsername,
          authEmail: authRes.authEmail,
          passwordHash: encryptedHash,
          fullName: cleanName,
          phone: cleanPhone,
          role: 'amin_khedma_am',
          assignedClass: 'عامة',
          assignedStage: 'عامة',
          assignedStages: [],
          assignments: [],
          isProtectedRoot: true,
          isAdminAssistant: false,
          canAssignMakhdomeen: true,
          isFirstLogin: false,
          mustChangePassword: false,
          createdAt
        },
        authRes.authEmail
      );

      if (!seedResult.seeded) {
        if (didCreateAuthUser && createdAuthUser) {
          await createdAuthUser.delete().catch(() => undefined);
        }
        await logoutFirebaseAuth().catch(() => undefined);
        setApprovedCurrentUserLoaded(false);
        setIsRootInitialized(true);
        return {
          success: false,
          error: 'تمت تهيئة حساب أمين الخدمة العام مسبقاً في قاعدة البيانات. يرجى تسجيل الدخول بالبيانات المعتمدة.'
        };
      }

      const rootUser: AppUser = {
        id: canonicalUid,
        uid: canonicalUid,
        username: cleanUsername,
        authEmail: authRes.authEmail,
        name: cleanName,
        phone: cleanPhone,
        role: 'amin_khedma_am',
        assignedStage: 'عامة',
        assignedStages: [],
        assignments: [],
        isProtectedRoot: true,
        isAdminAssistant: false,
        canAssignMakhdomeen: true,
        isTempPassword: false,
        mustChangePassword: false,
        password: encryptedHash,
        createdAt: createdAt.split('T')[0]
      };

      // 2. Activate currentUser and unlock onSnapshot subscriptions AFTER /users/{uid} exists
      setUsers([rootUser]);
      setCurrentUser(rootUser);
      setRoleState('amin_khedma_am');
      setIsRootInitialized(true);
      applyStageContextForUser(rootUser);
      setApprovedCurrentUserLoaded(true);
      return { success: true };
    } catch (err: any) {
      setApprovedCurrentUserLoaded(false);
      if (didCreateAuthUser && createdAuthUser) {
        await createdAuthUser.delete().catch(() => undefined);
      }
      await logoutFirebaseAuth().catch(() => undefined);
      const code = err?.code || '';
      if (
        code === 'auth/invalid-credential' ||
        code === 'auth/wrong-password' ||
        code === 'auth/invalid-login-credentials'
      ) {
        return {
          success: false,
          error: 'اسم المستخدم مسجل مسبقاً في Firebase Authentication بكلمة مرور مختلفة. يرجى حذفه من Firebase Authentication أو استخدام نفس كلمة المرور.'
        };
      }
      return {
        success: false,
        error: err?.message || 'تعذر تهيئة حساب أمين الخدمة العام.'
      };
    } finally {
      inFlightAuthTransitionRef.current = false;
    }
  };

  const login = async (
    usernameOrPhone: string,
    pass: string
  ): Promise<{ success: boolean; error?: string; isTemp?: boolean }> => {
    const cleanInput = usernameOrPhone.trim();
    const cleanPass = pass.trim();

    if (!cleanInput || !cleanPass) {
      return { success: false, error: 'يرجى إدخال اسم المستخدم وكلمة السر' };
    }

    inFlightAuthTransitionRef.current = true;
    setApprovedCurrentUserLoaded(false);

    try {
      // 1. Resolve canonical internal authEmail strictly using case-sensitive username (===) or exact phone
      const cachedUser = usersRef.current.find(
        u =>
          u.username === cleanInput ||
          (u.phone && u.phone.trim() === cleanInput) ||
          u.id === cleanInput
      );
      let resolvedAuthEmail = cachedUser?.authEmail || undefined;
      if (!resolvedAuthEmail) {
        resolvedAuthEmail = (await resolveAuthEmailViaAlias(cleanInput)) || undefined;
      }

      if (!resolvedAuthEmail) {
        return { success: false, error: 'اسم المستخدم (مطابق لحالة الأحرف) أو كلمة السر غير صحيحة' };
      }

      const authIdentifier = cachedUser?.username || cleanInput;

      // 2. Establish non-anonymous Firebase Auth session via the resolved internal authEmail
      let authUid: string | null = null;
      let signedInEmail: string = resolvedAuthEmail;
      try {
        const fbUser = await loginWithFirebaseAuth(authIdentifier, cleanPass, {
          resolvedAuthEmail
        });
        authUid = fbUser.uid;
        signedInEmail = fbUser.email || resolvedAuthEmail;
      } catch (authErr: any) {
        if (!cachedUser) {
          return { success: false, error: authErr.message || 'اسم المستخدم أو كلمة السر غير صحيحة' };
        }
      }

      // 3. Lookup canonical user record in Firestore
      let found: AppUser | null = cachedUser ? { ...cachedUser } : null;
      try {
        let firestoreUser = authUid ? await getUserFromFirestore(authUid) : null;
        if (!firestoreUser) {
          firestoreUser = await getUserFromFirestore(cleanInput);
        }

        if (firestoreUser) {
          // Enforce strict case-sensitive username check (or exact phone/uid login)
          const inputDigits = cleanInput.replace(/\D/g, '');
          const userPhoneDigits = (firestoreUser.phone || '').replace(/\D/g, '');
          const isPhoneLogin = inputDigits.length >= 6 && userPhoneDigits === inputDigits && !/[a-zA-Z]/.test(cleanInput);
          const isExactUsernameMatch = firestoreUser.username === cleanInput;
          const isExactUidMatch = firestoreUser.uid === cleanInput;

          if (!isPhoneLogin && !isExactUsernameMatch && !isExactUidMatch) {
            if (authUid) {
              await logoutFirebaseAuth().catch(() => undefined);
            }
            return { success: false, error: 'اسم المستخدم غير مطابق لحالة الأحرف (الكبيرة/الصغيرة) المسجلة.' };
          }

          const docId = firestoreUser.uid;
          const rawRole = (firestoreUser.role as Role) || 'khadem';
          const effectiveStage = (firestoreUser.assignedStage || firestoreUser.assignedClass || 'عامة') as Stage;
          const assignments = buildAssignmentsForUser(
            {
              role: rawRole,
              assignedStage: effectiveStage,
              assignedStages: firestoreUser.assignedStages,
              assignments: firestoreUser.assignments as ClassAssignment[] | undefined
            },
            stagesListRef.current
          );

          found = {
            id: docId,
            uid: docId,
            username: firestoreUser.username || authIdentifier,
            authEmail: firestoreUser.authEmail || signedInEmail,
            name: firestoreUser.fullName || found?.name || authIdentifier,
            phone: firestoreUser.phone || found?.phone || '',
            avatarUrl: firestoreUser.avatarUrl || found?.avatarUrl || '',
            role: rawRole,
            assignedStage: (assignments[0]?.stageName || effectiveStage) as Stage,
            assignedStages: assignments.slice(1).map(a => a.stageName),
            assignments,
            isProtectedRoot: Boolean(firestoreUser.isProtectedRoot || rawRole === 'amin_khedma_am'),
            isAdminAssistant: Boolean(firestoreUser.isAdminAssistant),
            canAssignMakhdomeen: firestoreUser.canAssignMakhdomeen !== undefined ? Boolean(firestoreUser.canAssignMakhdomeen) : true,
            mustChangePassword: Boolean(firestoreUser.mustChangePassword || firestoreUser.isFirstLogin),
            isTempPassword: Boolean(firestoreUser.isFirstLogin || firestoreUser.mustChangePassword),
            password: firestoreUser.passwordHash || found?.password || '',
            birthDate: firestoreUser.birthDate || found?.birthDate,
            job: firestoreUser.job || found?.job,
            area: firestoreUser.area || found?.area,
            notes: firestoreUser.notes || found?.notes,
            createdAt: firestoreUser.createdAt || found?.createdAt || new Date().toISOString().split('T')[0]
          };
        }
      } catch (fsErr) {
        console.warn('Firestore user lookup error:', fsErr);
      }

      if (!found) {
        if (authUid) {
          await logoutFirebaseAuth().catch(() => undefined);
        }
        return { success: false, error: 'اسم المستخدم أو رقم الهاتف غير مسجل أو بانتظار موافقة أمين الخدمة العام' };
      }

      // 4. Verify stored SHA-256 password hash strictly
      const storedPass = found.passwordHash || found.password;
      const isPasswordMatch = await verifyPassword(cleanPass, storedPass);
      if (!isPasswordMatch) {
        if (authUid) {
          await logoutFirebaseAuth().catch(() => undefined);
        }
        return { success: false, error: 'اسم المستخدم أو كلمة السر غير صحيحة' };
      }

      // Upgrade plaintext legacy hash on login if ever encountered
      if (storedPass && !isPasswordEncrypted(storedPass)) {
        const encrypted = await hashPassword(cleanPass);
        found.password = encrypted;
        updateUserInFirestore(found.id, { passwordHash: encrypted }).catch(() => undefined);
      }

      // Ensure login aliases and bootstrap lock stay synchronized for future reloads
      if (authUid && found.authEmail) {
        syncUserLoginAliases({
          authEmail: found.authEmail,
          username: found.username,
          phone: found.phone
        }).catch(() => undefined);
        if (found.role === 'amin_khedma_am') {
          ensureRootBootstrapLockInFirestore(found.uid || found.id).catch(() => undefined);
        }
      }

      // 5. Update state, activate Tree Context Switcher, and unlock Firestore subscriptions
      setUsers(prev => {
        const exists = prev.some(u => u.id === found!.id || u.username === found!.username);
        if (exists) {
          return prev.map(u => (u.id === found!.id || u.username === found!.username) ? found! : u);
        }
        return [...prev, found!];
      });

      const isTemp = Boolean(found.isTempPassword || found.mustChangePassword);
      setCurrentUser(found);
      setRoleState(found.role);
      setIsRootInitialized(true);
      applyStageContextForUser(found);
      setApprovedCurrentUserLoaded(true);

      return { success: true, isTemp };
    } finally {
      inFlightAuthTransitionRef.current = false;
    }
  };

  /**
   * Isolated Pending Servant Registration:
   * Uses anonymous Auth strictly to create a /pending_registrations document, then immediately signs out.
   * Never creates a /users account or logs in the unapproved applicant automatically.
   */
  const registerServant = async (data: {
    name: string;
    username: string;
    password?: string;
    phone: string;
    area?: string;
    job?: string;
    birthDate: string;
    assignedStage: string;
    notes?: string;
  }): Promise<{ success: boolean; error?: string; pendingApproval?: boolean }> => {
    const cleanName = data.name.trim();
    if (!cleanName) {
      return { success: false, error: 'الاسم الكامل مطلوب' };
    }

    const usernameValidation = validateUsername(data.username, usersRef.current);
    if (!usernameValidation.valid) {
      return { success: false, error: usernameValidation.error || 'اسم المستخدم غير مقبول' };
    }
    const cleanUsername = data.username.trim();
    const cleanPhone = data.phone.trim();
    if (!cleanPhone || cleanPhone.length < 6) {
      return { success: false, error: 'رقم الهاتف غير صالح (6 أرقام على الأقل)' };
    }

    try {
      await signInAnonymouslyForPendingRegistration();
      const exactExists = await doesExactUsernameAliasExist(cleanUsername);
      if (exactExists) {
        await logoutFirebaseAuth().catch(() => undefined);
        return {
          success: false,
          error: `اسم المستخدم "${cleanUsername}" محجوز ومسجل بالفعل لخادم آخر. يرجى اختيار اسم مستخدم مميز.`
        };
      }

      const cleanPassword = (data.password || '').trim();
      if (!cleanPassword || cleanPassword.length < 4) {
        await logoutFirebaseAuth().catch(() => undefined);
        return {
          success: false,
          error: 'كلمة السر مطلوبة ويجب ألا تقل عن 4 خانات'
        };
      }

      const notesCombined = [
        data.notes?.trim(),
        data.job ? `العمل: ${data.job.trim()}` : '',
        data.area ? `المنطقة: ${data.area.trim()}` : ''
      ]
        .filter(Boolean)
        .join(' | ');

      await submitPendingRegistrationToFirestore({
        fullName: cleanName,
        username: cleanUsername,
        phone: cleanPhone,
        tempPassword: cleanPassword.slice(0, 100),
        birthDate: data.birthDate || '1995-01-01',
        ...(notesCombined ? { notes: notesCombined.slice(0, 500) } : {}),
        status: 'pending',
        createdAt: new Date().toISOString()
      });

      await logoutFirebaseAuth();
      return { success: true, pendingApproval: true };
    } catch (err: any) {
      await logoutFirebaseAuth().catch(() => undefined);
      return {
        success: false,
        error: err?.message || 'تعذر إرسال طلب التسجيل. يرجى المحاولة مرة أخرى.'
      };
    }
  };

  const approvePendingRegistration = async (
    regId: string,
    options: {
      role: Role;
      assignedStage: Stage;
      assignments?: ClassAssignment[];
      tempPassword?: string;
    }
  ): Promise<{ success: boolean; error?: string }> => {
    const reg = pendingRegistrations.find(r => r.id === regId);
    if (!reg) {
      return { success: false, error: 'طلب التسجيل غير موجود.' };
    }

    const cleanUsername = reg.username.trim();
    const usernameCheck = validateUsername(cleanUsername, usersRef.current);
    if (!usernameCheck.valid) {
      return { success: false, error: usernameCheck.error || 'اسم المستخدم غير صالح أو مستخدم بالفعل.' };
    }

    const stages = stagesListRef.current;
    const candidateAssignments =
      options.assignments && options.assignments.length > 0
        ? buildAssignmentsForUser({ role: options.role, assignments: options.assignments }, stages)
        : buildAssignmentsForUser({ role: options.role, assignedStage: options.assignedStage }, stages);

    const invariantError = validateAssignmentsInvariants(null, candidateAssignments, usersRef.current, options.role);
    if (invariantError) {
      return { success: false, error: invariantError };
    }

    const selfRegisteredPass = (reg.tempPassword || '').trim();
    const hasSelfChosenPass = selfRegisteredPass.length > 0;
    const chosenPassword = hasSelfChosenPass
      ? selfRegisteredPass
      : options.tempPassword?.trim() || generateRandomTempPassword();

    const authEmail = generateUniqueInternalAuthEmail();
    const encryptedHash = await hashPassword(chosenPassword);
    const provisionedUid = await provisionFirebaseAuthUser(authEmail, chosenPassword);
    if (!provisionedUid) {
      return {
        success: false,
        error: 'تعذر إنشاء حساب المصادقة في Firebase Authentication لهذا الخادم.'
      };
    }

    const primaryStage = candidateAssignments[0]?.stageName || options.assignedStage || 'عامة';

    await addUserToFirestore({
      uid: provisionedUid,
      username: cleanUsername,
      authEmail,
      passwordHash: encryptedHash,
      fullName: reg.fullName,
      phone: reg.phone,
      role: options.role,
      assignedClass: primaryStage,
      assignedStage: primaryStage,
      assignedStages: candidateAssignments.slice(1).map(a => a.stageName),
      assignments: candidateAssignments,
      isFirstLogin: !hasSelfChosenPass,
      mustChangePassword: !hasSelfChosenPass,
      isTempPassword: !hasSelfChosenPass,
      isProtectedRoot: false,
      isAdminAssistant: false,
      canAssignMakhdomeen: true,
      birthDate: reg.birthDate || '1995-01-01',
      notes: reg.notes || '',
      createdAt: new Date().toISOString()
    });

    await syncUserLoginAliases({
      authEmail,
      username: cleanUsername,
      phone: reg.phone
    });

    // Delete the pending registration doc immediately after approval so any stored password is purged
    await deletePendingRegistrationFromFirestore(regId);
    setPendingRegistrations(prev => prev.filter(r => r.id !== regId));
    return { success: true };
  };

  const rejectPendingRegistration = async (regId: string): Promise<void> => {
    await updatePendingRegistrationStatusInFirestore(regId, 'rejected');
    await deletePendingRegistrationFromFirestore(regId).catch(() => undefined);
  };

  const logout = async () => {
    setApprovedCurrentUserLoaded(false);
    try {
      await logoutFirebaseAuth();
    } catch (e) {
      console.warn(e);
    }
    setCurrentUser(null);
    setUsers([]);
    setChildren([]);
    setServants([]);
    setSupervisors([]);
    setBooks([]);
    setAttendance([]);
    setNotifications([]);
    setStagesList([]);
    setSeasonalEvents([]);
    setPendingRegistrations([]);
    setActiveStageId('all');
    setActiveRoleInStage('khadem');
    sessionStorage.removeItem('church_app_current_user');
    purgeDomainLocalStorage();
  };

  const changePassword = async (userId: string, newPass: string) => {
    const cleanPass = newPass.trim();
    const encryptedPassword = await hashPassword(cleanPass);

    setUsers(prev =>
      prev.map(u => {
        if (u.id === userId || (u.username && u.username === userId)) {
          return { ...u, password: encryptedPassword, isTempPassword: false, mustChangePassword: false };
        }
        return u;
      })
    );

    if (
      currentUserRef.current &&
      (currentUserRef.current.id === userId ||
        currentUserRef.current.username === userId)
    ) {
      const updatedCurr: AppUser = {
        ...currentUserRef.current,
        password: encryptedPassword,
        isTempPassword: false,
        mustChangePassword: false
      };
      setCurrentUser(updatedCurr);
      sessionStorage.setItem('church_app_current_user', JSON.stringify(updatedCurr));
    }

    try {
      await updateFirebaseUserPassword(formatSafeFirebasePass(cleanPass));
    } catch (e) {
      console.warn('Firebase Auth update password notice:', e);
    }

    try {
      await updateUserInFirestore(userId, {
        uid: userId,
        isFirstLogin: false,
        mustChangePassword: false,
        passwordHash: encryptedPassword
      });
    } catch (e) {
      console.warn('Firestore update password notice:', e);
    }
  };

  const createUser = async (
    userData: Omit<AppUser, 'id' | 'createdAt'>
  ): Promise<{ success: boolean; error?: string }> => {
    const usernameValidation = validateUsername(userData.username, usersRef.current);
    if (!usernameValidation.valid) {
      return { success: false, error: usernameValidation.error || 'اسم المستخدم غير مقبول' };
    }

    const stages = stagesListRef.current;
    const candidateAssignments = buildAssignmentsForUser(userData, stages);
    const invariantError = validateAssignmentsInvariants(
      null,
      candidateAssignments,
      usersRef.current,
      userData.role
    );
    if (invariantError) {
      return { success: false, error: invariantError };
    }

    const cleanUsername = (userData.username || '').trim();
    const rawPass =
      userData.password && userData.password.trim()
        ? userData.password.trim()
        : generateRandomTempPassword();
    if (rawPass.length < 6) {
      return { success: false, error: 'يجب ألا تقل كلمة السر المؤقتة عن 6 خانات.' };
    }

    const authEmail = generateUniqueInternalAuthEmail();
    const encryptedPassword = await hashPassword(rawPass);

    // Issue real Firebase Auth UID via isolated secondary app so admin session remains intact
    const provisionedUid = await provisionFirebaseAuthUser(authEmail, rawPass);
    if (!provisionedUid) {
      return { success: false, error: 'تعذر إنشاء الحساب في Firebase Authentication.' };
    }
    const canonicalUid = provisionedUid;
    const primaryStage = candidateAssignments[0]?.stageName || userData.assignedStage || 'عامة';

    const newUser: AppUser = {
      ...userData,
      id: canonicalUid,
      uid: canonicalUid,
      username: cleanUsername,
      authEmail,
      assignedStage: primaryStage,
      assignedStages: candidateAssignments.slice(1).map(a => a.stageName),
      assignments: candidateAssignments,
      password: encryptedPassword,
      isProtectedRoot: Boolean(userData.isProtectedRoot || userData.role === 'amin_khedma_am'),
      isAdminAssistant: Boolean(userData.isAdminAssistant),
      canAssignMakhdomeen: userData.canAssignMakhdomeen !== undefined ? Boolean(userData.canAssignMakhdomeen) : true,
      isTempPassword: true,
      mustChangePassword: true,
      createdAt: new Date().toISOString().split('T')[0]
    };

    setUsers(prev => [...prev, newUser]);

    try {
      await addUserToFirestore({
        uid: canonicalUid,
        username: cleanUsername,
        authEmail,
        passwordHash: encryptedPassword,
        fullName: userData.name,
        phone: userData.phone || '',
        role: userData.role,
        assignedClass: primaryStage,
        assignedStage: primaryStage,
        assignedStages: candidateAssignments.slice(1).map(a => a.stageName),
        assignments: candidateAssignments,
        isFirstLogin: true,
        mustChangePassword: true,
        isTempPassword: true,
        isProtectedRoot: newUser.isProtectedRoot,
        isAdminAssistant: newUser.isAdminAssistant,
        canAssignMakhdomeen: newUser.canAssignMakhdomeen,
        birthDate: userData.birthDate || '1995-01-01',
        job: userData.job || 'خادم',
        area: userData.area || 'المعراج السفلي',
        notes: userData.notes || '',
        createdAt: new Date().toISOString()
      });
      await syncUserLoginAliases({
        authEmail,
        username: cleanUsername,
        phone: userData.phone || ''
      });
    } catch (err: any) {
      return { success: false, error: err?.message || 'فشل حفظ بيانات الحساب في قاعدة البيانات.' };
    }

    return { success: true };
  };

  const updateUser = async (
    id: string,
    userData: Partial<AppUser>
  ): Promise<{ success: boolean; error?: string }> => {
    const existingUser = usersRef.current.find(
      u =>
        u.id === id ||
        u.username === id ||
        (userData.phone && u.phone && u.phone.trim() === userData.phone.trim())
    );
    const canonicalUid = existingUser?.id || id;

    if (userData.username !== undefined) {
      const cleanNewUsername = userData.username.trim();
      const usernameValidation = validateUsername(cleanNewUsername, usersRef.current, canonicalUid);
      if (!usernameValidation.valid) {
        return { success: false, error: usernameValidation.error || 'اسم المستخدم غير صالح' };
      }
    }

    const nextRole = userData.role || existingUser?.role || 'khadem';
    const stages = stagesListRef.current;

    const candidateAssignments =
      userData.assignments !== undefined || userData.assignedStage !== undefined || userData.role !== undefined
        ? buildAssignmentsForUser(
            {
              role: nextRole,
              assignedStage: userData.assignedStage !== undefined ? userData.assignedStage : existingUser?.assignedStage,
              assignedStages: userData.assignedStages !== undefined ? userData.assignedStages : existingUser?.assignedStages,
              assignments: userData.assignments !== undefined ? userData.assignments : existingUser?.assignments
            },
            stages
          )
        : existingUser?.assignments || [];

    const invariantError = validateAssignmentsInvariants(
      canonicalUid,
      candidateAssignments,
      usersRef.current,
      nextRole
    );
    if (invariantError) {
      return { success: false, error: invariantError };
    }

    const updatedPayload: Partial<AppUser> = { ...userData };
    let rawNewPassword: string | null = null;
    if (
      updatedPayload.password &&
      updatedPayload.password.trim() &&
      !/^[•*]+$/.test(updatedPayload.password.trim())
    ) {
      rawNewPassword = updatedPayload.password.trim();
      if (rawNewPassword.length < 6 && currentUserRef.current?.id !== canonicalUid) {
        return { success: false, error: 'يجب ألا تقل كلمة السر الجديدة عن 6 خانات.' };
      }
      updatedPayload.password = await hashPassword(rawNewPassword);
    } else {
      delete updatedPayload.password;
    }

    const nextUsername = (updatedPayload.username || existingUser?.username || canonicalUid).trim();
    const isSelfUpdate = Boolean(currentUserRef.current && currentUserRef.current.id === canonicalUid);
    const nextPhone = updatedPayload.phone ?? existingUser?.phone ?? '';
    const primaryStage =
      candidateAssignments[0]?.stageName ||
      updatedPayload.assignedStage ||
      existingUser?.assignedStage ||
      'عامة';

    // If admin sets a new password for another user, update Firebase Auth via secondaryAuth too
    if (rawNewPassword && !isSelfUpdate && existingUser?.role !== 'amin_khedma_am') {
      const freshAuthEmail = generateUniqueInternalAuthEmail();
      const provisionedUid = await provisionFirebaseAuthUser(freshAuthEmail, rawNewPassword);
      if (!provisionedUid) {
        return { success: false, error: 'تعذر تحديث كلمة المرور في Firebase Authentication.' };
      }

      const nextIsTemp = updatedPayload.isTempPassword !== undefined ? Boolean(updatedPayload.isTempPassword) : false;
      const migratedUser: AppUser = {
        ...(existingUser || ({} as AppUser)),
        ...updatedPayload,
        id: provisionedUid,
        uid: provisionedUid,
        username: nextUsername,
        authEmail: freshAuthEmail,
        role: nextRole,
        assignedStage: primaryStage,
        assignedStages: candidateAssignments.slice(1).map(a => a.stageName),
        assignments: candidateAssignments,
        password: updatedPayload.password,
        isTempPassword: nextIsTemp,
        mustChangePassword: nextIsTemp
      };

      await migrateUserAuthUidInFirestore({
        oldUid: canonicalUid,
        newUid: provisionedUid,
        newUser: {
          uid: provisionedUid,
          username: nextUsername,
          authEmail: freshAuthEmail,
          passwordHash: updatedPayload.password,
          fullName: updatedPayload.name ?? existingUser?.name ?? '',
          phone: nextPhone,
          role: nextRole,
          assignedClass: primaryStage,
          assignedStage: primaryStage,
          assignedStages: migratedUser.assignedStages,
          assignments: candidateAssignments,
          isFirstLogin: nextIsTemp,
          mustChangePassword: nextIsTemp,
          isTempPassword: nextIsTemp,
          isProtectedRoot: Boolean(existingUser?.isProtectedRoot),
          isAdminAssistant: updatedPayload.isAdminAssistant ?? existingUser?.isAdminAssistant ?? false,
          canAssignMakhdomeen: updatedPayload.canAssignMakhdomeen ?? existingUser?.canAssignMakhdomeen ?? true,
          birthDate: updatedPayload.birthDate ?? existingUser?.birthDate,
          job: updatedPayload.job ?? existingUser?.job,
          area: updatedPayload.area ?? existingUser?.area,
          notes: updatedPayload.notes ?? existingUser?.notes,
          avatarUrl: updatedPayload.avatarUrl ?? existingUser?.avatarUrl,
          createdAt: existingUser?.createdAt || new Date().toISOString()
        }
      });

      setUsers(prev => prev.filter(u => u.id !== canonicalUid && u.id !== provisionedUid).concat(migratedUser));
      setChildren(prev =>
        prev.map(c => (c.assignedServantId === canonicalUid ? { ...c, assignedServantId: provisionedUid } : c))
      );
      return { success: true };
    }

    const canonicalAuthEmail =
      existingUser?.authEmail ||
      generateUniqueInternalAuthEmail();

    updatedPayload.username = nextUsername;
    updatedPayload.authEmail = canonicalAuthEmail;
    updatedPayload.assignedStage = primaryStage;
    updatedPayload.assignedStages = candidateAssignments.slice(1).map(a => a.stageName);
    updatedPayload.assignments = candidateAssignments;

    setUsers(prev =>
      prev.map(u => (u.id === canonicalUid ? { ...u, ...updatedPayload } : u))
    );

    if (isSelfUpdate && currentUserRef.current) {
      const updatedCurr: AppUser = { ...currentUserRef.current, ...updatedPayload };
      setCurrentUser(updatedCurr);
      sessionStorage.setItem('church_app_current_user', JSON.stringify(updatedCurr));
      applyStageContextForUser(updatedCurr);

      if (rawNewPassword) {
        try {
          await updateFirebaseUserPassword(formatSafeFirebasePass(rawNewPassword));
        } catch (authPassErr: any) {
          console.warn('Firebase Auth password sync notice:', authPassErr);
          if (authPassErr?.code === 'auth/requires-recent-login') {
            return {
              success: false,
              error: 'لأسباب أمنية من Firebase، يرجى تسجيل الخروج وإعادة الدخول ثم تحديث كلمة المرور.'
            };
          }
        }
      }
    }

    try {
      const updateData: Record<string, any> = {
        uid: canonicalUid,
        fullName: updatedPayload.name ?? existingUser?.name ?? '',
        phone: nextPhone,
        role: nextRole,
        assignedClass: primaryStage,
        assignedStage: primaryStage,
        assignedStages: updatedPayload.assignedStages,
        assignments: candidateAssignments,
        username: nextUsername,
        authEmail: canonicalAuthEmail
      };

      if (updatedPayload.isTempPassword !== undefined) {
        updateData.isFirstLogin = updatedPayload.isTempPassword;
        updateData.mustChangePassword = updatedPayload.isTempPassword;
      }
      if (updatedPayload.password) updateData.passwordHash = updatedPayload.password;
      if (updatedPayload.isAdminAssistant !== undefined) updateData.isAdminAssistant = updatedPayload.isAdminAssistant;
      if (updatedPayload.canAssignMakhdomeen !== undefined) updateData.canAssignMakhdomeen = updatedPayload.canAssignMakhdomeen;
      if (updatedPayload.notes !== undefined) updateData.notes = updatedPayload.notes;
      if (updatedPayload.job !== undefined) updateData.job = updatedPayload.job;
      if (updatedPayload.area !== undefined) updateData.area = updatedPayload.area;
      if (updatedPayload.birthDate !== undefined) updateData.birthDate = updatedPayload.birthDate;
      if (updatedPayload.avatarUrl !== undefined) updateData.avatarUrl = updatedPayload.avatarUrl;

      await updateUserInFirestore(canonicalUid, updateData);
      await syncUserLoginAliases({
        authEmail: canonicalAuthEmail,
        username: nextUsername,
        phone: nextPhone,
        oldUsername: existingUser?.username,
        oldPhone: existingUser?.phone
      });
    } catch (err: any) {
      return { success: false, error: err?.message || 'فشل تحديث بيانات المستخدم في قاعدة البيانات.' };
    }

    return { success: true };
  };

  const deleteUser = async (id: string) => {
    const targetUser = usersRef.current.find(u => u.id === id || u.username === id);
    if (targetUser?.role === 'amin_khedma_am' || targetUser?.isProtectedRoot) {
      console.warn('Cannot delete protected amin_khedma_am account');
      return;
    }

    const targetUid = targetUser?.id || id;
    setUsers(prev => prev.filter(u => u.id !== targetUid && u.id !== id));

    if (currentUserRef.current && (currentUserRef.current.id === targetUid || currentUserRef.current.id === id)) {
      await logout();
    }

    try {
      await deleteUserFromFirestore(targetUid);
    } catch (err) {
      console.warn('Failed to delete user from Firestore:', err);
    }
  };

  const resetUserTempPassword = async (
    id: string,
    tempPass: string
  ): Promise<{ success: boolean; error?: string }> => {
    const cleanTemp = tempPass.trim();
    if (cleanTemp.length < 6) {
      return { success: false, error: 'يجب ألا تقل كلمة السر المؤقتة عن 6 خانات.' };
    }

    const targetUser = usersRef.current.find(u => u.id === id || u.username === id);
    if (!targetUser) {
      return { success: false, error: 'تعذر العثور على الحساب المطلوب.' };
    }

    const canonicalUid = targetUser.id || id;
    const encryptedPassword = await hashPassword(cleanTemp);
    const isSelfReset = Boolean(currentUserRef.current && currentUserRef.current.id === canonicalUid);

    if (isSelfReset || targetUser.role === 'amin_khedma_am') {
      try {
        await updateFirebaseUserPassword(formatSafeFirebasePass(cleanTemp));
      } catch (err: any) {
        const msg =
          err?.code === 'auth/requires-recent-login'
            ? 'لأسباب أمنية من Firebase، يرجى تسجيل الخروج وإعادة الدخول قبل تصفير كلمة سر حسابك الشخصي.'
            : err?.message || 'تعذر تحديث كلمة المرور في Firebase Authentication.';
        return { success: false, error: msg };
      }

      setUsers(prev =>
        prev.map(u =>
          u.id === canonicalUid
            ? { ...u, password: encryptedPassword, isTempPassword: true, mustChangePassword: true }
            : u
        )
      );

      if (currentUserRef.current && currentUserRef.current.id === canonicalUid) {
        const updatedCurr = {
          ...currentUserRef.current,
          password: encryptedPassword,
          isTempPassword: true,
          mustChangePassword: true
        };
        setCurrentUser(updatedCurr);
        sessionStorage.setItem('church_app_current_user', JSON.stringify(updatedCurr));
      }

      try {
        await updateUserInFirestore(canonicalUid, {
          uid: canonicalUid,
          isFirstLogin: true,
          mustChangePassword: true,
          isTempPassword: true,
          passwordHash: encryptedPassword
        });
      } catch (err: any) {
        return { success: false, error: err?.message || 'فشل حفظ كلمة السر المؤقتة في قاعدة البيانات.' };
      }

      return { success: true };
    }

    // Other servant accounts: provision a fresh Firebase Auth credential via isolated secondaryAuth session
    // so amin_khedma_am stays signed in, then migrate /users/{oldUid} -> /users/{newAuthUid}.
    const newAuthEmail = generateUniqueInternalAuthEmail();
    const newAuthUid = await provisionFirebaseAuthUser(newAuthEmail, cleanTemp);
    if (!newAuthUid) {
      return { success: false, error: 'تعذر تحديث كلمة المرور في Firebase Authentication.' };
    }

    const primaryStage = targetUser.assignedStage || targetUser.assignments?.[0]?.stageName || 'عامة';
    const nextUserObj: AppUser = {
      ...targetUser,
      id: newAuthUid,
      uid: newAuthUid,
      authEmail: newAuthEmail,
      password: encryptedPassword,
      isTempPassword: true,
      mustChangePassword: true
    };

    try {
      await migrateUserAuthUidInFirestore({
        oldUid: canonicalUid,
        newUid: newAuthUid,
        newUser: {
          uid: newAuthUid,
          username: targetUser.username,
          authEmail: newAuthEmail,
          passwordHash: encryptedPassword,
          fullName: targetUser.name,
          phone: targetUser.phone || '',
          role: targetUser.role,
          assignedClass: primaryStage,
          assignedStage: primaryStage,
          assignedStages: targetUser.assignedStages || [],
          assignments: targetUser.assignments || [],
          isFirstLogin: true,
          mustChangePassword: true,
          isTempPassword: true,
          isProtectedRoot: Boolean(targetUser.isProtectedRoot),
          isAdminAssistant: Boolean(targetUser.isAdminAssistant),
          canAssignMakhdomeen: targetUser.canAssignMakhdomeen !== undefined ? Boolean(targetUser.canAssignMakhdomeen) : true,
          birthDate: targetUser.birthDate,
          job: targetUser.job,
          area: targetUser.area,
          notes: targetUser.notes,
          avatarUrl: targetUser.avatarUrl,
          createdAt: targetUser.createdAt || new Date().toISOString()
        }
      });

      setUsers(prev =>
        prev.filter(u => u.id !== canonicalUid && u.id !== newAuthUid).concat(nextUserObj)
      );
      setChildren(prev =>
        prev.map(c => (c.assignedServantId === canonicalUid ? { ...c, assignedServantId: newAuthUid } : c))
      );
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'فشل تحديث بيانات الحساب في قاعدة البيانات.' };
    }
  };

  const clearAllNonAdminUsers = async () => {
    const adminUser = usersRef.current.find(u => u.role === 'amin_khedma_am');
    const cleanedUsers = adminUser ? [adminUser] : [];
    setUsers(cleanedUsers);
    try {
      await clearAllNonAdminUsersFromFirestore(adminUser?.id || '');
    } catch (err) {
      console.warn('Failed to clear non-admin users from Firestore:', err);
    }
  };

  const clearAllMakhdomeen = async () => {
    setChildren([]);
    try {
      await clearAllMakhdomeenFromFirestore();
    } catch (err) {
      console.warn('Failed to clear makhdomeen from Firestore:', err);
    }
  };

  // ============================================================================
  // Stages CRUD (Persisted to /stages in Firestore)
  // ============================================================================
  const addStage = async (name: string, description?: string, supervisorName?: string, supervisorPhone?: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (stagesListRef.current.some(s => s.name === trimmed)) return;
    const newStageItem: StageItem = {
      id: 'stg_' + Date.now(),
      name: trimmed,
      description: description || '',
      supervisorName: supervisorName?.trim() || '',
      supervisorPhone: supervisorPhone?.trim() || '',
      assistantSupervisors: [],
      isCustom: true
    };
    setStagesList(prev => [...prev, newStageItem]);
    try {
      await saveStageToFirestore(newStageItem);
    } catch (err) {
      console.warn('Failed to add stage to Firestore:', err);
    }
  };

  const updateStage = async (
    stageId: string,
    updatedData: {
      name: string;
      description?: string;
      supervisorName?: string;
      supervisorPhone?: string;
      assistantSupervisors?: AssistantSupervisor[];
      meetingTime?: string;
    }
  ) => {
    const existing = stagesListRef.current.find(s => s.id === stageId);
    if (!existing) return;
    const oldName = existing.name;
    const newName = updatedData.name.trim() || oldName;

    const updatedStage: StageItem = {
      ...existing,
      name: newName,
      description: updatedData.description !== undefined ? updatedData.description : existing.description,
      supervisorName: updatedData.supervisorName !== undefined ? updatedData.supervisorName : existing.supervisorName,
      supervisorPhone: updatedData.supervisorPhone !== undefined ? updatedData.supervisorPhone : existing.supervisorPhone,
      assistantSupervisors: updatedData.assistantSupervisors !== undefined ? updatedData.assistantSupervisors : existing.assistantSupervisors,
      meetingTime: updatedData.meetingTime !== undefined ? updatedData.meetingTime : existing.meetingTime
    };

    setStagesList(prev => prev.map(s => (s.id === stageId ? updatedStage : s)));
    try {
      await saveStageToFirestore(updatedStage);
    } catch (err) {
      console.warn('Failed to update stage in Firestore:', err);
    }

    if (newName !== oldName) {
      // Cascade rename in makhdomeen & users
      const childUpdates = childrenRef.current
        .filter(c => c.stage === oldName)
        .map(c => ({ id: c.id, stage: newName, stageId }));

      setChildren(prev => prev.map(c => (c.stage === oldName ? { ...c, stage: newName, stageId } : c)));
      if (childUpdates.length > 0) {
        batchUpdateMakhdomeenStagesInFirestore(childUpdates).catch(err =>
          console.warn('Failed to cascade child stage rename:', err)
        );
      }

      const userUpdates = usersRef.current
        .filter(
          u =>
            u.assignedStage === oldName ||
            (u.assignments && u.assignments.some(a => a.stageId === stageId || a.stageName === oldName))
        )
        .map(u => {
          const nextAssignments = (u.assignments || []).map(a =>
            a.stageId === stageId || a.stageName === oldName ? { ...a, stageId, stageName: newName } : a
          );
          const nextStage = u.assignedStage === oldName ? newName : u.assignedStage;
          return {
            id: u.id,
            data: {
              assignedClass: nextStage,
              assignedStage: nextStage,
              assignedStages: nextAssignments.slice(1).map(a => a.stageName),
              assignments: nextAssignments
            }
          };
        });

      if (userUpdates.length > 0) {
        batchUpdateUsersInFirestore(userUpdates).catch(err =>
          console.warn('Failed to cascade user stage rename:', err)
        );
      }
    }
  };

  const deleteStage = async (stageName: string) => {
    const target = stagesListRef.current.find(s => s.name === stageName || s.id === stageName);
    setStagesList(prev => prev.filter(s => s.name !== stageName && s.id !== stageName));
    try {
      await deleteStageFromFirestore(target?.id || stageName);
    } catch (err) {
      console.warn('Failed to delete stage from Firestore:', err);
    }
  };

  // ============================================================================
  // Announcements
  // ============================================================================
  const addNotification = async (notifData: Omit<ChurchEventNotification, 'id' | 'createdAt'>) => {
    const isAdmin = currentUserRef.current?.role === 'amin_khedma_am' || Boolean(currentUserRef.current?.isAdminAssistant);
    const forcedStage = !isAdmin && activeStageName !== 'all' ? activeStageName : (notifData.targetStage || 'عامة');
    const resolvedScope =
      forcedStage === 'عامة'
        ? (notifData.targetScope || 'all')
        : 'specific_stages';
    const resolvedStages =
      notifData.targetStages && notifData.targetStages.length > 0
        ? (isAdmin ? notifData.targetStages : [forcedStage])
        : [forcedStage];

    const newNotif: ChurchEventNotification = {
      ...notifData,
      targetStage: forcedStage,
      targetScope: resolvedScope,
      targetStages: resolvedStages,
      id: 'n_' + Date.now(),
      createdBy: notifData.createdBy || currentUserRef.current?.name || 'أمين الخدمة',
      createdAt: new Date().toISOString()
    };
    setNotifications(prev => [newNotif, ...prev]);

    try {
      await addAnnouncementToFirestore(
        {
          title: newNotif.title,
          body: newNotif.description,
          targetRole: forcedStage,
          targetScope: resolvedScope,
          targetStages: resolvedStages,
          date: newNotif.date,
          time: newNotif.time,
          type: newNotif.type,
          createdBy: newNotif.createdBy,
          createdAt: newNotif.createdAt!
        },
        newNotif.id
      );
    } catch (err) {
      console.warn('Failed to add announcement to Firestore:', err);
    }
  };

  const deleteNotification = async (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    try {
      await deleteAnnouncementFromFirestore(id);
    } catch (err) {
      console.warn('Failed to delete announcement from Firestore:', err);
    }
  };

  // Stage Scope
  const setSelectedStageScope = (stage: Stage | 'all') => {
    if (effectiveRole !== 'amin_khedma_am') {
      const assigned = activeStageName !== 'all' ? activeStageName : (currentUserRef.current?.assignedStage || 'all');
      setSelectedStageScopeState(assigned);
      setFilters(prev => ({ ...prev, stageFilter: assigned }));
      return;
    }
    setSelectedStageScopeState(stage);
    setFilters(prev => ({ ...prev, stageFilter: stage }));
    if (stage === 'all') {
      setActiveStageId('all');
    } else {
      const found = resolveStageItem(stage, stagesListRef.current);
      setActiveStageId(found?.id || stage);
    }
  };

  const setRole = (newRole: Role) => {
    setRoleState(newRole);
    if (newRole === 'khadem' || newRole === 'general_dock') {
      if (
        activeTab === 'servants_directory' ||
        activeTab === 'servants_attendance' ||
        activeTab === 'supervisors_directory' ||
        activeTab === 'supervisors_attendance'
      ) {
        setActiveTabState('children_directory');
      }
    } else if (newRole === 'amin_fasl' || newRole === 'mosaed_amin') {
      if (activeTab === 'supervisors_directory' || activeTab === 'supervisors_attendance') {
        setActiveTabState('children_directory');
      }
    }
  };

  const setActiveTab = (tab: TabId) => {
    setActiveTabState(tab);
    try {
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        if (tab === 'home') {
          url.searchParams.delete('tab');
        } else {
          url.searchParams.set('tab', tab);
        }
        window.history.replaceState({}, '', url.toString());
      }
    } catch {
      // ignore
    }
  };

  // ============================================================================
  // Children CRUD (Full Field Sync)
  // ============================================================================
  const addChild = async (childData: Omit<Child, 'id' | 'createdAt'>) => {
    const stg = resolveStageItem(childData.stage, stagesListRef.current);
    const createdAt = new Date().toISOString().split('T')[0];
    const newChild: Child = {
      ...childData,
      stageId: stg?.id || childData.stageId || childData.stage,
      id: 'c_' + Date.now(),
      createdAt
    };
    setChildren(prev => [newChild, ...prev]);

    try {
      await addMakhdoomToFirestore(
        {
          fullName: childData.name,
          birthDate: childData.birthDate || '2017-01-01',
          stage: childData.stage,
          stageId: newChild.stageId,
          secondaryStages: childData.secondaryStages || [],
          assignedServantId: childData.assignedServantId,
          classGroup: childData.stage,
          points: 10,
          age: childData.age,
          gender: childData.gender,
          area: childData.area || '',
          address: childData.address || '',
          notes: childData.notes || '',
          phone: childData.phone || '',
          parentName: childData.parentName || '',
          parentRelation: childData.parentRelation || 'الأب',
          parentPhone: childData.parentPhone || '',
          parentJob: childData.parentJob || '',
          parent2Name: childData.parent2Name || '',
          parent2Relation: childData.parent2Relation || '',
          parent2Phone: childData.parent2Phone || '',
          parent2Job: childData.parent2Job || '',
          createdAt
        },
        newChild.id
      );
    } catch (err) {
      console.warn('Failed to add child to Firestore:', err);
    }
  };

  const batchAddChildren = async (childrenData: Omit<Child, 'id' | 'createdAt'>[]) => {
    const timestamp = Date.now();
    const createdAt = new Date().toISOString().split('T')[0];
    const newChildren: Child[] = childrenData.map((cd, index) => {
      const stg = resolveStageItem(cd.stage, stagesListRef.current);
      return {
        ...cd,
        stageId: stg?.id || cd.stageId || cd.stage,
        id: `c_${timestamp}_${index}`,
        createdAt
      };
    });

    setChildren(prev => [...newChildren, ...prev]);

    try {
      await batchAddMakhdomeenToFirestore(
        newChildren.map(c => ({
          id: c.id,
          fullName: c.name,
          birthDate: c.birthDate || '2017-01-01',
          stage: c.stage,
          stageId: c.stageId,
          secondaryStages: c.secondaryStages || [],
          classGroup: c.stage,
          points: 10,
          age: c.age,
          gender: c.gender,
          area: c.area || '',
          address: c.address || '',
          notes: c.notes || '',
          phone: c.phone || '',
          parentName: c.parentName || '',
          parentRelation: c.parentRelation || 'الأب',
          parentPhone: c.parentPhone || '',
          parentJob: c.parentJob || '',
          parent2Name: c.parent2Name || '',
          parent2Relation: c.parent2Relation || '',
          parent2Phone: c.parent2Phone || '',
          parent2Job: c.parent2Job || '',
          createdAt
        }))
      );
    } catch (err) {
      console.warn('Failed to batch save makhdomeen to Firestore:', err);
    }
  };

  const updateChild = async (id: string, childData: Partial<Child>) => {
    // Respect canAssignMakhdomeen restriction
    const canModifyStage = currentUserRef.current?.canAssignMakhdomeen !== false;
    const sanitizedChildData = { ...childData };
    if (!canModifyStage) {
      delete sanitizedChildData.stage;
      delete sanitizedChildData.stageId;
      delete sanitizedChildData.secondaryStages;
    }

    setChildren(prev => prev.map(item => (item.id === id ? { ...item, ...sanitizedChildData } : item)));

    try {
      const updateData: Record<string, any> = {};
      if (sanitizedChildData.name !== undefined) updateData.fullName = sanitizedChildData.name;
      if (sanitizedChildData.birthDate !== undefined) updateData.birthDate = sanitizedChildData.birthDate;
      if (sanitizedChildData.stage !== undefined) {
        updateData.stage = sanitizedChildData.stage;
        updateData.classGroup = sanitizedChildData.stage;
        const stg = resolveStageItem(sanitizedChildData.stage, stagesListRef.current);
        if (stg) updateData.stageId = stg.id;
      }
      if (sanitizedChildData.secondaryStages !== undefined) updateData.secondaryStages = sanitizedChildData.secondaryStages;
      if (sanitizedChildData.assignedServantId !== undefined) updateData.assignedServantId = sanitizedChildData.assignedServantId;
      if (sanitizedChildData.age !== undefined) updateData.age = sanitizedChildData.age;
      if (sanitizedChildData.gender !== undefined) updateData.gender = sanitizedChildData.gender;
      if (sanitizedChildData.area !== undefined) updateData.area = sanitizedChildData.area;
      if (sanitizedChildData.address !== undefined) updateData.address = sanitizedChildData.address;
      if (sanitizedChildData.notes !== undefined) updateData.notes = sanitizedChildData.notes;
      if (sanitizedChildData.phone !== undefined) updateData.phone = sanitizedChildData.phone;
      if (sanitizedChildData.parentName !== undefined) updateData.parentName = sanitizedChildData.parentName;
      if (sanitizedChildData.parentRelation !== undefined) updateData.parentRelation = sanitizedChildData.parentRelation;
      if (sanitizedChildData.parentPhone !== undefined) updateData.parentPhone = sanitizedChildData.parentPhone;
      if (sanitizedChildData.parentJob !== undefined) updateData.parentJob = sanitizedChildData.parentJob;
      if (sanitizedChildData.parent2Name !== undefined) updateData.parent2Name = sanitizedChildData.parent2Name;
      if (sanitizedChildData.parent2Relation !== undefined) updateData.parent2Relation = sanitizedChildData.parent2Relation;
      if (sanitizedChildData.parent2Phone !== undefined) updateData.parent2Phone = sanitizedChildData.parent2Phone;
      if (sanitizedChildData.parent2Job !== undefined) updateData.parent2Job = sanitizedChildData.parent2Job;

      await updateMakhdoomInFirestore(id, updateData);
    } catch (err) {
      console.warn('Failed to update child in Firestore:', err);
    }
  };

  const deleteChild = async (id: string) => {
    setChildren(prev => prev.filter(item => item.id !== id));
    try {
      await deleteMakhdoomFromFirestore(id);
    } catch (err) {
      console.warn('Failed to delete child from Firestore:', err);
    }
  };

  // ============================================================================
  // Servants & Supervisors CRUD (Single Canonical /users/{uid} Doc)
  // ============================================================================
  const addServant = async (servantData: Omit<Servant, 'id' | 'createdAt'>) => {
    const stage = servantData.assignedStage || 'في انتظار التعيين';
    const isPending = stage === 'في انتظار التعيين';
    const isDock = stage === 'عامة' || servantData.roleType === 'general_dock';
    const userRole: Role =
      servantData.roleType === 'captain'
        ? 'amin_fasl'
        : servantData.roleType === 'first_mate'
        ? 'mosaed_amin'
        : isDock
        ? 'general_dock'
        : 'khadem';

    const tempPass = 'srv_' + Math.floor(1000 + Math.random() * 9000);
    const cleanUsername = ((servantData.phone || 'srv_' + Date.now()).replace(/[^a-zA-Z0-9_.]/g, '') || 'srv_' + Date.now()).trim();
    const authEmail = generateUniqueInternalAuthEmail();
    const encryptedHash = await hashPassword(tempPass);
    const provisionedUid = await provisionFirebaseAuthUser(authEmail, tempPass);
    const newId = provisionedUid || 's_' + Date.now();

    const assignments = buildAssignmentsForUser(
      {
        role: userRole,
        assignedStage: stage,
        assignedStages: servantData.assignedStages,
        assignments: servantData.assignments
      },
      stagesListRef.current
    );

    const invariantErr = validateAssignmentsInvariants(null, assignments, usersRef.current, userRole);
    if (invariantErr) {
      throw new Error(invariantErr);
    }

    const roleType = servantData.roleType || ((isPending || isDock) ? 'general_dock' : 'crew');
    const roleTitle =
      servantData.roleTitle ||
      (isPending ? 'في انتظار التعيين' : isDock ? 'خادم عام' : `خادم مرحلة (${stage})`);

    const newServant: Servant = {
      ...servantData,
      id: newId,
      assignedStage: stage,
      assignments,
      roleType,
      roleTitle,
      createdAt: new Date().toISOString().split('T')[0]
    };
    setServants(prev => [newServant, ...prev]);

    try {
      await addUserToFirestore({
        uid: newId,
        username: cleanUsername,
        authEmail,
        passwordHash: encryptedHash,
        fullName: servantData.name,
        phone: servantData.phone || '',
        role: userRole,
        assignedClass: stage,
        assignedStage: stage,
        assignedStages: assignments.slice(1).map(a => a.stageName),
        assignments,
        isFirstLogin: true,
        mustChangePassword: true,
        birthDate: servantData.birthDate || '1995-01-01',
        job: servantData.job || 'خادم',
        area: servantData.area || 'المعراج السفلي',
        notes: servantData.notes || '',
        createdAt: new Date().toISOString()
      });
      await syncUserLoginAliases({
        authEmail,
        username: cleanUsername,
        phone: servantData.phone || ''
      });
    } catch (err) {
      console.warn('Failed to sync added servant to Firestore:', err);
    }
  };

  const updateServant = async (id: string, servantData: Partial<Servant>) => {
    const matchedUser = usersRef.current.find(u => u.id === id);
    const targetServant = servantsRef.current.find(s => s.id === id);
    const canonicalUid = matchedUser?.id || id;
    const nextStage = servantData.assignedStage || matchedUser?.assignedStage || targetServant?.assignedStage || 'عامة';
    const nextRole: Role =
      servantData.roleType === 'captain'
        ? 'amin_fasl'
        : servantData.roleType === 'first_mate'
        ? 'mosaed_amin'
        : servantData.roleType === 'general_dock'
        ? 'general_dock'
        : (matchedUser?.role || 'khadem');

    const nextAssignments = buildAssignmentsForUser(
      {
        role: nextRole,
        assignedStage: nextStage,
        assignedStages: servantData.assignedStages ?? matchedUser?.assignedStages,
        assignments: servantData.assignments ?? matchedUser?.assignments
      },
      stagesListRef.current
    );

    const invariantErr = validateAssignmentsInvariants(canonicalUid, nextAssignments, usersRef.current, nextRole);
    if (invariantErr) {
      throw new Error(invariantErr);
    }

    setServants(prev =>
      prev.map(item =>
        item.id === id ? { ...item, ...servantData, assignedStage: nextStage, assignments: nextAssignments } : item
      )
    );

    try {
      const payload: Record<string, any> = {
        uid: canonicalUid,
        assignedClass: nextStage,
        assignedStage: nextStage,
        assignedStages: nextAssignments.slice(1).map(a => a.stageName),
        assignments: nextAssignments,
        role: nextRole
      };
      if (servantData.name) payload.fullName = servantData.name;
      if (servantData.phone !== undefined) payload.phone = servantData.phone;
      if (servantData.job !== undefined) payload.job = servantData.job;
      if (servantData.area !== undefined) payload.area = servantData.area;
      if (servantData.birthDate !== undefined) payload.birthDate = servantData.birthDate;
      if (servantData.notes !== undefined) payload.notes = servantData.notes;

      await updateUserInFirestore(canonicalUid, payload);
    } catch (err) {
      console.warn('Failed to sync updated servant to Firestore:', err);
    }
  };

  const deleteServant = async (id: string) => {
    setServants(prev => prev.filter(item => item.id !== id));
    const matchedUser = usersRef.current.find(u => u.id === id);
    if (matchedUser && matchedUser.role !== 'amin_khedma_am' && !matchedUser.isProtectedRoot) {
      await deleteUser(matchedUser.id);
    } else {
      await deleteUserFromFirestore(id).catch(() => undefined);
    }
  };

  const addSupervisor = async (supData: Omit<Supervisor, 'id' | 'createdAt'> & { servantId?: string }) => {
    const isAssistant = Boolean(supData.isAssistant || supData.roleType === 'assistant_supervisor');
    const stage = supData.supervisedStage || supData.assignedStage || 'عامة';
    const nextRole: Role = isAssistant ? 'mosaed_amin' : 'amin_fasl';
    const targetId = supData.servantId || '';

    const matchedUser = targetId
      ? usersRef.current.find(u => u.id === targetId)
      : usersRef.current.find(
          u => (u.phone && supData.phone && u.phone.trim() === supData.phone.trim()) || u.name === supData.name
        );

    const stg = resolveStageItem(stage, stagesListRef.current);
    const existingAssignments = matchedUser?.assignments || [];
    const mergedAssignments = buildAssignmentsForUser(
      {
        role: nextRole,
        assignments: [
          {
            stageId: stg?.id || stage,
            stageName: stg?.name || stage,
            role: isAssistant ? 'mosaed_amin' : 'amin_fasl'
          },
          ...existingAssignments.filter(a => a.stageName !== (stg?.name || stage))
        ]
      },
      stagesListRef.current
    );

    const invariantErr = validateAssignmentsInvariants(
      matchedUser?.id || null,
      mergedAssignments,
      usersRef.current,
      nextRole
    );
    if (invariantErr) {
      throw new Error(invariantErr);
    }

    if (matchedUser) {
      await updateUserInFirestore(matchedUser.id, {
        uid: matchedUser.id,
        role: nextRole,
        assignedClass: stage,
        assignedStage: stage,
        assignedStages: mergedAssignments.slice(1).map(a => a.stageName),
        assignments: mergedAssignments,
        fullName: supData.name || matchedUser.name,
        phone: supData.phone || matchedUser.phone || ''
      });
    } else {
      await addServant({
        name: supData.name,
        assignedStage: stage,
        assignments: mergedAssignments,
        area: supData.area || '',
        phone: supData.phone || '',
        job: supData.job || 'خادم',
        birthDate: supData.birthDate || '1995-01-01',
        birthMonth: supData.birthMonth || 1,
        roleType: isAssistant ? 'first_mate' : 'captain',
        roleTitle: isAssistant ? `مساعد أمين مرحلة (${stage})` : `أمين مرحلة (${stage})`,
        notes: supData.notes
      });
    }
  };

  const updateSupervisor = async (id: string, supData: Partial<Supervisor>) => {
    const matchedUser = usersRef.current.find(u => u.id === id);
    const currentSup = supervisorsRef.current.find(sp => sp.id === id);
    const isAssistant =
      supData.isAssistant !== undefined
        ? supData.isAssistant
        : supData.roleType === 'assistant_supervisor' || currentSup?.isAssistant;
    const nextRole: Role = isAssistant ? 'mosaed_amin' : 'amin_fasl';
    const stage = supData.supervisedStage || supData.assignedStage || currentSup?.assignedStage || 'عامة';
    const stg = resolveStageItem(stage, stagesListRef.current);

    const nextAssignments = buildAssignmentsForUser(
      {
        role: nextRole,
        assignments: [
          {
            stageId: stg?.id || stage,
            stageName: stg?.name || stage,
            role: isAssistant ? 'mosaed_amin' : 'amin_fasl'
          },
          ...(matchedUser?.assignments || []).filter(a => a.stageName !== (stg?.name || stage))
        ]
      },
      stagesListRef.current
    );

    const invariantErr = validateAssignmentsInvariants(id, nextAssignments, usersRef.current, nextRole);
    if (invariantErr) {
      throw new Error(invariantErr);
    }

    setSupervisors(prev => prev.map(item => (item.id === id ? { ...item, ...supData } : item)));

    await updateUserInFirestore(id, {
      uid: id,
      role: nextRole,
      assignedClass: stage,
      assignedStage: stage,
      assignedStages: nextAssignments.slice(1).map(a => a.stageName),
      assignments: nextAssignments,
      ...(supData.name ? { fullName: supData.name } : {}),
      ...(supData.phone !== undefined ? { phone: supData.phone } : {}),
      ...(supData.area !== undefined ? { area: supData.area } : {}),
      ...(supData.job !== undefined ? { job: supData.job } : {}),
      ...(supData.notes !== undefined ? { notes: supData.notes } : {})
    });
  };

  /**
   * Non-destructive supervisor removal:
   * Demotes the supervisor back to regular servant ('khadem') in Firestore and preserves their servant profile.
   */
  const deleteSupervisor = async (id: string) => {
    const matchedUser = usersRef.current.find(u => u.id === id);
    const targetSup = supervisorsRef.current.find(s => s.id === id);
    setSupervisors(prev => prev.filter(item => item.id !== id));

    const stage = targetSup?.assignedStage || targetSup?.supervisedStage || matchedUser?.assignedStage || 'عامة';
    const demotedAssignments = (matchedUser?.assignments || []).map(a => ({
      ...a,
      role: 'khadem' as ClassAssignmentRole
    }));

    try {
      await updateUserInFirestore(id, {
        uid: id,
        role: 'khadem',
        assignedClass: stage,
        assignedStage: stage,
        assignments: demotedAssignments
      });
    } catch (err) {
      console.warn('Failed to demote supervisor in Firestore:', err);
    }
  };

  // ============================================================================
  // Library Books CRUD (Full Field Sync + Stage Isolation)
  // ============================================================================
  const addBook = async (bookData: Omit<Book, 'id'>) => {
    const isAdmin = currentUserRef.current?.role === 'amin_khedma_am' || Boolean(currentUserRef.current?.isAdminAssistant);
    const lockedStage = !isAdmin && activeStageName !== 'all' ? activeStageName : null;

    const targetStages = lockedStage
      ? [lockedStage]
      : (bookData.targetStages && bookData.targetStages.length > 0 ? bookData.targetStages : [bookData.targetStage || 'عامة']);
    const primaryStage = targetStages[0] || 'عامة';
    const visibility: 'all' | 'specific_stages' =
      !lockedStage && targetStages.includes('عامة') ? 'all' : 'specific_stages';

    const newBook: Book = {
      ...bookData,
      id: 'b_' + Date.now(),
      visibility,
      targetStages,
      targetStage: primaryStage
    };
    setBooks(prev => [newBook, ...prev]);

    try {
      await addLibraryBookToFirestore(
        {
          title: newBook.title,
          category: newBook.category,
          visibility,
          targetGrade: primaryStage,
          targetStages,
          fileUrl: newBook.pdfUrl || newBook.fileUrl || '',
          pdfUrl: newBook.pdfUrl || newBook.fileUrl || '',
          pdfFileName: newBook.pdfFileName,
          pdfFileSize: newBook.pdfFileSize,
          coverImage: newBook.coverImage,
          coverBg: newBook.coverBg,
          author: newBook.author,
          year: newBook.year,
          description: newBook.description,
          contentSummary: newBook.contentSummary,
          pageCount: newBook.pageCount
        },
        newBook.id
      );
    } catch (err) {
      console.warn('Failed to add book to Firestore:', err);
    }
  };

  const updateBook = async (id: string, updated: Partial<Book>) => {
    const targetStages = updated.targetStages;
    const visibility = targetStages
      ? (targetStages.includes('عامة') ? 'all' : 'specific_stages')
      : updated.visibility;

    setBooks(prev =>
      prev.map(item => {
        if (item.id !== id) return item;
        const resolvedStages = targetStages || item.targetStages || [item.targetStage || 'عامة'];
        return {
          ...item,
          ...updated,
          ...(visibility ? { visibility } : {}),
          targetStages: resolvedStages,
          targetStage: updated.targetStage || resolvedStages[0] || item.targetStage
        };
      })
    );

    try {
      const updateData: Record<string, any> = {};
      if (updated.title !== undefined) updateData.title = updated.title;
      if (updated.category !== undefined) updateData.category = updated.category;
      if (updated.targetStage !== undefined) updateData.targetGrade = updated.targetStage;
      if (updated.targetStages !== undefined) updateData.targetStages = updated.targetStages;
      if (visibility !== undefined) updateData.visibility = visibility;
      if (updated.pdfUrl !== undefined) {
        updateData.fileUrl = updated.pdfUrl;
        updateData.pdfUrl = updated.pdfUrl;
      }
      if (updated.pdfFileName !== undefined) updateData.pdfFileName = updated.pdfFileName;
      if (updated.pdfFileSize !== undefined) updateData.pdfFileSize = updated.pdfFileSize;
      if (updated.coverImage !== undefined) updateData.coverImage = updated.coverImage;
      if (updated.author !== undefined) updateData.author = updated.author;
      if (updated.year !== undefined) updateData.year = updated.year;
      if (updated.description !== undefined) updateData.description = updated.description;
      if (updated.contentSummary !== undefined) updateData.contentSummary = updated.contentSummary;
      await updateLibraryBookInFirestore(id, updateData);
    } catch (err) {
      console.warn('Failed to update book in Firestore:', err);
    }
  };

  const deleteBook = async (id: string) => {
    setBooks(prev => prev.filter(item => item.id !== id));
    try {
      await deleteLibraryBookFromFirestore(id);
    } catch (err) {
      console.warn('Failed to delete book from Firestore:', err);
    }
  };

  // ============================================================================
  // Attendance (Anti-Self-Attendance Enforced)
  // ============================================================================
  const getAttendanceRecord = (
    targetType: 'child' | 'servant' | 'supervisor',
    eventType: ChildEventType | StaffEventType,
    date: string
  ) => {
    return attendance.find(a => a.targetType === targetType && a.eventType === eventType && a.date === date);
  };

  const markAttendance = async (
    targetType: 'child' | 'servant' | 'supervisor',
    eventType: ChildEventType | StaffEventType,
    date: string,
    personId: string,
    status: AttendanceStatus,
    note?: string
  ) => {
    const recordedByUid = currentUserRef.current?.id || '';
    if (recordedByUid && personId === recordedByUid) {
      console.warn('Blocked self-attendance attempt for user:', recordedByUid);
      return;
    }

    setAttendance(prev => {
      const existingIndex = prev.findIndex(
        a => a.targetType === targetType && a.eventType === eventType && a.date === date
      );
      if (existingIndex > -1) {
        const updated = [...prev];
        const recordObj = { ...updated[existingIndex].records };
        recordObj[personId] = { status, note, recordedByUid };
        updated[existingIndex] = { ...updated[existingIndex], recordedByUid, records: recordObj };
        return updated;
      }
      const newRecord: AttendanceRecord = {
        id: `att_${targetType}_${eventType}_${date}`,
        date,
        periodType: 'weekly',
        targetType,
        eventType,
        recordedByUid,
        records: { [personId]: { status, note, recordedByUid } }
      };
      return [...prev, newRecord];
    });

    try {
      const monthNum = parseInt(date.split('-')[1], 10) || new Date().getMonth() + 1;
      await saveAttendanceToFirestore({
        date,
        month: monthNum,
        periodType: 'weekly',
        personId,
        personType: targetType,
        eventType,
        status,
        recordedByUid,
        ...(note ? { note } : {})
      });
    } catch (err) {
      console.warn('Failed to save attendance to Firestore:', err);
    }
  };

  const markAllAttendance = async (
    targetType: 'child' | 'servant' | 'supervisor',
    eventType: ChildEventType | StaffEventType,
    date: string,
    personIds: string[],
    status: AttendanceStatus
  ) => {
    const recordedByUid = currentUserRef.current?.id || '';
    const allowedPersonIds = recordedByUid ? personIds.filter(id => id !== recordedByUid) : personIds;
    if (allowedPersonIds.length === 0) return;

    setAttendance(prev => {
      const existingIndex = prev.findIndex(
        a => a.targetType === targetType && a.eventType === eventType && a.date === date
      );
      const recordsUpdate: Record<string, { status: AttendanceStatus; note?: string; recordedByUid?: string }> = {};
      allowedPersonIds.forEach(id => {
        recordsUpdate[id] = { status, recordedByUid };
      });

      if (existingIndex > -1) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          recordedByUid,
          records: { ...updated[existingIndex].records, ...recordsUpdate }
        };
        return updated;
      }
      return [
        ...prev,
        {
          id: `att_${targetType}_${eventType}_${date}`,
          date,
          periodType: 'weekly',
          targetType,
          eventType,
          recordedByUid,
          records: recordsUpdate
        }
      ];
    });

    try {
      const monthNum = parseInt(date.split('-')[1], 10) || new Date().getMonth() + 1;
      const entries = allowedPersonIds.map(pId => ({
        date,
        month: monthNum,
        periodType: 'weekly' as const,
        personId: pId,
        personType: targetType,
        eventType,
        status,
        recordedByUid
      }));
      await batchSaveAttendanceToFirestore(entries);
    } catch (err) {
      console.warn('Failed to batch save attendance to Firestore:', err);
    }
  };

  // ============================================================================
  // Database Import/Export & Full Clean Wipe
  // ============================================================================
  const clearAllDatabase = async (): Promise<void> => {
    const curr = currentUserRef.current;
    if (!curr || curr.role !== 'amin_khedma_am' || curr.isAdminAssistant) {
      throw new Error('هذه العملية مقتصرة فقط على حساب أمين الخدمة العام.');
    }

    const adminUser =
      usersRef.current.find(u => u.role === 'amin_khedma_am' || u.isProtectedRoot) || curr;
    const protectedAuthEmail =
      adminUser?.authEmail ||
      auth.currentUser?.email ||
      '';

    await wipeAllDatabaseFromFirestore({
      protectedRootUid: adminUser.id,
      protectedAuthEmail
    });

    const currentTheme = theme;
    const preservedUsers = adminUser ? [adminUser] : [];

    setChildren([]);
    setServants([]);
    setSupervisors([]);
    setAttendance([]);
    setNotifications([]);
    setBooks([]);
    setStagesList([]);
    setSeasonalEvents([]);
    setPendingRegistrations([]);
    setUsers(preservedUsers);
    setActiveStageId('all');
    setSelectedStageScopeState('all');

    purgeDomainLocalStorage();
    localStorage.setItem('church_app_theme', currentTheme);
  };

  const exportDatabaseJSON = () => {
    return JSON.stringify(
      {
        exportDate: new Date().toISOString(),
        churchName: 'كنيسة ماريوحنا المعمدان بالمعراج',
        version: '2026.2',
        stagesList,
        children,
        servants,
        supervisors,
        books,
        attendance,
        notifications,
        users: users.map(u => ({ ...u, password: '***', passwordHash: '***' }))
      },
      null,
      2
    );
  };

  const importDatabaseJSON = (jsonString: string): { success: boolean; error?: string } => {
    try {
      const data = JSON.parse(jsonString);
      if (!data) return { success: false, error: 'الملف فارغ أو غير صالح' };
      if (Array.isArray(data.children)) setChildren(data.children);
      if (Array.isArray(data.servants)) setServants(data.servants);
      if (Array.isArray(data.supervisors)) setSupervisors(data.supervisors);
      if (Array.isArray(data.books)) setBooks(data.books);
      if (Array.isArray(data.attendance)) setAttendance(data.attendance);
      if (Array.isArray(data.notifications)) setNotifications(data.notifications);
      if (Array.isArray(data.stagesList)) setStagesList(data.stagesList);
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message || 'فشل قراءة ملف الـ JSON' };
    }
  };

  // ============================================================================
  // Batch Operations Using Live Refs (Synced to Firestore)
  // ============================================================================
  const unassignAllServantsFromClasses = () => {
    const liveUsers = usersRef.current;
    const liveServants = servantsRef.current;
    const liveSupervisors = supervisorsRef.current;
    const liveStages = stagesListRef.current;

    const userUpdates = liveUsers
      .filter(u => u.role !== 'amin_khedma_am' && !u.isProtectedRoot)
      .map(u => ({
        id: u.id,
        data: {
          role: 'general_dock',
          assignedClass: 'عامة',
          assignedStage: 'عامة',
          assignedStages: [],
          assignments: []
        }
      }));

    const clearedStages = liveStages.map(stg =>
      stg.name !== 'عامة'
        ? { ...stg, supervisorName: '', supervisorPhone: '', captainName: '', captainPhone: '', firstMateName: '', firstMatePhone: '', assistantSupervisors: [] }
        : stg
    );

    setServants(prev =>
      prev.map(s => ({ ...s, assignedStage: 'عامة', assignedStages: [], assignments: [], roleType: 'general_dock', roleTitle: 'خادم عام' }))
    );
    setSupervisors([]);
    setStagesList(clearedStages);
    setUsers(prev =>
      prev.map(u =>
        u.role !== 'amin_khedma_am' && !u.isProtectedRoot
          ? { ...u, role: 'general_dock', assignedStage: 'عامة', assignedStages: [], assignments: [] }
          : u
      )
    );

    batchUpdateUsersInFirestore(userUpdates).catch(err => console.warn('Failed to batch unassign users:', err));
    batchSaveStagesToFirestore(clearedStages).catch(err => console.warn('Failed to batch clear stages:', err));

    return {
      servantsUpdated: liveServants.length,
      supervisorsUpdated: liveSupervisors.length,
      classesCleared: liveStages.filter(s => s.name !== 'عامة').length
    };
  };

  const moveServantsToGeneralDock = async (targetStage?: string): Promise<number> => {
    const isAll = !targetStage || targetStage === 'all' || targetStage === 'عامة';
    const liveUsers = usersRef.current;
    const liveStages = stagesListRef.current;

    const affectedUsers = liveUsers.filter(u => {
      if (u.role === 'amin_khedma_am' || u.isProtectedRoot) return false;
      if (isAll) return true;
      return (
        u.assignedStage === targetStage ||
        (u.assignments && u.assignments.some(a => a.stageName === targetStage || a.stageId === targetStage))
      );
    });

    const userUpdates = affectedUsers.map(u => {
      if (isAll) {
        return {
          id: u.id,
          data: {
            role: 'general_dock',
            assignedClass: 'عامة',
            assignedStage: 'عامة',
            assignedStages: [],
            assignments: []
          }
        };
      }
      const remaining = (u.assignments || []).filter(a => a.stageName !== targetStage && a.stageId !== targetStage);
      const nextPrimary = remaining[0]?.stageName || 'عامة';
      const nextRole: Role = remaining.length > 0 ? remaining[0].role : 'general_dock';
      return {
        id: u.id,
        data: {
          role: nextRole,
          assignedClass: nextPrimary,
          assignedStage: nextPrimary,
          assignedStages: remaining.slice(1).map(a => a.stageName),
          assignments: remaining
        }
      };
    });

    const updatedStages = liveStages.map(stg => {
      if (isAll || stg.name === targetStage) {
        return {
          ...stg,
          supervisorName: '',
          supervisorPhone: '',
          captainName: '',
          captainPhone: '',
          firstMateName: '',
          firstMatePhone: '',
          assistantSupervisors: []
        };
      }
      return stg;
    });

    setStagesList(updatedStages);

    if (userUpdates.length > 0) {
      await batchUpdateUsersInFirestore(userUpdates);
    }
    await batchSaveStagesToFirestore(updatedStages);
    return affectedUsers.length;
  };

  const assignServantRole = async (
    servantId: string,
    targetStage: string,
    roleType: 'captain' | 'first_mate' | 'crew' | 'general_dock' = 'crew',
    roleTitle?: string,
    additionalAssignments?: ClassAssignment[]
  ): Promise<void> => {
    const liveUsers = usersRef.current;
    const liveServants = servantsRef.current;
    const liveStages = stagesListRef.current;

    const servant = liveServants.find(s => s.id === servantId);
    const matchedUser =
      liveUsers.find(u => u.id === servantId) ||
      liveUsers.find(
        u =>
          (servant?.phone && u.phone && u.phone.trim() === servant.phone.trim()) ||
          (servant?.name && u.name && u.name.trim() === servant.name.trim())
      );

    const canonicalUid = matchedUser?.id || servant?.id || servantId;
    const mappedRole: Role =
      roleType === 'captain'
        ? 'amin_fasl'
        : roleType === 'first_mate'
        ? 'mosaed_amin'
        : roleType === 'general_dock'
        ? 'general_dock'
        : 'khadem';

    let nextAssignments: ClassAssignment[] = [];
    if (roleType !== 'general_dock' && targetStage && targetStage !== 'عامة') {
      const primaryStg = resolveStageItem(targetStage, liveStages);
      const primaryClassRole: ClassAssignmentRole =
        roleType === 'captain' ? 'amin_fasl' : roleType === 'first_mate' ? 'mosaed_amin' : 'khadem';
      nextAssignments = buildAssignmentsForUser(
        {
          role: mappedRole,
          assignments: [
            {
              stageId: primaryStg?.id || targetStage,
              stageName: primaryStg?.name || targetStage,
              role: primaryClassRole
            },
            ...(additionalAssignments || [])
          ]
        },
        liveStages
      );
    }

    const invariantErr = validateAssignmentsInvariants(canonicalUid, nextAssignments, liveUsers, mappedRole);
    if (invariantErr) {
      throw new Error(invariantErr);
    }

    const computedTitle =
      roleTitle ||
      (roleType === 'captain'
        ? `أمين مرحلة (${targetStage})`
        : roleType === 'first_mate'
        ? `مساعد أمين مرحلة (${targetStage})`
        : roleType === 'general_dock'
        ? 'خادم عام'
        : `خادم مرحلة (${targetStage})`);

    setServants(prev =>
      prev.map(s =>
        s.id === servantId || s.id === canonicalUid
          ? {
              ...s,
              assignedStage: targetStage,
              assignedStages: nextAssignments.slice(1).map(a => a.stageName),
              assignments: nextAssignments,
              roleType,
              roleTitle: computedTitle
            }
          : s
      )
    );

    const effectiveUserRole: Role = matchedUser?.role === 'amin_khedma_am' ? 'amin_khedma_am' : mappedRole;
    await updateUserInFirestore(canonicalUid, {
      uid: canonicalUid,
      role: effectiveUserRole,
      assignedClass: targetStage,
      assignedStage: targetStage,
      assignedStages: nextAssignments.slice(1).map(a => a.stageName),
      assignments: nextAssignments,
      fullName: matchedUser?.name || servant?.name || '',
      phone: matchedUser?.phone || servant?.phone || ''
    });

    // Update stage metadata when appointing captain / first mate
    const stgItem = resolveStageItem(targetStage, liveStages);
    if (stgItem && (roleType === 'captain' || roleType === 'first_mate')) {
      const personName = matchedUser?.name || servant?.name || '';
      const personPhone = matchedUser?.phone || servant?.phone || '';
      const updatedStg: StageItem =
        roleType === 'captain'
          ? {
              ...stgItem,
              supervisorName: personName,
              supervisorPhone: personPhone,
              captainName: personName,
              captainPhone: personPhone
            }
          : {
              ...stgItem,
              firstMateName: personName,
              firstMatePhone: personPhone,
              assistantSupervisors: [
                ...(stgItem.assistantSupervisors || []).filter(a => a.name !== personName),
                { name: personName, phone: personPhone }
              ]
            };
      setStagesList(prev => prev.map(s => (s.id === stgItem.id ? updatedStg : s)));
      saveStageToFirestore(updatedStg).catch(err => console.warn('Failed to update stage leader metadata:', err));
    }
  };

  // Self Profile Update (Strictly single canonical UID doc, sanitized fields, supports username + avatarUrl + alias sync)
  const updatePersonalProfile = async (profileData: Partial<AppUser>): Promise<void> => {
    const curr = currentUserRef.current;
    if (!curr) return;

    let nextUsername = curr.username;
    if (profileData.username !== undefined) {
      const cleanNewUsername = profileData.username.trim();
      const validation = validateUsername(cleanNewUsername, usersRef.current, curr.id);
      if (!validation.valid) {
        throw new Error(validation.error || 'اسم المستخدم غير صالح');
      }
      nextUsername = cleanNewUsername;
    }

    const canonicalAuthEmail =
      curr.authEmail ||
      auth.currentUser?.email ||
      generateUniqueInternalAuthEmail();

    const updatedUser: AppUser = {
      ...curr,
      username: nextUsername,
      authEmail: canonicalAuthEmail,
      ...(profileData.name !== undefined ? { name: profileData.name } : {}),
      ...(profileData.phone !== undefined ? { phone: profileData.phone } : {}),
      ...(profileData.birthDate !== undefined ? { birthDate: profileData.birthDate } : {}),
      ...(profileData.job !== undefined ? { job: profileData.job } : {}),
      ...(profileData.area !== undefined ? { area: profileData.area } : {}),
      ...(profileData.notes !== undefined ? { notes: profileData.notes } : {}),
      ...(profileData.avatarUrl !== undefined ? { avatarUrl: profileData.avatarUrl } : {})
    };

    setCurrentUser(updatedUser);
    sessionStorage.setItem('church_app_current_user', JSON.stringify(updatedUser));

    setUsers(prev =>
      prev.map(u => (u.id === curr.id ? updatedUser : u))
    );

    try {
      await setFirestoreUserWithMerge(curr.id, {
        uid: curr.id,
        username: updatedUser.username,
        authEmail: canonicalAuthEmail,
        fullName: updatedUser.name,
        phone: updatedUser.phone || '',
        birthDate: updatedUser.birthDate || '',
        notes: updatedUser.notes || '',
        job: updatedUser.job || 'خادم',
        area: updatedUser.area || '',
        avatarUrl: updatedUser.avatarUrl || ''
      });
      await syncUserLoginAliases({
        authEmail: canonicalAuthEmail,
        username: updatedUser.username,
        phone: updatedUser.phone || '',
        oldUsername: curr.username,
        oldPhone: curr.phone
      });
    } catch (err) {
      console.warn('Failed to update personal profile in Firestore:', err);
      throw err;
    }
  };

  const getNextStageForStage = (currentStage: string, availableStages: StageItem[]): string => {
    const stageMap: Record<string, string> = {
      'حضانة': 'ابتدائي (أولى وثانية)',
      'ابتدائي (أولى وثانية)': 'ابتدائي (ثالثة ورابعة)',
      'ابتدائي (ثالثة ورابعة)': 'ابتدائي (خامسة وسادسة)',
      'ابتدائي (خامسة وسادسة)': 'إعدادي',
      'إعدادي': 'ثانوي',
      'ثانوي': 'شباب وخريجين'
    };
    if (stageMap[currentStage]) return stageMap[currentStage];

    const nonGeneral = availableStages.filter(s => s.name !== 'عامة').map(s => s.name);
    const idx = nonGeneral.indexOf(currentStage);
    if (idx >= 0 && idx < nonGeneral.length - 1) return nonGeneral[idx + 1];
    if (idx === nonGeneral.length - 1) return 'شباب وخريجين';
    return currentStage;
  };

  // Promote All Makhdomeen Using Live Refs (No stale closure)
  const promoteAllStages = () => {
    const liveChildren = childrenRef.current;
    const liveStages = stagesListRef.current;

    let promoted = 0;
    let graduated = 0;
    const details: Record<string, number> = {};
    const stageUpdates: { id: string; stage: string; stageId?: string }[] = [];

    const nextChildren = liveChildren.map(child => {
      const nextStage = getNextStageForStage(child.stage, liveStages);
      if (nextStage !== child.stage) {
        if (nextStage === 'شباب وخريجين') graduated++;
        else promoted++;

        const transitionKey = `${child.stage} ⬅️ ${nextStage}`;
        details[transitionKey] = (details[transitionKey] || 0) + 1;
        const stgItem = resolveStageItem(nextStage, liveStages);
        stageUpdates.push({ id: child.id, stage: nextStage, stageId: stgItem?.id });

        return {
          ...child,
          stage: nextStage,
          stageId: stgItem?.id || child.stageId,
          age: calculateDynamicAge(child.birthDate, (child.age || 0) + 1)
        };
      }
      return {
        ...child,
        age: calculateDynamicAge(child.birthDate, child.age)
      };
    });

    setChildren(nextChildren);

    if (stageUpdates.length > 0) {
      batchUpdateMakhdomeenStagesInFirestore(stageUpdates).catch(err => {
        console.warn('Failed to update promoted stages in Firestore:', err);
      });
    }

    return { promotedCount: promoted, graduationCount: graduated, details };
  };

  const resetFilters = () => setFilters(defaultFilters);

  const dynamicChildren = useMemo(
    () =>
      children.map(c => ({
        ...c,
        age: calculateDynamicAge(c.birthDate, c.age)
      })),
    [children]
  );

  return (
    <AppContext.Provider
      value={{
        role: effectiveRole,
        effectiveRole,
        setRole,
        activeTab,
        setActiveTab,
        activeStageId,
        activeStageName,
        activeRoleInStage,
        setActiveStageContext,
        stagesList,
        addStage,
        updateStage,
        deleteStage,
        currentUser,
        users,
        pendingRegistrations,
        isRootInitialized,
        initializeRootAdmin,
        login,
        registerServant,
        approvePendingRegistration,
        rejectPendingRegistration,
        logout,
        changePassword,
        createUser,
        updateUser,
        deleteUser,
        resetUserTempPassword,
        clearAllNonAdminUsers,
        clearAllMakhdomeen,
        notifications,
        addNotification,
        deleteNotification,
        seasonalEvents,
        addSeasonalEvent,
        updateSeasonalEvent,
        deleteSeasonalEvent,
        selectedStageScope,
        setSelectedStageScope,
        children: dynamicChildren,
        servants,
        supervisors,
        books,
        attendance,
        addChild,
        batchAddChildren,
        updateChild,
        deleteChild,
        addServant,
        updateServant,
        deleteServant,
        addSupervisor,
        updateSupervisor,
        deleteSupervisor,
        addBook,
        updateBook,
        deleteBook,
        markAttendance,
        markAllAttendance,
        getAttendanceRecord,
        clearAllDatabase,
        unassignAllServantsFromClasses,
        moveServantsToGeneralDock,
        assignServantRole,
        updatePersonalProfile,
        promoteAllStages,
        exportDatabaseJSON,
        importDatabaseJSON,
        filters,
        setFilters,
        resetFilters,
        theme,
        toggleTheme,
        setTheme
      }}
    >
      {childrenProps}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
