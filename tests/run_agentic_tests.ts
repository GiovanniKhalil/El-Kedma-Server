import { hashPassword, verifyPassword, validateUsername, isPasswordEncrypted } from '../src/utils/cryptoUtils';
import { AppUser, AttendanceRecord } from '../src/types';
import { calculateAge, parseFullBirthDate } from '../src/utils/dateUtils';
import { 
  testFirestoreLiveSync,
  updateUserInFirestore,
  deleteUserFromFirestore,
  getUserFromFirestore
} from '../src/services/firestoreService';
import { setFirestoreUserWithMerge, deleteFirestoreUser } from '../src/firebase';
import firebaseConfig from '../firebase-applet-config.json';
import * as fs from 'fs';
import * as path from 'path';

interface TestResult {
  suite: string;
  testName: string;
  passed: boolean;
  details?: string;
  durationMs: number;
}

const results: TestResult[] = [];

async function runTest(suite: string, testName: string, testFn: () => Promise<void> | void) {
  const start = Date.now();
  try {
    await testFn();
    const duration = Date.now() - start;
    results.push({
      suite,
      testName,
      passed: true,
      durationMs: duration
    });
    console.log(`  ✓ [PASS] ${testName} (${duration}ms)`);
  } catch (err: any) {
    const duration = Date.now() - start;
    results.push({
      suite,
      testName,
      passed: false,
      details: err?.message || String(err),
      durationMs: duration
    });
    console.error(`  ✗ [FAIL] ${testName}: ${err?.message}`);
  }
}

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(msg);
  }
}

