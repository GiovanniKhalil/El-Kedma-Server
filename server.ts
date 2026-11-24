import 'dotenv/config';
import crypto from 'node:crypto';
import path from 'node:path';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import {
  readStore,
  writeStore,
  hasAdminUser,
  findUserByIdentifier,
  getStudents,
  saveStudents,
} from './server/dbStore.js';
import type {
  StoredUser,
  StoredStudent,
} from './server/dbStore.js';

export interface SessionPayload {
  userId: string;
  username: string;
  role: 'amin_khedma_am' | 'amin_fasl' | 'khadem';
  exp: number;
}

interface AuthenticatedRequest extends Request {
  session?: SessionPayload;
}

const RUNTIME_FALLBACK_SECRET = crypto.randomBytes(32).toString('hex');

function getSessionSecret(): string {
  const envSecret = process.env.SESSION_SECRET?.trim();
  return envSecret && envSecret.length >= 16 ? envSecret : RUNTIME_FALLBACK_SECRET;
}

function hashServerPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

function verifyServerPassword(password: string, storedHash: string): boolean {
  if (!password || !storedHash) return false;

  if (storedHash.startsWith('scrypt:')) {
    const parts = storedHash.split(':');
    if (parts.length !== 3) return false;
    const [, salt, hex] = parts;
    const derived = crypto.scryptSync(password, salt, 64);
    const expected = Buffer.from(hex, 'hex');
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  }

  if (storedHash.startsWith('sha256:')) {
    const salt = 'st_john_church_el_mearag_2026';
    const digest = crypto.createHash('sha256').update(`${password}:${salt}`).digest('hex');
    const actual = Buffer.from(digest, 'hex');
    const expectedHex = storedHash.slice('sha256:'.length);
    if (!/^[0-9a-f]{64}$/i.test(expectedHex)) return false;
    const expected = Buffer.from(expectedHex, 'hex');
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  }

  return false;
}

function signSessionToken(payload: SessionPayload): string {
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encodedPayload)
    .digest('base64url');
  return `${encodedPayload}.${sig}`;
}

function verifySessionToken(token: string): SessionPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encodedPayload, signature] = parts;
  if (!encodedPayload || !signature) return null;

  const expectedSig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encodedPayload)
    .digest('base64url');

  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf-8')
    ) as SessionPayload;
    if (
      !parsed ||
      typeof parsed.userId !== 'string' ||
      typeof parsed.username !== 'string' ||
      typeof parsed.role !== 'string' ||
      typeof parsed.exp !== 'number'
    ) {
      return null;
    }
    if (Date.now() > parsed.exp) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.slice(7).trim() || null;
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);
  if (!token) {
    res.status(401).json({ ok: false, error: 'Unauthorized: missing session token' });
    return;
  }
  const session = verifySessionToken(token);
  if (!session) {
    res.status(401).json({ ok: false, error: 'Unauthorized: invalid or expired session token' });
    return;
  }
  req.session = session;
  next();
}

function sanitizeUser(user: StoredUser) {
  const { passwordHash: _ignored, ...safe } = user;
  return safe;
}

