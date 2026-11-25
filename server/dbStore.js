import fs from "node:fs/promises";
import path from "node:path";
const DEFAULT_STATE = {
  users: [],
  students: [],
  servants: [],
  supervisors: [],
  books: [],
  attendance: [],
  notifications: [],
  stagesList: [],
  updatedAt: (/* @__PURE__ */ new Date(0)).toISOString()
};
function getStoreFilePath() {
  if (process.env.VERCEL) {
    return "/tmp/el-kedma-store.json";
  }
  return path.resolve(process.cwd(), ".data", "el-kedma-store.json");
}
let memoryCache = null;
async function readStore() {
  const filePath = getStoreFilePath();
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    const state = {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      students: Array.isArray(parsed.students) ? parsed.students : [],
      servants: Array.isArray(parsed.servants) ? parsed.servants : [],
      supervisors: Array.isArray(parsed.supervisors) ? parsed.supervisors : [],
      books: Array.isArray(parsed.books) ? parsed.books : [],
      attendance: Array.isArray(parsed.attendance) ? parsed.attendance : [],
      notifications: Array.isArray(parsed.notifications) ? parsed.notifications : [],
      stagesList: Array.isArray(parsed.stagesList) ? parsed.stagesList : [],
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : (/* @__PURE__ */ new Date()).toISOString()
    };
    memoryCache = state;
    return state;
  } catch {
    if (memoryCache) return memoryCache;
    return { ...DEFAULT_STATE };
  }
}
async function writeStore(nextState) {
  const filePath = getStoreFilePath();
  const payload = {
    ...nextState,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  memoryCache = payload;
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(payload, null, 2), "utf-8");
  } catch (err) {
    console.warn("dbStore write warning:", err instanceof Error ? err.message : String(err));
  }
  return payload;
}
async function hasAdminUser() {
  const state = await readStore();
  return state.users.some((u) => u.role === "amin_khedma_am");
}
async function findUserByIdentifier(identifier) {
  const clean = identifier.trim().toLowerCase();
  if (!clean) return void 0;
  const state = await readStore();
  return state.users.find(
    (u) => u.username.toLowerCase() === clean || u.id.toLowerCase() === clean || u.phone && u.phone.trim() === identifier.trim()
  );
}
async function getStudents() {
  const state = await readStore();
  return state.students;
}
async function saveStudents(students) {
  const state = await readStore();
  const updated = await writeStore({
    ...state,
    students
  });
  return updated.students;
}
export {
  findUserByIdentifier,
  getStudents,
  hasAdminUser,
  readStore,
  saveStudents,
  writeStore
};