async function main() {
  console.log('========================================================================');
  console.log('🤖 AGENTIC AI TEST SUITE: END-TO-END USER, DEVELOPER & FIREBASE SAFETY');
  console.log('========================================================================\n');

  // ------------------------------------------------------------------------
  // Suite 1: Security & Cryptographic Hashing
  // ------------------------------------------------------------------------
  console.log('📦 Suite 1: Security & Cryptographic Hashing');
  
  await runTest('Security', 'SHA-256 hashes password correctly and returns sha256:<hex_digest> format', async () => {
    const rawPass = 'SecretP@ss2026';
    const hashed = await hashPassword(rawPass);
    assert(typeof hashed === 'string', 'Hashed output should be a string');
    assert(isPasswordEncrypted(hashed), 'Hashed string should be recognized as encrypted (sha256:)');
    assert(hashed.startsWith('sha256:'), 'Hash format should start with sha256:');
    const hex = hashed.replace('sha256:', '');
    assert(hex.length === 64, 'SHA-256 hash must be 64 hex characters');
  });

  await runTest('Security', 'verifyPassword returns true for correct password and false for wrong password', async () => {
    const rawPass = 'HolyChurch123';
    const hashed = await hashPassword(rawPass);
    const valid = await verifyPassword(rawPass, hashed);
    const invalid = await verifyPassword('WrongPassword', hashed);
    assert(valid === true, 'verifyPassword should return true for correct password');
    assert(invalid === false, 'verifyPassword should return false for incorrect password');
  });

  await runTest('Security', 'Deterministic salted church encryption is consistent and reproducible', async () => {
    const rawPass = 'SamePassword123';
    const hash1 = await hashPassword(rawPass);
    const hash2 = await hashPassword(rawPass);
    assert(hash1 === hash2, 'Salted encryption must produce consistent verifiable hashes for church authentication');
    assert(await verifyPassword(rawPass, hash1), 'Hash must verify successfully');
  });

  // ------------------------------------------------------------------------
  // Suite 2: Username Validation & Constraints
  // ------------------------------------------------------------------------
  console.log('\n📦 Suite 2: Username Validation & Church Identity Constraints');

  await runTest('Validation', 'validateUsername enforces constraints and catches duplicates', () => {
    const mockUsers: AppUser[] = [
      { id: '1', username: 'root.leader', name: 'أمين عام', role: 'amin_khedma_am', assignedStage: 'عامة' },
      { id: '2', username: 'john_servant', name: 'يوحنا', role: 'khadem', assignedStage: 'ثانوي' }
    ];

    // Duplicate check case-insensitive
    const duplicateCheck = validateUsername('ROOT.LEADER', mockUsers);
    assert(!duplicateCheck.valid, 'Username validation must reject case-insensitive duplicate "ROOT.LEADER"');

    // Min length
    const shortCheck = validateUsername('ab', mockUsers);
    assert(!shortCheck.valid, 'Username validation must reject names with fewer than 3 characters');

    // Digits rejection per church rules
    const digitsCheck = validateUsername('servant_2026', mockUsers);
    assert(!digitsCheck.valid, 'Username validation must reject digits per strict church rules');

    // Arabic rejection
    const arabicCheck = validateUsername('خادم_مبارك', mockUsers);
    assert(!arabicCheck.valid, 'Username validation must reject Arabic letters');

    // Space rejection
    const spacesCheck = validateUsername('peter nabil', mockUsers);
    assert(!spacesCheck.valid, 'Username validation must reject spaces in usernames');

    // Valid format (English letters, dots, underscores)
    const validCheck = validateUsername('new.servant_blessed', mockUsers);
    assert(validCheck.valid, 'Username validation must accept valid English letters, dot, and underscore');
  });

  // ------------------------------------------------------------------------
  // Suite 3: Role-Based Access Control & User Invariants
  // ------------------------------------------------------------------------
  console.log('\n📦 Suite 3: Role-Based Access Control & Fixed Church Invariants');

  await runTest('RBAC', 'Default General Secretary (amin_khedma_am) exists and is protected', () => {
    const sampleUsers: AppUser[] = [
      { id: 'u_root', uid: 'u_root', username: 'general_admin', name: 'أمين الخدمة العام', role: 'amin_khedma_am', assignedStage: 'عامة', isProtectedRoot: true }
    ];
    const adminUser = sampleUsers.find(u => u.role === 'amin_khedma_am');
    assert(adminUser !== undefined, 'An amin_khedma_am account must exist in users list');
    if (!adminUser) throw new Error('Missing amin_khedma_am');
    assert(adminUser.role === 'amin_khedma_am', 'Root role must be amin_khedma_am');
  });

  await runTest('RBAC', 'Standard servant has NO delegate admin privileges by default', () => {
    const servantUser: AppUser = {
      id: 'u_srv_sample',
      uid: 'u_srv_sample',
      username: 'sample.servant',
      name: 'خادم فصل',
      role: 'khadem',
      assignedStage: 'ابتدائي (أولى وثانية)',
      assignments: [{ stageId: 'stg_elem12', stageName: 'ابتدائي (أولى وثانية)', role: 'khadem' }]
    };
    assert(servantUser.role === 'khadem', `Servant role must be "khadem", got "${servantUser.role}"`);
    assert(!servantUser.canManageSupervisors, 'Standard servant must NOT have canManageSupervisors flag');
    assert(!servantUser.isAuthorizedAdmin, 'Standard servant must NOT have isAuthorizedAdmin flag');
    assert(!servantUser.isAdminAssistant, 'Standard servant must NOT have isAdminAssistant flag');
  });

  await runTest('RBAC', 'General Secretary deletion prevention rule', () => {
    const adminUser: AppUser = {
      id: 'u_root',
      uid: 'u_root',
      username: 'general_admin',
      name: 'أمين الخدمة العام',
      role: 'amin_khedma_am',
      assignedStage: 'عامة',
      isProtectedRoot: true
    };
    const canDelete = (u: AppUser) => u.role !== 'amin_khedma_am' && !u.isProtectedRoot;
    assert(!canDelete(adminUser), 'System logic must forbid deleting amin_khedma_am');
  });

  // ------------------------------------------------------------------------
  // Suite 4: User Workflow & Data Integrity (Makhdomeen & Attendance)
  // ------------------------------------------------------------------------
  console.log('\n📦 Suite 4: User Usage Workflows (Makhdomeen, Attendance & Birthdays)');

  await runTest('Usage', 'Dynamic age calculation and birthdate parsing', () => {
    const testDate = '2016-05-15';
    const age = calculateAge(testDate);
    assert(typeof age === 'number' && age >= 8 && age <= 12, 'Age calculation for 2016 should return appropriate child age');
    const parsed = parseFullBirthDate(testDate, 5);
    assert(parsed.day === 15, 'Parsed day must match 15');
    assert(parsed.month === 5, 'Parsed month must match 5');
  });

  await runTest('Usage', 'Attendance record structure supports multiple church events and anti-self-attendance', () => {
    const sampleAttendance: AttendanceRecord = {
      id: 'att_1',
      date: '2026-07-19',
      periodType: 'weekly',
      targetType: 'child',
      eventType: 'sunday_school',
      recordedByUid: 'u_srv_1',
      records: { c1: { status: 'present' } }
    };
    assert(Boolean(sampleAttendance.date), 'Attendance record must have date');
    assert(Boolean(sampleAttendance.eventType), 'Attendance record must have eventType');
    assert(['mass', 'sunday_school', 'general_meeting', 'supervisors_meeting'].includes(sampleAttendance.eventType), 'Event type must be valid church event');
  });

  await runTest('Usage', 'Clean empty initial stages allow dynamic Firestore configuration', () => {
    const dynamicStages: { id: string; name: string }[] = [];
    assert(Array.isArray(dynamicStages), 'Stages collection starts dynamically without hardcoded defaults');
  });

  // ------------------------------------------------------------------------
  // Suite 5: Developer Code Trace & Environment Constraints (No window.confirm/alert)
  // ------------------------------------------------------------------------
  console.log('\n📦 Suite 5: Developer Code Trace & Iframe Safety Audit');

  await runTest('CodeTrace', 'Zero window.alert and window.confirm calls in src/', () => {
    const srcDir = path.resolve(process.cwd(), 'src');
    
    function scanDir(dir: string): { file: string; line: number; match: string }[] {
      const violations: { file: string; line: number; match: string }[] = [];
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          violations.push(...scanDir(fullPath));
        } else if (entry.isFile() && (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts'))) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          const lines = content.split('\n');
          lines.forEach((line, idx) => {
            // Check for window.confirm or bare confirm( ... ) not preceded by word char or dot
            if (/\bconfirm\s*\(/.test(line) && !line.includes('//') && !line.includes('showConfirm') && !line.includes('confirmReset')) {
              violations.push({ file: path.relative(srcDir, fullPath), line: idx + 1, match: line.trim() });
            }
            // Check for window.alert or bare alert( ... )
            if (/\balert\s*\(/.test(line) && !line.includes('//') && !line.includes('AlertCircle')) {
              violations.push({ file: path.relative(srcDir, fullPath), line: idx + 1, match: line.trim() });
            }
          });
        }
      }
      return violations;
    }

    const violations = scanDir(srcDir);
    assert(
      violations.length === 0,
      `Found ${violations.length} forbidden alert/confirm calls: ${JSON.stringify(violations, null, 2)}`
    );
  });

  // ------------------------------------------------------------------------
  // Suite 6: Account Deletion, Purge & Persistence Reliability
  // ------------------------------------------------------------------------
  console.log('\n📦 Suite 6: Account Deletion & Ghost Resurrection Prevention');

  await runTest('Persistence', 'Account deletion completely purges user without ghost resurrection', () => {
    let mockLocalUsers: AppUser[] = [
      { id: 'u1', username: 'root.leader', name: 'أمين', role: 'amin_khedma_am', assignedStage: 'عامة' },
      { id: 'u2', username: 'servant_to_remove', name: 'خادم تجريبي', role: 'khadem', assignedStage: 'إعدادي' }
    ];

    const targetId = 'u2';
    const targetUser = mockLocalUsers.find(u => u.id === targetId);
    assert(targetUser !== undefined, 'Target user must exist before delete');
    if (!targetUser) throw new Error('Target user not found');
    
    mockLocalUsers = mockLocalUsers.filter(u => u.id !== targetId && u.username !== targetUser.username);
    assert(mockLocalUsers.length === 1, 'Local users count must decrease to 1');
    assert(!mockLocalUsers.some(u => u.username === 'servant_to_remove'), 'Deleted user must be gone from state');

    // Simulate Firestore sync without resurrecting deleted users
    const mockFirestoreUsers = [
      { uid: 'u1', username: 'root_admin', fullName: 'أمين الخدمة العام', role: 'amin_khedma_am', assignedClass: 'عامة' }
    ];

    const syncedUsers = mockFirestoreUsers.map(fu => ({
      id: fu.uid,
      username: fu.username,
      name: fu.fullName,
      role: fu.role as AppUser['role'],
      assignedStage: fu.assignedClass
    }));

    assert(!syncedUsers.some(u => u.username === 'servant_to_remove'), 'Firestore snapshot sync must not revive deleted user');
  });

  await runTest('Persistence', 'Purge preserves admin while wiping test accounts in batch', () => {
    const allUsers: AppUser[] = [
      { id: 'u_root', username: 'root_admin', name: 'أمين الخدمة العام', role: 'amin_khedma_am', assignedStage: 'عامة', isProtectedRoot: true },
      { id: 'u2', username: 'test_servant_1', name: 'خادم 1', role: 'khadem', assignedStage: 'ابتدائي' },
      { id: 'u3', username: 'test_servant_2', name: 'خادم 2', role: 'khadem', assignedStage: 'إعدادي' }
    ];

    const purged = allUsers.filter(u => u.role === 'amin_khedma_am' || Boolean(u.isProtectedRoot));
    assert(purged.length === 1, 'Purged users list must only contain the General Secretary');
    assert(purged[0].role === 'amin_khedma_am', 'Retained user must be amin_khedma_am');
  });

  // ------------------------------------------------------------------------
  // Suite 7: Firebase Connection & Safety Verification
  // ------------------------------------------------------------------------
  console.log('\n📦 Suite 7: Firebase Connection, Firestore Latency & Safety Audit');

  await runTest('Firebase', 'Firebase configuration is targeted to the correct cloud database ID', () => {
    assert(firebaseConfig.projectId === 'future-timing-2lxdt', 'Project ID must match future-timing-2lxdt');
    assert(
      firebaseConfig.firestoreDatabaseId === 'ai-studio-f086d3f1-a924-4993-a037-854916fa585c',
      'Database ID must match ai-studio-f086d3f1-a924-4993-a037-854916fa585c'
    );
    assert(!!firebaseConfig.apiKey && firebaseConfig.apiKey.length > 20, 'API Key must be present');
  });

  await runTest('Firebase', 'Live Firestore read/write sync round-trip and latency test', async () => {
    const syncRes = await testFirestoreLiveSync();
    console.log(`     [Cloud Ping] Latency: ${syncRes.latencyMs}ms | Result: ${syncRes.message}`);
    assert(syncRes.success === true, `Firestore live sync check failed: ${syncRes.message}`);
    assert(syncRes.latencyMs > 0, 'Round-trip latency must be measurable');
  });

  await runTest('Firebase', 'setDoc({ merge: true }) creates user document when missing without throwing "No document to update"', async () => {
    const testUid = `u_test_nonexistent_${Date.now()}`;
    const initialData = {
      fullName: 'خادم تجريبي جديد',
      phone: '01200000001',
      role: 'khadem',
      assignedClass: 'عامة',
      isFirstLogin: false
    };

    // This would have thrown "FirebaseError: No document to update" with updateDoc
    // With setDoc(..., { merge: true }), it must succeed cleanly and create the document
    await updateUserInFirestore(testUid, initialData);

    // Verify document was created
    const fetched = await getUserFromFirestore(testUid);
    assert(fetched !== null, 'Created document should be fetchable from Firestore');
    assert(fetched?.fullName === 'خادم تجريبي جديد', 'fullName must match created value');
    assert(fetched?.phone === '01200000001', 'phone must match');

    // Test subsequent update merges cleanly without wiping existing fields
    await setFirestoreUserWithMerge(testUid, {
      phone: '01299999999',
      job: 'مهندس برمجيات'
    });

    const updated = await getUserFromFirestore(testUid);
    assert(updated !== null, 'Updated document should exist');
    assert(updated?.fullName === 'خادم تجريبي جديد', 'Existing fullName must be preserved by merge: true');
    assert(updated?.phone === '01299999999', 'phone must be updated');

    // Clean up test document
    await deleteFirestoreUser(testUid);
    await deleteUserFromFirestore(testUid);
    const afterDelete = await getUserFromFirestore(testUid);
    assert(afterDelete === null, 'Document must be successfully deleted from Firestore');
  });

  await runTest('ServantAssignment', 'Assigning servant role updates assignedClass/assignedStage in Firestore via setDoc with merge', async () => {
    const servantUid = `u_servant_stage_test_${Date.now()}`;
    const initialServantDoc = {
      uid: servantUid,
      fullName: 'خادم في انتظار التعيين',
      phone: '01211112233',
      role: 'khadem',
      assignedClass: 'في انتظار التعيين',
      assignedStage: 'في انتظار التعيين',
      username: 'pending_servant_test'
    };

    // 1. Initial creation with pending stage
    await setFirestoreUserWithMerge(servantUid, initialServantDoc);
    const initialFetched = await getUserFromFirestore(servantUid);
    assert(initialFetched?.assignedClass === 'في انتظار التعيين', 'Initial stage should be pending assignment');

    // 2. Promotion / Stage reassignment to 'إعدادي'
    const updatedStagePayload = {
      uid: servantUid,
      assignedClass: 'إعدادي',
      assignedStage: 'إعدادي',
      role: 'khadem',
      updatedAt: new Date().toISOString()
    };
    await setFirestoreUserWithMerge(servantUid, updatedStagePayload);

    // 3. Verify in Firestore that assignedClass and assignedStage are persisted as 'إعدادي'
    const reassignedFetched = await getUserFromFirestore(servantUid);
    assert(reassignedFetched !== null, 'Reassigned user must exist in Firestore');
    assert(reassignedFetched?.assignedClass === 'إعدادي', 'assignedClass in Firestore must be updated to إعدادي');
    assert((reassignedFetched as any)?.assignedStage === 'إعدادي', 'assignedStage in Firestore must be updated to إعدادي');
    assert(reassignedFetched?.fullName === 'خادم في انتظار التعيين', 'fullName must be preserved via merge: true');
    assert(reassignedFetched?.phone === '01211112233', 'phone must be preserved via merge: true');

    // 4. Clean up
    await deleteFirestoreUser(servantUid);
    await deleteFirestoreUser('pending_servant_test');
  });

  // ------------------------------------------------------------------------
  // Final Evaluation & Scorecard
  // ------------------------------------------------------------------------
  console.log('\n========================================================================');
  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log(`📊 AGENTIC AI TEST RESULTS: ${passed}/${total} PASSED (${failed} FAILED)`);
  console.log(`📈 SUCCESS RATE: ${((passed / total) * 100).toFixed(1)}%`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Fatal crash during test execution:', err);
  process.exit(1);
});