export function createApp(): express.Application {
  const app = express();
  app.use(express.json({ limit: '4mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/auth/bootstrap-status', async (_req: Request, res: Response) => {
    try {
      const initialized = await hasAdminUser();
      res.json({
        ok: true,
        initialized,
        needsBootstrap: !initialized,
      });
    } catch {
      res.status(500).json({ ok: false, error: 'Failed to inspect bootstrap status' });
    }
  });

  app.post('/api/auth/bootstrap', async (req: Request, res: Response) => {
    try {
      const alreadyInitialized = await hasAdminUser();
      if (alreadyInitialized) {
        res.status(409).json({ ok: false, error: 'System already initialized' });
        return;
      }

      const body = req.body as {
        username?: unknown;
        name?: unknown;
        password?: unknown;
        phone?: unknown;
      };

      const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      const password = typeof body.password === 'string' ? body.password.trim() : '';
      const phone = typeof body.phone === 'string' ? body.phone.trim() : '';

      if (!username || !/^[a-zA-Z._]{3,30}$/.test(username)) {
        res.status(400).json({ ok: false, error: 'Invalid username format' });
        return;
      }
      if (!name) {
        res.status(400).json({ ok: false, error: 'Name is required' });
        return;
      }
      if (password.length < 6) {
        res.status(400).json({ ok: false, error: 'Password must be at least 6 characters' });
        return;
      }

      const store = await readStore();
      const adminUser: StoredUser = {
        id: `u_${crypto.randomUUID()}`,
        username,
        name,
        role: 'amin_khedma_am',
        assignedStage: 'عامة',
        phone,
        passwordHash: hashServerPassword(password),
        isTempPassword: false,
        createdAt: new Date().toISOString().split('T')[0],
      };

      await writeStore({
        ...store,
        users: [...store.users, adminUser],
      });

      const exp = Date.now() + 7 * 24 * 60 * 60 * 1000;
      const token = signSessionToken({
        userId: adminUser.id,
        username: adminUser.username,
        role: adminUser.role,
        exp,
      });

      res.status(201).json({
        ok: true,
        token,
        user: sanitizeUser(adminUser),
      });
    } catch {
      res.status(500).json({ ok: false, error: 'Bootstrap failed' });
    }
  });

  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const body = req.body as { identifier?: unknown; username?: unknown; password?: unknown };
      const identifier =
        typeof body.identifier === 'string'
          ? body.identifier.trim()
          : typeof body.username === 'string'
            ? body.username.trim()
            : '';
      const password = typeof body.password === 'string' ? body.password.trim() : '';

      if (!identifier || !password) {
        res.status(400).json({ ok: false, error: 'Username and password are required' });
        return;
      }

      const user = await findUserByIdentifier(identifier);
      if (!user || !verifyServerPassword(password, user.passwordHash)) {
        res.status(401).json({ ok: false, error: 'Invalid credentials' });
        return;
      }

      const exp = Date.now() + 7 * 24 * 60 * 60 * 1000;
      const token = signSessionToken({
        userId: user.id,
        username: user.username,
        role: user.role,
        exp,
      });

      res.json({
        ok: true,
        token,
        user: sanitizeUser(user),
      });
    } catch {
      res.status(500).json({ ok: false, error: 'Login failed' });
    }
  });

  app.get('/api/auth/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const user = await findUserByIdentifier(req.session!.userId);
    if (!user) {
      res.json({
        ok: true,
        session: req.session,
      });
      return;
    }
    res.json({
      ok: true,
      user: sanitizeUser(user),
    });
  });

  app.get('/api/students', requireAuth, async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const students = await getStudents();
      res.json({ ok: true, students });
    } catch {
      res.status(500).json({ ok: false, error: 'Failed to load students' });
    }
  });

  app.post('/api/students', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const body = req.body as { students?: unknown; student?: unknown };
      if (Array.isArray(body.students)) {
        const saved = await saveStudents(body.students as StoredStudent[]);
        res.json({ ok: true, students: saved });
        return;
      }
      if (body.student && typeof body.student === 'object') {
        const candidate = body.student as StoredStudent;
        if (!candidate.name || typeof candidate.name !== 'string') {
          res.status(400).json({ ok: false, error: 'Student name is required' });
          return;
        }
        const current = await getStudents();
        const studentRecord: StoredStudent = {
          ...candidate,
          id: candidate.id || `c_${crypto.randomUUID()}`,
          stage: typeof candidate.stage === 'string' && candidate.stage ? candidate.stage : 'عامة',
        };
        const existingIdx = current.findIndex((s) => s.id === studentRecord.id);
        const nextList =
          existingIdx >= 0
            ? current.map((s, idx) => (idx === existingIdx ? studentRecord : s))
            : [...current, studentRecord];
        const saved = await saveStudents(nextList);
        res.status(201).json({ ok: true, student: studentRecord, students: saved });
        return;
      }

      res.status(400).json({ ok: false, error: 'Expected students array or student object' });
    } catch {
      res.status(500).json({ ok: false, error: 'Failed to save students' });
    }
  });

  app.get('/api/state', requireAuth, async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const state = await readStore();
      res.json({
        ok: true,
        state: {
          students: state.students,
          servants: state.servants,
          supervisors: state.supervisors,
          books: state.books,
          attendance: state.attendance,
          notifications: state.notifications,
          stagesList: state.stagesList,
          users: state.users.map(sanitizeUser),
          updatedAt: state.updatedAt,
        },
      });
    } catch {
      res.status(500).json({ ok: false, error: 'Failed to load state' });
    }
  });

  app.post('/api/state', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const incoming = req.body as Record<string, unknown>;
      const current = await readStore();
      const updated = await writeStore({
        ...current,
        students: Array.isArray(incoming.students) ? (incoming.students as StoredStudent[]) : current.students,
        servants: Array.isArray(incoming.servants) ? (incoming.servants as Record<string, unknown>[]) : current.servants,
        supervisors: Array.isArray(incoming.supervisors)
          ? (incoming.supervisors as Record<string, unknown>[])
          : current.supervisors,
        books: Array.isArray(incoming.books) ? (incoming.books as Record<string, unknown>[]) : current.books,
        attendance: Array.isArray(incoming.attendance)
          ? (incoming.attendance as Record<string, unknown>[])
          : current.attendance,
        notifications: Array.isArray(incoming.notifications)
          ? (incoming.notifications as Record<string, unknown>[])
          : current.notifications,
        stagesList: Array.isArray(incoming.stagesList)
          ? (incoming.stagesList as Record<string, unknown>[])
          : current.stagesList,
      });

      res.json({
        ok: true,
        updatedAt: updated.updatedAt,
      });
    } catch {
      res.status(500).json({ ok: false, error: 'Failed to persist state' });
    }
  });

  return app;
}

async function startLocalServer(): Promise<void> {
  const app = createApp();
  const port = Number(process.env.PORT) || 3000;

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${port}`);
  });
}

if (!process.env.VERCEL) {
  void startLocalServer();
}
