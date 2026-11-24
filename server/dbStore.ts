import fs from 'node:fs/promises';
import path from 'node:path';

export interface StoredUser {
  id: string;
  username: string;
  name: string;
  role: 'amin_khedma_am' | 'amin_fasl' | 'khadem';
  assignedStage: string;
  phone?: string;
  passwordHash: string;
  isTempPassword?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface StoredStudent {
  id: string;
  name: string;
  stage: string;
  age?: number;
  birthDate?: string;
  birthMonth?: number;
  area?: string;
  phone?: string;
  parentName?: string;
  parentRelation?: string;
  parentPhone?: string;
  parentJob?: string;
  parent2Name?: string;
  parent2Relation?: string;
  parent2Phone?: string;
  parent2Job?: string;
  notes?: string;
  gender?: 'boy' | 'girl';
  photo?: string;
  createdAt?: string;
  [key: string]: unknown;
}

export interface StoredAppState {
  users: StoredUser[];
  students: StoredStudent[];
  servants: Record<string, unknown>[];
  supervisors: Record<string, unknown>[];
  books: Record<string, unknown>[];
  attendance: Record<string, unknown>[];
  notifications: Record<string, unknown>[];
  stagesList: Record<string, unknown>[];
  updatedAt: string;
}

const DEFAULT_STATE: StoredAppState = {
  users: [],
  students: [],
  servants: [],
  supervisors: [],
  books: [],
  attendance: [],
  notifications: [],
  stagesList: [],
  updatedAt: new Date(0).toISOString(),
};

function getStoreFilePath(): string {
  if (process.env.VERCEL) {
    return '/tmp/el-kedma-store.json';
  }
  return path.resolve(process.cwd(), '.data', 'el-kedma-store.json');
}

let memoryCache: StoredAppState | null = null;

export async function readStore(): Promise<StoredAppState> {
  const filePath = getStoreFilePath();
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<StoredAppState>;
    const state: StoredAppState = {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      students: Array.isArray(parsed.students) ? parsed.students : [],
      servants: Array.isArray(parsed.servants) ? parsed.servants : [],
      supervisors: Array.isArray(parsed.supervisors) ? parsed.supervisors : [],
      books: Array.isArray(parsed.books) ? parsed.books : [],
      attendance: Array.isArray(parsed.attendance) ? parsed.attendance : [],
      notifications: Array.isArray(parsed.notifications) ? parsed.notifications : [],
      stagesList: Array.isArray(parsed.stagesList) ? parsed.stagesList : [],
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
    };
    memoryCache = state;
    return state;
  } catch {
    if (memoryCache) return memoryCache;
    return { ...DEFAULT_STATE };
  }
}

export async function writeStore(nextState: StoredAppState): Promise<StoredAppState> {
  const filePath = getStoreFilePath();
  const payload: StoredAppState = {
    ...nextState,
    updatedAt: new Date().toISOString(),
  };
  memoryCache = payload;

  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf-8');
  } catch (err) {
    console.warn('dbStore write warning:', err instanceof Error ? err.message : String(err));
  }
  return payload;
}

export async function hasAdminUser(): Promise<boolean> {
  const state = await readStore();
  return state.users.some((u) => u.role === 'amin_khedma_am');
}

export async function findUserByIdentifier(identifier: string): Promise<StoredUser | undefined> {
  const clean = identifier.trim().toLowerCase();
  if (!clean) return undefined;
  const state = await readStore();
  return state.users.find(
    (u) =>
      u.username.toLowerCase() === clean ||
      u.id.toLowerCase() === clean ||
      (u.phone && u.phone.trim() === identifier.trim())
  );
}

export async function getStudents(): Promise<StoredStudent[]> {
  const state = await readStore();
  return state.students;
}

export async function saveStudents(students: StoredStudent[]): Promise<StoredStudent[]> {
  const state = await readStore();
  const updated = await writeStore({
    ...state,
    students,
  });
  return updated.students;
}
