import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Role, Stage, AppUser, ClassAssignment, ClassAssignmentRole, PendingRegistration } from '../types';
import { 
  X, UserPlus, Users, Trash2, ShieldCheck, 
  CheckCircle2, Sparkles, RefreshCw, AlertCircle, Edit3, Crown, Save, ArrowRight,
  Lock, KeyRound, UserCheck, Check, Database, Wifi, Server, Clock, Plus
} from 'lucide-react';
import { getStageBadgeClass } from '../utils/themeColors';
import { validateUsername, verifyPassword } from '../utils/cryptoUtils';
import { testFirestoreLiveSync } from '../services/firestoreService';

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ROLE_ARABIC_MAP: Record<string, string> = {
  amin_khedma_am: 'أمين الخدمة العام',
  amin_fasl: 'أمين فصل',
  mosaed_amin: 'مساعد أمين',
  khadem: 'خادم',
  general_dock: 'خادم عام (خدمة عامة)'
};

export const UserManagementModal: React.FC<UserManagementModalProps> = ({ isOpen, onClose }) => {
  const {
    users,
    pendingRegistrations,
    approvePendingRegistration,
    rejectPendingRegistration,
    createUser,
    updateUser,
    deleteUser,
    resetUserTempPassword,
    currentUser,
    stagesList,
    clearAllNonAdminUsers
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<'list' | 'pending' | 'add' | 'edit'>('list');
  const [showPurgeModal, setShowPurgeModal] = useState(false);
  const [isPurging, setIsPurging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<{
    tested: boolean;
    loading: boolean;
    success?: boolean;
    message?: string;
    latency?: number;
  }>({
    tested: false,
    loading: false
  });

  const defaultStage = stagesList[0]?.name || 'عامة';
  const defaultStageId = stagesList[0]?.id || defaultStage;

  // Editing User State
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [editFormData, setEditFormData] = useState<{
    name: string;
    username: string;
    role: Role;
    assignedStage: Stage;
    assignments: ClassAssignment[];
    phone: string;
    password: string;
    isAdminAssistant: boolean;
    canAssignMakhdomeen: boolean;
  }>({
    name: '',
    username: '',
    role: 'khadem',
    assignedStage: 'عامة',
    assignments: [],
    phone: '',
    password: '',
    isAdminAssistant: false,
    canAssignMakhdomeen: true
  });

  // New User Form State
  const [formData, setFormData] = useState<{
    name: string;
    username: string;
    tempPassword: string;
    role: Role;
    assignedStage: Stage;
    assignments: ClassAssignment[];
    phone: string;
    isAdminAssistant: boolean;
    canAssignMakhdomeen: boolean;
  }>({
    name: '',
    username: '',
    tempPassword: 'temp' + Math.floor(1000 + Math.random() * 9000),
    role: 'khadem',
    assignedStage: defaultStage,
    assignments: [{ stageId: defaultStageId, stageName: defaultStage, role: 'khadem' }],
    phone: '',
    isAdminAssistant: false,
    canAssignMakhdomeen: true
  });

  // Pending Registration review config per request ID
  const [pendingConfig, setPendingConfig] = useState<
    Record<
      string,
      {
        tempPassword: string;
        role: Role;
        assignments: ClassAssignment[];
        loading?: boolean;
      }
    >
  >({});

  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [actionErrorMsg, setActionErrorMsg] = useState<string | null>(null);

  // Security Verification Gate state
  const [showAuthGate, setShowAuthGate] = useState(false);
  const [gateUsername, setGateUsername] = useState('');
  const [gatePassword, setGatePassword] = useState('');
  const [gateError, setGateError] = useState<string | null>(null);
  const [gateLoading, setGateLoading] = useState(false);
  const [gateTitle, setGateTitle] = useState('تأكيد الهوية لأمين الخدمة العام');
  const [gateDescription, setGateDescription] = useState('');
  const [pendingAction, setPendingAction] = useState<(() => Promise<void> | void) | null>(null);

  // In-app account deletion confirmation state
  const [userToDelete, setUserToDelete] = useState<AppUser | null>(null);

  if (!isOpen) return null;

  // Check authorization: General Secretary or Admin Assistant
  const isAuthorizedAdmin = currentUser?.role === 'amin_khedma_am' || Boolean(currentUser?.isAdminAssistant);

  if (!isAuthorizedAdmin) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
        <div className="bg-white dark:bg-[#1a0a12] border border-amber-200/80 dark:border-[#3e1423] rounded-3xl max-w-md w-full p-6 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
          <h3 className="text-lg font-bold text-slate-900 dark:text-stone-100">عفواً، غير مسموح</h3>
          <p className="text-xs text-slate-600 dark:text-stone-400">إدارة حسابات المنظومة وصلاحيات الدخول مقتصرة فقط على أمين الخدمة العام.</p>
          <button onClick={onClose} className="px-5 py-2 bg-burgundy-900 text-amber-50 rounded-xl text-xs font-bold cursor-pointer">إغلاق</button>
        </div>
      </div>
    );
  }

  const pendingOnly = pendingRegistrations.filter(r => r.status === 'pending');

  const resolveAssignmentRowRole = (r: Role): ClassAssignmentRole => {
    if (r === 'amin_fasl' || r === 'mosaed_amin' || r === 'khadem') return r;
    return 'khadem';
  };

  const getHighestAssignmentRole = (list: ClassAssignment[], fallback: Role): Role => {
    if (fallback === 'amin_khedma_am' || fallback === 'general_dock') return fallback;
    if (list.some(a => a.role === 'amin_fasl')) return 'amin_fasl';
    if (list.some(a => a.role === 'mosaed_amin')) return 'mosaed_amin';
    if (list.length > 0) return 'khadem';
    return fallback;
  };

  const startEditing = (u: AppUser) => {
    setActionErrorMsg(null);
    setActionSuccessMsg(null);
    setEditingUser(u);

    const initialAssignments: ClassAssignment[] =
      u.assignments && u.assignments.length > 0
        ? u.assignments.map(a => ({ ...a }))
        : u.role !== 'amin_khedma_am' &&
          u.role !== 'general_dock' &&
          u.assignedStage &&
          u.assignedStage !== 'عامة' &&
          u.assignedStage !== 'في انتظار التعيين'
        ? [
            u.assignedStage,
            ...(u.assignedStages || [])
          ]
            .filter(Boolean)
            .filter((val, idx, arr) => arr.indexOf(val) === idx)
            .map((stgName, idx) => {
              const found = stagesList.find(s => s.name === stgName || s.id === stgName);
              return {
                stageId: found?.id || stgName,
                stageName: found?.name || stgName,
                role: idx === 0 ? resolveAssignmentRowRole(u.role) : 'khadem'
              };
            })
        : [];

    setEditFormData({
      name: u.name,
      username: u.username,
      role: u.role,
      assignedStage: (u.assignedStage || 'عامة') as Stage,
      assignments: initialAssignments,
      phone: u.phone || '',
      password: '',
      isAdminAssistant: Boolean(u.isAdminAssistant),
      canAssignMakhdomeen: u.canAssignMakhdomeen !== undefined ? Boolean(u.canAssignMakhdomeen) : true
    });
    setActiveSubTab('edit');
  };

  const handleTestCloudSync = async () => {
    setCloudSyncStatus({ tested: true, loading: true });
    try {
      const res = await testFirestoreLiveSync();
      setCloudSyncStatus({
        tested: true,
        loading: false,
        success: res.success,
        message: res.message,
        latency: res.latencyMs
      });
    } catch (err: any) {
      setCloudSyncStatus({
        tested: true,
        loading: false,
        success: false,
        message: err.message || 'فشل الاتصال بقاعدة بيانات Firebase'
      });
    }
  };

  const handleVerifyGateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGateError(null);

    const cleanUser = gateUsername.trim();
    const cleanPass = gatePassword.trim();

    if (!cleanUser || !cleanPass) {
      setGateError('يرجى تسجيل اسم المستخدم وكلمة السر الحالية للتأكيد');
      return;
    }

    setGateLoading(true);
    try {
      // Find matching user from current user or users list (strict case-sensitive username ===)
      const isCurrent = cleanUser === (currentUser?.username || '').trim();
      const currentPassValid = isCurrent && await verifyPassword(cleanPass, currentUser?.password);

      // Or check if entered credentials match amin_khedma_am
      const aminUser = users.find(u => u.role === 'amin_khedma_am');
      const isAminUser = cleanUser === (aminUser?.username || '').trim();
      const aminPassValid = isAminUser && await verifyPassword(cleanPass, aminUser?.password);

      if (!currentPassValid && !aminPassValid) {
        setGateError('❌ بيانات الاعتماد غير صحيحة! يرجى إدخال اسم المستخدم وكلمة السر الصحيحة للتأكيد الأمني.');
        setGateLoading(false);
        return;
      }

      // Identity verified! Execute the pending sensitive administrative action
      if (pendingAction) {
        await pendingAction();
      }
      setShowAuthGate(false);
      setPendingAction(null);
      setGateUsername('');
      setGatePassword('');
    } catch (err: any) {
      setGateError(err.message || 'حدث خطأ أثناء التحقق الأمني');
    } finally {
      setGateLoading(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setActionErrorMsg(null);
    setActionSuccessMsg(null);
    if (!editFormData.name.trim() || !editFormData.username.trim()) return;

    // Validate username strictly per requirements
    const usernameVal = validateUsername(editFormData.username.trim(), users, editingUser.id);
    if (!usernameVal.valid) {
      setActionErrorMsg(usernameVal.error || 'اسم المستخدم غير صالح');
      return;
    }

    // Protect General Secretary role: cannot assign another user as amin_khedma_am, and cannot demote the General Secretary
    if (editingUser.role !== 'amin_khedma_am' && editFormData.role === 'amin_khedma_am') {
      setActionErrorMsg('حساب أمين الخدمة العام ثابت ولا يمكن تعيين حساب آخر كأمين عام.');
      return;
    }
    const baseRole: Role = editingUser.role === 'amin_khedma_am' ? 'amin_khedma_am' : editFormData.role;
    const cleanAssignments =
      baseRole === 'amin_khedma_am' || baseRole === 'general_dock' ? [] : editFormData.assignments;
    const finalRole = getHighestAssignmentRole(cleanAssignments, baseRole);
    const primaryStage: Stage =
      finalRole === 'amin_khedma_am' || finalRole === 'general_dock'
        ? 'عامة'
        : cleanAssignments[0]?.stageName || editFormData.assignedStage || 'في انتظار التعيين';

    const updatePayload: Partial<AppUser> = {
      name: editFormData.name.trim(),
      username: editFormData.username.trim(),
      role: finalRole,
      assignedStage: primaryStage,
      assignedStages: cleanAssignments.slice(1).map(a => a.stageName),
      assignments: cleanAssignments,
      phone: editFormData.phone.trim(),
      isAdminAssistant: editingUser.role === 'amin_khedma_am' ? false : editFormData.isAdminAssistant,
      canAssignMakhdomeen:
        editingUser.role === 'amin_khedma_am'
          ? true
          : editFormData.isAdminAssistant
          ? editFormData.canAssignMakhdomeen
          : true
    };

    if (editFormData.password.trim()) {
      updatePayload.password = editFormData.password.trim();
      updatePayload.isTempPassword = false;
    }

    const executeSave = async () => {
      setIsSubmitting(true);
      try {
        const res = await updateUser(editingUser.id, updatePayload);
        if (!res.success) {
          setActionErrorMsg(res.error || 'تعذر تحديث بيانات الحساب.');
          return;
        }
        setActionSuccessMsg(`✅ تم تحديث وتعديل بيانات حساب (${editFormData.name}) بنجاح!`);
        setTimeout(() => setActionSuccessMsg(null), 6000);
        setActiveSubTab('list');
        setEditingUser(null);
      } catch (err: any) {
        setActionErrorMsg(err?.message || 'حدث خطأ أثناء حفظ التعديلات.');
      } finally {
        setIsSubmitting(false);
      }
    };

    // Rule: Modifying General Secretary or assigning someone as General Secretary requires credentials confirmation
    if (editingUser.role === 'amin_khedma_am' || editFormData.role === 'amin_khedma_am') {
      setGateTitle('تأكيد تعديل بيانات أمين الخدمة العام');
      setGateDescription(`يتطلب تعديل بيانات أمين الخدمة العام (${editFormData.name}) تسجيل اسم المستخدم وكلمة السر الحالية لأمين الخدمة العام للتأكد من هويتك وصلاحيتك:`);
      setGateUsername('');
      setGatePassword('');
      setGateError(null);
      setPendingAction(() => executeSave);
      setShowAuthGate(true);
      return;
    }

    await executeSave();
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionErrorMsg(null);
    setActionSuccessMsg(null);
    if (!formData.name.trim() || !formData.username.trim() || !formData.tempPassword.trim()) return;

    // Validate username strictly per requirements
    const usernameVal = validateUsername(formData.username.trim(), users);
    if (!usernameVal.valid) {
      setActionErrorMsg(usernameVal.error || 'اسم المستخدم غير صالح');
      return;
    }

    if (formData.role === 'amin_khedma_am') {
      setActionErrorMsg('حساب أمين الخدمة العام ثابت ولا يمكن إنشاء حساب آخر بنفس الصفة.');
      return;
    }

    const cleanAssignments = formData.role === 'general_dock' ? [] : formData.assignments;
    const derivedRole = getHighestAssignmentRole(cleanAssignments, formData.role);
    const primaryStage: Stage =
      derivedRole === 'general_dock'
        ? 'عامة'
        : cleanAssignments[0]?.stageName || formData.assignedStage || 'في انتظار التعيين';

    setIsSubmitting(true);
    try {
      const res = await createUser({
        name: formData.name.trim(),
        username: formData.username.trim(),
        password: formData.tempPassword,
        role: derivedRole,
        assignedStage: primaryStage,
        assignedStages: cleanAssignments.slice(1).map(a => a.stageName),
        assignments: cleanAssignments,
        phone: formData.phone.trim(),
        isAdminAssistant: formData.isAdminAssistant,
        canAssignMakhdomeen: formData.isAdminAssistant ? formData.canAssignMakhdomeen : true
      });

      if (!res.success) {
        setActionErrorMsg(res.error || 'فشل إنشاء الحساب.');
        return;
      }

      setActionSuccessMsg(`✅ تم إنشاء حساب جديد لـ (${formData.name}) بنجاح!`);
      setTimeout(() => setActionSuccessMsg(null), 6000);

      setFormData({
        name: '',
        username: '',
        tempPassword: 'temp' + Math.floor(1000 + Math.random() * 9000),
        role: 'khadem',
        assignedStage: defaultStage,
        assignments: [{ stageId: defaultStageId, stageName: defaultStage, role: 'khadem' }],
        phone: '',
        isAdminAssistant: false,
        canAssignMakhdomeen: true
      });

      setActiveSubTab('list');
    } catch (err: any) {
      setActionErrorMsg(err?.message || 'حدث خطأ أثناء إنشاء الحساب.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getPendingState = (reg: PendingRegistration) => {
    const existing = pendingConfig[reg.id];
    if (existing) return existing;
    return {
      tempPassword: 'temp' + Math.floor(1000 + Math.random() * 9000),
      role: 'khadem' as Role,
      assignments: defaultStage
        ? [{ stageId: defaultStageId, stageName: defaultStage, role: 'khadem' as ClassAssignmentRole }]
        : [],
      loading: false
    };
  };

  const updatePendingState = (
    reg: PendingRegistration,
    patch: Partial<{ tempPassword: string; role: Role; assignments: ClassAssignment[]; loading: boolean }>
  ) => {
    const base = getPendingState(reg);
    setPendingConfig(prev => ({
      ...prev,
      [reg.id]: { ...base, ...patch }
    }));
  };

  const handleApprovePending = async (reg: PendingRegistration) => {
    setActionErrorMsg(null);
    setActionSuccessMsg(null);
    const cfg = getPendingState(reg);
    const cleanAssignments = cfg.role === 'general_dock' ? [] : cfg.assignments;
    const derivedRole = getHighestAssignmentRole(cleanAssignments, cfg.role);
    const primaryStage =
      derivedRole === 'general_dock'
        ? 'عامة'
        : cleanAssignments[0]?.stageName || defaultStage;

    updatePendingState(reg, { loading: true });
    try {
      const res = await approvePendingRegistration(reg.id, {
        role: derivedRole,
        assignedStage: primaryStage,
        assignments: cleanAssignments,
        tempPassword: cfg.tempPassword.trim() || undefined
      });
      if (!res.success) {
        setActionErrorMsg(res.error || 'تعذر اعتماد الحساب.');
        return;
      }
      setActionSuccessMsg(`✅ تم اعتماد وتسكين حساب (${reg.fullName}) بنجاح!`);
      setTimeout(() => setActionSuccessMsg(null), 6000);
    } catch (err: any) {
      setActionErrorMsg(err?.message || 'حدث خطأ أثناء اعتماد الطلب.');
    } finally {
      updatePendingState(reg, { loading: false });
    }
  };

  const handleRejectPending = async (reg: PendingRegistration) => {
    setActionErrorMsg(null);
    setActionSuccessMsg(null);
    updatePendingState(reg, { loading: true });
    try {
      await rejectPendingRegistration(reg.id);
      setActionSuccessMsg(`تم رفض وحذف طلب التسجيل الخاص بـ (${reg.fullName}).`);
      setTimeout(() => setActionSuccessMsg(null), 5000);
    } catch (err: any) {
      setActionErrorMsg(err?.message || 'تعذر رفض الطلب.');
    } finally {
      updatePendingState(reg, { loading: false });
    }
  };

  const renderAssignmentsEditor = (
    assignments: ClassAssignment[],
    onChange: (next: ClassAssignment[]) => void,
    defaultRowRole: Role
  ) => {
    const usedStageNames = new Set(assignments.map(a => a.stageName));
    const availableToAdd = stagesList.filter(s => !usedStageNames.has(s.name));

    return (
      <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-[#220a15] border border-amber-200/80 dark:border-[#4d1d2c] space-y-2.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <span className="font-black text-slate-900 dark:text-stone-100 text-xs block">
              تسكين الفصول والرتب داخل الشجرة (Multi-Class Assignments)
            </span>
            <span className="text-[10px] text-slate-500 dark:text-stone-400">
              يمكن تكليف الخادم في أكثر من فصل برتبة مستقلة لكل فصل (بحد أقصى أمين فصل واحد لكل مرحلة)
            </span>
          </div>
          {availableToAdd.length > 0 && (
            <button
              type="button"
              onClick={() => {
                const nextStage = availableToAdd[0];
                onChange([
                  ...assignments,
                  {
                    stageId: nextStage.id || nextStage.name,
                    stageName: nextStage.name,
                    role: resolveAssignmentRowRole(defaultRowRole)
                  }
                ]);
              }}
              className="px-2.5 py-1.5 rounded-xl bg-burgundy-800 hover:bg-burgundy-900 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5 text-churchgold-300" />
              <span>إضافة فصل آخر</span>
            </button>
          )}
        </div>

        {assignments.length === 0 ? (
          <div className="p-3 rounded-xl bg-white dark:bg-[#1a0812] border border-dashed border-amber-300 dark:border-[#4d1d2c] text-center text-[11px] text-slate-500 dark:text-stone-400">
            لم يتم إسناد فصول بعد. اضغط "إضافة فصل آخر" لتحديد مرحلة ورتبة الخدمة.
          </div>
        ) : (
          <div className="space-y-2">
            {assignments.map((row, idx) => {
              const otherUsed = new Set(
                assignments.filter((_, i) => i !== idx).map(a => a.stageName)
              );
              const rowOptions = stagesList.filter(
                s => s.name === row.stageName || !otherUsed.has(s.name)
              );

              return (
                <div
                  key={`${row.stageName}-${idx}`}
                  className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-white dark:bg-[#1a0812] p-2.5 rounded-xl border border-amber-200/70 dark:border-[#3e1423]"
                >
                  <div className="sm:col-span-6">
                    <select
                      value={row.stageName}
                      onChange={(e) => {
                        const chosen = stagesList.find(s => s.name === e.target.value);
                        const next = assignments.map((item, i) =>
                          i === idx
                            ? {
                                ...item,
                                stageId: chosen?.id || e.target.value,
                                stageName: chosen?.name || e.target.value
                              }
                            : item
                        );
                        onChange(next);
                      }}
                      className="w-full bg-stone-50 dark:bg-[#240b17] border border-amber-200/80 dark:border-[#4d1d2c] rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 dark:text-stone-100 focus:outline-none"
                    >
                      {rowOptions.map(s => (
                        <option key={s.id || s.name} value={s.name}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-5">
                    <select
                      value={row.role}
                      onChange={(e) => {
                        const nextRole = e.target.value as ClassAssignmentRole;
                        const next = assignments.map((item, i) =>
                          i === idx ? { ...item, role: nextRole } : item
                        );
                        onChange(next);
                      }}
                      className="w-full bg-stone-50 dark:bg-[#240b17] border border-amber-200/80 dark:border-[#4d1d2c] rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 dark:text-stone-100 focus:outline-none"
                    >
                      <option value="khadem">خادم فصل</option>
                      <option value="mosaed_amin">مساعد أمين مرحلة</option>
                      <option value="amin_fasl">أمين مرحلة / فصل</option>
                    </select>
                  </div>

                  <div className="sm:col-span-1 flex justify-end">
                    <button
                      type="button"
                      onClick={() => onChange(assignments.filter((_, i) => i !== idx))}
                      className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                      title="إزالة الفصل"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const handleResetTempPass = (userId: string, userName: string) => {
    const newTemp = 'temp' + Math.floor(1000 + Math.random() * 9000);
    resetUserTempPassword(userId, newTemp);
    setActionSuccessMsg(`تم إسناد كلمة سر مؤقتة جديدة لـ (${userName}): ${newTemp}`);
    setTimeout(() => {
      setActionSuccessMsg(null);
    }, 8000);
  };

  const aminKhedmaUser = users.find(u => u.role === 'amin_khedma_am');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-[#1a0a12] rounded-3xl max-w-2xl w-full shadow-2xl border border-amber-200/80 dark:border-[#3e1423] overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-4 max-h-[90vh] flex flex-col transition-colors duration-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-burgundy-950 via-burgundy-900 to-burgundy-950 p-5 text-white flex items-center justify-between shrink-0 border-b border-churchgold-400/20">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-gradient-to-tr from-churchgold-600 to-amber-500 text-burgundy-950 shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-amber-50">إدارة حسابات المنظومة والخدام</h3>
              <p className="text-xs text-churchgold-300">خاص بأمين الخدمة العام • إمكانية تعديل وتحديث بيانات أي حساب في أي وقت</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-white/10 text-amber-200/80 hover:text-white transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sub Navigation */}
        <div className="px-6 pt-4 bg-stone-50 dark:bg-[#250d18] border-b border-amber-200/80 dark:border-[#3e1423] flex items-center justify-between gap-2 flex-wrap">
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => {
                setActiveSubTab('list');
                setEditingUser(null);
                setActionErrorMsg(null);
              }}
              className={`pb-2.5 px-3 font-bold text-xs border-b-2 flex items-center gap-1.5 cursor-pointer transition-colors ${
                activeSubTab === 'list'
                  ? 'border-churchgold-500 text-burgundy-900 dark:text-churchgold-300'
                  : 'border-transparent text-slate-500 dark:text-stone-400 hover:text-slate-800'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>قائمة الحسابات ({users.length})</span>
            </button>

            <button
              onClick={() => {
                setActiveSubTab('pending');
                setEditingUser(null);
                setActionErrorMsg(null);
              }}
              className={`pb-2.5 px-3 font-bold text-xs border-b-2 flex items-center gap-1.5 cursor-pointer transition-colors ${
                activeSubTab === 'pending'
                  ? 'border-churchgold-500 text-burgundy-900 dark:text-churchgold-300'
                  : 'border-transparent text-slate-500 dark:text-stone-400 hover:text-slate-800'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>طلبات التسجيل</span>
              {pendingOnly.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-burgundy-950 text-[10px] font-black">
                  {pendingOnly.length}
                </span>
              )}
            </button>

            <button
              onClick={() => {
                setActiveSubTab('add');
                setEditingUser(null);
                setActionErrorMsg(null);
              }}
              className={`pb-2.5 px-3 font-bold text-xs border-b-2 flex items-center gap-1.5 cursor-pointer transition-colors ${
                activeSubTab === 'add'
                  ? 'border-churchgold-500 text-burgundy-900 dark:text-churchgold-300'
                  : 'border-transparent text-slate-500 dark:text-stone-400 hover:text-slate-800'
              }`}
            >
              <UserPlus className="w-4 h-4" />
              <span>إنشاء حساب خادم جديد</span>
            </button>

            {activeSubTab === 'edit' && editingUser && (
              <button
                className="pb-2.5 px-3 font-bold text-xs border-b-2 border-amber-500 text-amber-700 dark:text-amber-300 flex items-center gap-1.5 cursor-default"
              >
                <Edit3 className="w-4 h-4" />
                <span>تعديل: {editingUser.name}</span>
              </button>
            )}
          </div>

          {/* Clean Slate Action */}
          <div className="pb-2">
            <button
              type="button"
              onClick={() => setShowPurgeModal(true)}
              className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800 text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
              title="تفريغ كافة حسابات الخدام التجريبية والبدء ببيانات جديدة خاصة بكنيستك"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
              <span>تفريغ حسابات التجربة للبدء من جديد 🧹</span>
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {actionSuccessMsg && (
            <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{actionSuccessMsg}</span>
            </div>
          )}

          {actionErrorMsg && (
            <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-700 text-rose-800 dark:text-rose-200 text-xs font-bold flex items-center justify-between gap-2 animate-in fade-in">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{actionErrorMsg}</span>
              </div>
              <button
                type="button"
                onClick={() => setActionErrorMsg(null)}
                className="text-rose-500 hover:text-rose-700 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {activeSubTab === 'list' ? (
            /* Accounts List */
            <div className="space-y-3">
              {/* Firebase Live Cloud Connection & Diagnostic Card */}
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-50 via-stone-50 to-emerald-50/70 dark:from-[#102419] dark:via-[#1c0c16] dark:to-[#102419] border border-emerald-300/80 dark:border-emerald-800/80 shadow-2xs space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
                      <Database className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-slate-900 dark:text-stone-100 text-xs">قاعدة البيانات السحابية (Firebase Firestore)</span>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-[10px] font-black border border-emerald-400 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span>متصل سحابياً وآمن</span>
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-stone-400 mt-0.5 font-mono">
                        Project: future-timing-2lxdt • DB: ai-studio-f086d3f1-a924-4993-a037-854916fa585c
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleTestCloudSync}
                    disabled={cloudSyncStatus.loading}
                    className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors shrink-0"
                    title="فحص فوري لقراءة وكتابة البيانات في Firebase Firestore"
                  >
                    <Wifi className={`w-3.5 h-3.5 ${cloudSyncStatus.loading ? 'animate-spin' : ''}`} />
                    <span>{cloudSyncStatus.loading ? 'جاري الفحص السحابي...' : '⚡ فحص سلامة الاتصال والتخزين الآن'}</span>
                  </button>
                </div>

                {cloudSyncStatus.tested && cloudSyncStatus.message && (
                  <div className={`p-2.5 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in ${
                    cloudSyncStatus.success 
                      ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-900 dark:text-emerald-200 border border-emerald-300' 
                      : 'bg-rose-100 dark:bg-rose-950/70 text-rose-900 dark:text-rose-200 border border-rose-300'
                  }`}>
                    {cloudSyncStatus.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
                    <span>{cloudSyncStatus.message}</span>
                  </div>
                )}
              </div>
              {/* Featured Card: Current General Supervisor */}
              {aminKhedmaUser && (
                <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50 via-churchgold-50/40 to-amber-100/50 dark:from-[#2e101d] dark:via-[#260e18] dark:to-[#381524] border-2 border-churchgold-400/60 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-churchgold-600 to-amber-500 flex items-center justify-center font-bold text-burgundy-950 shadow-xs shrink-0">
                      <Crown className="w-5 h-5 text-burgundy-950" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-slate-900 dark:text-stone-100 text-sm">{aminKhedmaUser.name}</span>
                        <span className="px-2 py-0.5 rounded-full bg-churchgold-500/20 border border-churchgold-400/40 text-churchgold-800 dark:text-churchgold-300 text-[10px] font-black">
                          أمين الخدمة العام
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 text-[9px] font-bold border border-emerald-300">
                          🛡️ الحساب الإداري الثابت والوحيد للمنظومة
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600 dark:text-stone-400 mt-0.5 flex items-center gap-2 flex-wrap">
                        <span>اسم الدخول: <strong className="font-mono text-slate-800 dark:text-stone-200">@{aminKhedmaUser.username}</strong></span>
                        {aminKhedmaUser.phone && <span>• 📞 {aminKhedmaUser.phone}</span>}
                        <span className="text-amber-900 dark:text-churchgold-400 font-bold">• محمي بالتحقق الأمني المزدوج</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
                    <button
                      type="button"
                      onClick={() => startEditing(aminKhedmaUser)}
                      className="px-3 py-2 rounded-xl bg-gradient-to-r from-burgundy-900 to-burgundy-800 hover:from-burgundy-950 hover:to-burgundy-900 text-churchgold-200 text-xs font-black flex items-center gap-1.5 shadow-xs cursor-pointer transition-all border border-churchgold-400/30"
                      title="تعديل اسم أو بيانات أمين الخدمة العام (يتطلب تأكيد أمني)"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-churchgold-400" />
                      <span>تعديل بيانات الحساب</span>
                    </button>
                  </div>
                </div>
              )}

              <div className="p-3 bg-stone-50 dark:bg-[#200a14] border border-amber-200/60 dark:border-[#381622] rounded-2xl text-slate-700 dark:text-stone-300 text-xs space-y-1">
                <span className="font-bold flex items-center gap-1 text-burgundy-900 dark:text-churchgold-300">
                  <Sparkles className="w-4 h-4 text-churchgold-600" />
                  <span>تعديل ومتابعة الحسابات:</span>
                </span>
                <p className="text-[11px] text-slate-500 dark:text-stone-400">
                  يمكنك تعديل اسم أمين الخدمة أو أي خادم، وتحديث رقم الهاتف، أو تغيير الصلاحيات في أي وقت بدون الحاجة لإنشاء حسابات جديدة.
                </p>
              </div>

              <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
                {users.map(u => {
                  const isSelf = currentUser?.id === u.id;
                  const isAminAm = u.role === 'amin_khedma_am';
                  return (
                    <div key={u.id} className="p-3.5 rounded-2xl bg-white dark:bg-[#240b17] border border-amber-200/80 dark:border-[#3e1423] hover:border-amber-300 dark:hover:border-[#4d1d2c] shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition-colors">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 dark:text-stone-100 text-sm">{u.name}</span>
                          {u.isAdminAssistant && (
                            <span className="px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-800 text-[10px] font-black">
                              مساعد أمين عام
                            </span>
                          )}
                          {u.assignedStage === 'في انتظار التعيين' && (
                            <span className="px-2 py-0.5 rounded-md bg-amber-500 text-burgundy-950 text-[10px] font-black border border-amber-400">
                              ⏳ في انتظار تعيين المرحلة
                            </span>
                          )}
                          {u.isTempPassword && (
                            <span className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-[#341121] text-amber-800 dark:text-churchgold-300 border border-amber-200 dark:border-[#4d1d2c] text-[10px] font-bold">
                              كلمة سر مؤقتة
                            </span>
                          )}
                          {isSelf && (
                            <span className="px-2 py-0.5 rounded-md bg-churchgold-100 dark:bg-churchgold-950/40 text-churchgold-900 dark:text-churchgold-300 border border-churchgold-300 text-[10px] font-bold">
                              أنت (الحالي)
                            </span>
                          )}
                        </div>
                        <div className="text-slate-500 dark:text-stone-400 text-[11px] mt-0.5 flex flex-wrap items-center gap-1.5">
                          <span>اسم المستخدم: <strong className="text-slate-700 dark:text-stone-300 font-mono">@{u.username}</strong></span>
                          <span>•</span>
                          <span>الصفة: {ROLE_ARABIC_MAP[u.role] || 'خادم'}</span>
                          <span>•</span>
                          {u.assignments && u.assignments.length > 0 ? (
                            u.assignments.map((a, idx) => (
                              <span key={`${a.stageName}-${idx}`} className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${getStageBadgeClass(a.stageName)}`}>
                                {a.stageName} ({ROLE_ARABIC_MAP[a.role] || 'خادم'})
                              </span>
                            ))
                          ) : (
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${getStageBadgeClass(u.assignedStage)}`}>
                              {u.assignedStage}
                            </span>
                          )}
                          {u.phone && <span>• 📞 {u.phone}</span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                        <button
                          onClick={() => startEditing(u)}
                          className="px-2.5 py-1.5 rounded-xl bg-stone-100 dark:bg-[#2e101d] hover:bg-amber-100/70 dark:hover:bg-[#3e1528] text-slate-800 dark:text-churchgold-300 border border-amber-200/80 dark:border-[#4d1d2c] font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                          title="تعديل بيانات الحساب"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-churchgold-600" />
                          <span>تعديل</span>
                        </button>

                        <button
                          onClick={() => handleResetTempPass(u.id, u.name)}
                          className="px-2.5 py-1.5 rounded-xl bg-amber-50 dark:bg-[#341121] hover:bg-amber-100 dark:hover:bg-[#4d1d2c] text-amber-900 dark:text-churchgold-300 border border-amber-200 dark:border-[#4d1d2c] font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                          title="إسناد كلمة سر مؤقتة جديدة"
                        >
                          <RefreshCw className="w-3 h-3 text-churchgold-600" />
                          <span>تصفير السر</span>
                        </button>

                        {!isSelf && !isAminAm ? (
                          <button
                            onClick={() => setUserToDelete(u)}
                            className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer transition-colors"
                            title="حذف الحساب"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        ) : isAminAm ? (
                          <span className="text-[10px] text-amber-800 dark:text-churchgold-400 font-bold px-2 py-1 rounded-lg bg-amber-100/70 dark:bg-[#321220] border border-amber-300 dark:border-[#4d1d2c]" title="حساب ثابت لا يتغير ولا يمكن حذفه">
                            ثابت 🛡️
                          </span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : activeSubTab === 'pending' ? (
            /* Pending Registrations Approval Tab */
            <div className="space-y-3">
              {pendingOnly.length === 0 ? (
                <div className="p-8 text-center rounded-2xl bg-stone-50 dark:bg-[#200a14] border border-amber-200/70 dark:border-[#381622] text-xs font-bold text-slate-500 dark:text-stone-400">
                  لا توجد طلبات تسجيل معلقة حالياً.
                </div>
              ) : (
                pendingOnly.map(reg => {
                  const cfg = getPendingState(reg);
                  return (
                    <div
                      key={reg.id}
                      className="p-4 rounded-2xl bg-white dark:bg-[#240b17] border-2 border-amber-300/80 dark:border-[#4d1d2c] space-y-3 shadow-xs text-xs"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-amber-100 dark:border-[#381622]">
                        <div>
                          <div className="font-black text-sm text-slate-900 dark:text-stone-100 flex items-center gap-2">
                            <span>{reg.fullName}</span>
                            <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-[#341121] text-amber-800 dark:text-churchgold-300 text-[10px] font-black">
                              بانتظار الاعتماد
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-stone-400 mt-0.5 flex flex-wrap items-center gap-2">
                            <span className="font-mono font-bold">@{reg.username}</span>
                            <span>• 📞 {reg.phone}</span>
                            {reg.birthDate && <span>• 🎂 {reg.birthDate}</span>}
                          </div>
                          {reg.notes && (
                            <div className="text-[11px] text-slate-600 dark:text-stone-300 mt-1">
                              ملاحظات: {reg.notes}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block font-bold mb-1 text-slate-800 dark:text-stone-200">كلمة السر المؤقتة للدخول الأول *</label>
                          <input
                            type="text"
                            value={cfg.tempPassword}
                            onChange={(e) => updatePendingState(reg, { tempPassword: e.target.value })}
                            className="w-full bg-amber-50/80 dark:bg-[#341121] border border-amber-300 dark:border-[#4d1d2c] text-amber-900 dark:text-churchgold-300 font-mono font-bold rounded-xl px-3 py-2 text-xs focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block font-bold mb-1 text-slate-800 dark:text-stone-200">نوع الحساب بالمنظومة</label>
                          <select
                            value={cfg.role}
                            onChange={(e) => updatePendingState(reg, { role: e.target.value as Role })}
                            className="w-full bg-stone-50 dark:bg-[#200a14] border border-amber-200/80 dark:border-[#4d1d2c] rounded-xl px-3 py-2 font-bold text-slate-800 dark:text-stone-100 focus:outline-none"
                          >
                            <option value="khadem">خادم فصل</option>
                            <option value="mosaed_amin">مساعد أمين مرحلة</option>
                            <option value="amin_fasl">أمين مرحلة / فصل</option>
                            <option value="general_dock">خادم عام (خدمة عامة بدون فصل)</option>
                          </select>
                        </div>
                      </div>

                      {cfg.role !== 'general_dock' &&
                        renderAssignmentsEditor(
                          cfg.assignments,
                          (next) => updatePendingState(reg, { assignments: next }),
                          cfg.role
                        )}

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-amber-100 dark:border-[#381622]">
                        <button
                          type="button"
                          disabled={cfg.loading}
                          onClick={() => handleRejectPending(reg)}
                          className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 font-bold text-xs cursor-pointer disabled:opacity-50"
                        >
                          رفض الطلب
                        </button>
                        <button
                          type="button"
                          disabled={cfg.loading}
                          onClick={() => handleApprovePending(reg)}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>{cfg.loading ? 'جاري الاعتماد...' : 'اعتماد وتسكين الحساب'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : activeSubTab === 'edit' && editingUser ? (
            /* Edit User Form */
            <form onSubmit={handleEditSubmit} className="space-y-4 text-xs font-medium text-slate-700 dark:text-stone-300">
              <div className="p-3 bg-amber-50/70 dark:bg-[#250d18] border border-amber-200/80 dark:border-[#4d1d2c] rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-churchgold-600" />
                  <span className="font-bold text-burgundy-900 dark:text-churchgold-300">
                    تعديل بيانات الحساب: <span className="underline">{editingUser.name}</span>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setActiveSubTab('list');
                    setEditingUser(null);
                  }}
                  className="text-xs text-slate-500 dark:text-stone-400 hover:underline flex items-center gap-1 cursor-pointer font-bold"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span>الرجوع للقائمة</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1 text-slate-800 dark:text-stone-200">الاسم بالكامل *</label>
                  <input
                    type="text"
                    required
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                    placeholder="مثال: أ/ مينا عادل، خ/ بيتر..."
                    className="w-full bg-stone-50 dark:bg-[#240b17] border border-amber-200/80 dark:border-[#4d1d2c] rounded-xl px-3 py-2 text-sm font-semibold text-slate-900 dark:text-stone-100 focus:bg-white dark:focus:bg-[#2c0e1c] focus:outline-none focus:ring-2 focus:ring-burgundy-600/30"
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1 text-slate-800 dark:text-stone-200">اسم المستخدم للولوج (Username) *</label>
                  <input
                    type="text"
                    required
                    value={editFormData.username}
                    onChange={(e) => setEditFormData({ ...editFormData, username: e.target.value })}
                    placeholder="مثال: bishoy.amin, mina_adel"
                    className="w-full bg-stone-50 dark:bg-[#240b17] border border-amber-200/80 dark:border-[#4d1d2c] rounded-xl px-3 py-2 text-sm font-mono font-semibold text-slate-900 dark:text-stone-100 focus:bg-white dark:focus:bg-[#2c0e1c] focus:outline-none focus:ring-2 focus:ring-burgundy-600/30"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1 text-slate-800 dark:text-stone-200">رقم الهاتف / الواتساب</label>
                  <input
                    type="tel"
                    value={editFormData.phone}
                    onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                    placeholder="012XXXXXXXX"
                    className="w-full bg-stone-50 dark:bg-[#240b17] border border-amber-200/80 dark:border-[#4d1d2c] rounded-xl px-3 py-2 text-slate-900 dark:text-stone-100 focus:outline-none"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1 text-slate-800 dark:text-stone-200">صفة الخادم بالمنظومة</label>
                  <select
                    value={editFormData.role}
                    onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value as Role })}
                    disabled={editingUser.role === 'amin_khedma_am'}
                    className="w-full bg-stone-50 dark:bg-[#240b17] border border-amber-200/80 dark:border-[#4d1d2c] rounded-xl px-3 py-2 font-bold text-slate-800 dark:text-stone-100 focus:outline-none disabled:opacity-75 disabled:cursor-not-allowed"
                  >
                    {editingUser.role === 'amin_khedma_am' ? (
                      <option value="amin_khedma_am">أمين الخدمة العام (ثابت)</option>
                    ) : (
                      <>
                        <option value="amin_fasl">أمين مرحلة / فصل</option>
                        <option value="mosaed_amin">مساعد أمين مرحلة</option>
                        <option value="khadem">خادم</option>
                        <option value="general_dock">خادم عام (خدمة عامة)</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              {editingUser.role !== 'amin_khedma_am' && editFormData.role !== 'general_dock' && (
                renderAssignmentsEditor(
                  editFormData.assignments,
                  (next) =>
                    setEditFormData(prev => ({
                      ...prev,
                      assignments: next,
                      assignedStage: next[0]?.stageName || prev.assignedStage
                    })),
                  editFormData.role
                )
              )}

              {editingUser.role !== 'amin_khedma_am' && (
                <div className="p-3.5 rounded-2xl bg-purple-50/60 dark:bg-[#240b17] border border-purple-200 dark:border-[#4d1d2c] space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-900 dark:text-stone-100">
                    <input
                      type="checkbox"
                      checked={editFormData.isAdminAssistant}
                      onChange={(e) => setEditFormData({ ...editFormData, isAdminAssistant: e.target.checked })}
                      className="rounded border-purple-300"
                    />
                    <span>منح صلاحيات مساعد أمين الخدمة العام (Admin Assistant)</span>
                  </label>
                  {editFormData.isAdminAssistant && (
                    <label className="flex items-center gap-2 cursor-pointer text-[11px] font-bold text-slate-700 dark:text-stone-300 pr-5">
                      <input
                        type="checkbox"
                        checked={editFormData.canAssignMakhdomeen}
                        onChange={(e) => setEditFormData({ ...editFormData, canAssignMakhdomeen: e.target.checked })}
                        className="rounded border-purple-300"
                      />
                      <span>السماح بإضافة وتعديل ونقل بيانات المخدومين</span>
                    </label>
                  )}
                </div>
              )}

              <div>
                <label className="block font-bold mb-1 text-slate-800 dark:text-stone-200">
                  تغيير كلمة السر (اتركها فارغة إذا كنت لا ترغب في تغييرها)
                </label>
                <input
                  type="text"
                  value={editFormData.password}
                  onChange={(e) => setEditFormData({ ...editFormData, password: e.target.value })}
                  placeholder="اكتب كلمة سر جديدة أو اتركها فارغة للحفاظ على الكلمة الحالية..."
                  className="w-full bg-stone-50 dark:bg-[#240b17] border border-amber-200/80 dark:border-[#4d1d2c] rounded-xl px-3 py-2 text-slate-900 dark:text-stone-100 font-mono text-sm focus:outline-none"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-amber-100 dark:border-[#341121]">
                <button
                  type="button"
                  onClick={() => {
                    setActiveSubTab('list');
                    setEditingUser(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-stone-100 dark:bg-[#250d18] hover:bg-stone-200 dark:hover:bg-[#341121] text-slate-700 dark:text-stone-300 font-bold cursor-pointer border border-amber-200/60 dark:border-[#4d1d2c]"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-burgundy-900 to-burgundy-800 hover:from-burgundy-950 hover:to-burgundy-900 text-churchgold-100 font-black flex items-center gap-1.5 shadow-md cursor-pointer border border-churchgold-400/40 disabled:opacity-50"
                >
                  <Save className="w-4 h-4 text-churchgold-300" />
                  <span>{isSubmitting ? 'جاري الحفظ...' : 'حفظ التعديلات'}</span>
                </button>
              </div>
            </form>
          ) : (
            /* Add User Form */
            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs font-medium text-slate-700 dark:text-stone-300">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1 text-slate-800 dark:text-stone-200">اسم الخادم الثلاثي *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="مثال: أ/ يوسف سمير إبراهيم"
                    className="w-full bg-stone-50 dark:bg-[#240b17] border border-amber-200/80 dark:border-[#4d1d2c] rounded-xl px-3 py-2 text-sm font-semibold text-slate-900 dark:text-stone-100 focus:bg-white dark:focus:bg-[#2c0e1c] focus:outline-none focus:ring-2 focus:ring-burgundy-600/30"
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1 text-slate-800 dark:text-stone-200">اسم المستخدم للدخول (Username) *</label>
                  <input
                    type="text"
                    required
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder="مثال: joseph_samir"
                    className="w-full bg-stone-50 dark:bg-[#240b17] border border-amber-200/80 dark:border-[#4d1d2c] rounded-xl px-3 py-2 text-sm font-mono font-semibold text-slate-900 dark:text-stone-100 focus:bg-white dark:focus:bg-[#2c0e1c] focus:outline-none focus:ring-2 focus:ring-burgundy-600/30"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold mb-1 text-slate-800 dark:text-stone-200">كلمة السر المؤقتة *</label>
                  <input
                    type="text"
                    required
                    value={formData.tempPassword}
                    onChange={(e) => setFormData({ ...formData, tempPassword: e.target.value })}
                    className="w-full bg-amber-50/80 dark:bg-[#341121] border border-amber-300 dark:border-[#4d1d2c] text-amber-900 dark:text-churchgold-300 font-mono font-bold rounded-xl px-3 py-2 text-sm focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1 text-slate-800 dark:text-stone-200">صفة الخادم بالمنظومة</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as Role })}
                    className="w-full bg-stone-50 dark:bg-[#240b17] border border-amber-200/80 dark:border-[#4d1d2c] rounded-xl px-3 py-2 font-bold text-slate-800 dark:text-stone-100 focus:outline-none"
                  >
                    <option value="khadem">خادم</option>
                    <option value="mosaed_amin">مساعد أمين مرحلة</option>
                    <option value="amin_fasl">أمين مرحلة / فصل</option>
                    <option value="general_dock">خادم عام (خدمة عامة)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold mb-1 text-slate-800 dark:text-stone-200">رقم الهاتف / الواتساب</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="012XXXXXXXX"
                    className="w-full bg-stone-50 dark:bg-[#240b17] border border-amber-200/80 dark:border-[#4d1d2c] rounded-xl px-3 py-2 text-slate-900 dark:text-stone-100 focus:outline-none"
                    dir="ltr"
                  />
                </div>
              </div>

              {formData.role !== 'general_dock' &&
                renderAssignmentsEditor(
                  formData.assignments,
                  (next) =>
                    setFormData(prev => ({
                      ...prev,
                      assignments: next,
                      assignedStage: next[0]?.stageName || prev.assignedStage
                    })),
                  formData.role
                )}

              <div className="p-3.5 rounded-2xl bg-purple-50/60 dark:bg-[#240b17] border border-purple-200 dark:border-[#4d1d2c] space-y-2">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-900 dark:text-stone-100">
                  <input
                    type="checkbox"
                    checked={formData.isAdminAssistant}
                    onChange={(e) => setFormData({ ...formData, isAdminAssistant: e.target.checked })}
                    className="rounded border-purple-300"
                  />
                  <span>منح صلاحيات مساعد أمين الخدمة العام (Admin Assistant)</span>
                </label>
                {formData.isAdminAssistant && (
                  <label className="flex items-center gap-2 cursor-pointer text-[11px] font-bold text-slate-700 dark:text-stone-300 pr-5">
                    <input
                      type="checkbox"
                      checked={formData.canAssignMakhdomeen}
                      onChange={(e) => setFormData({ ...formData, canAssignMakhdomeen: e.target.checked })}
                      className="rounded border-purple-300"
                    />
                    <span>السماح بإضافة وتعديل ونقل بيانات المخدومين</span>
                  </label>
                )}
              </div>

              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-2xl text-emerald-800 dark:text-emerald-200 text-[11px] space-y-1">
                <span className="font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>عند الضغط على حفظ:</span>
                </span>
                <p>سيتم إنشاء الحساب بكلمة السر المؤقتة الموضحة أعلاه. سيُطلب من الخادم تغيير كلمة السر الخاصة به في أول تسجيل دخول له.</p>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-amber-100 dark:border-[#341121]">
                <button
                  type="button"
                  onClick={() => setActiveSubTab('list')}
                  className="px-4 py-2 rounded-xl bg-stone-100 dark:bg-[#250d18] hover:bg-stone-200 dark:hover:bg-[#341121] text-slate-700 dark:text-stone-300 font-bold cursor-pointer border border-amber-200/60 dark:border-[#4d1d2c]"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-churchgold-600 to-amber-600 hover:from-churchgold-700 hover:to-amber-700 text-burgundy-950 font-black flex items-center gap-1.5 shadow-md cursor-pointer border border-churchgold-400/40 disabled:opacity-50"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>{isSubmitting ? 'جاري الإنشاء...' : 'إنشاء الحساب بكلمة السر المؤقتة'}</span>
                </button>
              </div>
            </form>
          )}
        </div>

      </div>

      {/* MODAL 1: In-App User Deletion Confirmation Dialog */}
      {userToDelete && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#1a0812] rounded-3xl max-w-sm w-full p-6 border-2 border-rose-300 dark:border-rose-900 shadow-2xl text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-rose-100 dark:bg-rose-950/70 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto shadow-inner">
              <Trash2 className="w-7 h-7" />
            </div>

            <div>
              <h4 className="font-black text-slate-900 dark:text-stone-100 text-base">تأكيد حذف الحساب</h4>
              <p className="text-xs text-slate-600 dark:text-stone-300 mt-2 leading-relaxed">
                هل أنت متأكد من رغبتك في حذف حساب <strong className="text-slate-900 dark:text-stone-100 font-bold">({userToDelete.name})</strong> نهائياً من المنظومة؟
              </p>
              <div className="text-[11px] text-slate-500 dark:text-stone-400 font-mono mt-1">
                اسم المستخدم: @{userToDelete.username}
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2 border-t border-amber-100 dark:border-[#381421]">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="px-4 py-2 rounded-xl bg-stone-100 dark:bg-[#250d18] hover:bg-stone-200 dark:hover:bg-[#341121] text-slate-700 dark:text-stone-300 text-xs font-bold cursor-pointer transition-colors"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={async () => {
                  const uid = userToDelete.id;
                  const uname = userToDelete.name;
                  setUserToDelete(null);
                  await deleteUser(uid);
                  setActionSuccessMsg(`✅ تم حذف حساب (${uname}) بنجاح.`);
                  setTimeout(() => setActionSuccessMsg(null), 5000);
                }}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black flex items-center gap-1.5 shadow-md cursor-pointer transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span>تأكيد الحذف النهائي</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Purge All Non-Admin Users Confirmation */}
      {showPurgeModal && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#1a0812] rounded-3xl max-w-md w-full p-6 border-2 border-rose-400 dark:border-rose-900 shadow-2xl text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-rose-100 dark:bg-rose-950/70 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto shadow-inner">
              <Trash2 className="w-7 h-7" />
            </div>

            <div>
              <h4 className="font-black text-slate-900 dark:text-stone-100 text-base">تفريغ حسابات التجربة والبدء من جديد</h4>
              <p className="text-xs text-slate-600 dark:text-stone-300 mt-2 leading-relaxed">
                هل أنت متأكد من رغبتك في حذف كافة حسابات الخدام التجريبية من النظام وقاعدة بيانات Firebase للبدء بقاعدة بيانات جديدة ونظيفة خاصة بكنيستك؟
              </p>
              <div className="text-[11px] text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 p-3 rounded-2xl border border-amber-300 dark:border-amber-900/60 mt-3 font-bold text-right space-y-1">
                <div className="flex items-center gap-1.5 text-burgundy-900 dark:text-amber-200">
                  <ShieldCheck className="w-4 h-4 text-churchgold-600" />
                  <span>حماية حساب أمين الخدمة العام:</span>
                </div>
                <p className="text-[10px] leading-relaxed text-slate-600 dark:text-stone-300">
                  سيتم الإبقاء على حسابك كـ أمين الخدمة العام (<strong className="font-mono">@{aminKhedmaUser?.username}</strong>) ثابتاً ومحمياً دون مساس، لتتمكن من إضافة وتسكين خدام كنيستك الفعليين من خلاله.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2 border-t border-amber-100 dark:border-[#381421]">
              <button
                type="button"
                disabled={isPurging}
                onClick={() => setShowPurgeModal(false)}
                className="px-4 py-2 rounded-xl bg-stone-100 dark:bg-[#250d18] hover:bg-stone-200 dark:hover:bg-[#341121] text-slate-700 dark:text-stone-300 text-xs font-bold cursor-pointer transition-colors"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={isPurging}
                onClick={async () => {
                  setIsPurging(true);
                  await clearAllNonAdminUsers();
                  setIsPurging(false);
                  setShowPurgeModal(false);
                  setActionSuccessMsg('✅ تم تفريغ الحسابات التجريبية بنجاح! لديك الآن قاعدة بيانات نظيفة جاهزة لإضافة الخدام الجدد.');
                  setTimeout(() => setActionSuccessMsg(null), 8000);
                }}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black flex items-center gap-1.5 shadow-md cursor-pointer transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isPurging ? 'جاري التفريغ...' : 'تأكيد تفريغ الحسابات'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Security Verification Gate Dialog (تسجيل اسم المستخدم وكلمة السر للتأكد) */}
      {showAuthGate && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#1a0812] rounded-3xl max-w-md w-full shadow-2xl border-2 border-amber-400 dark:border-amber-600 overflow-hidden">
            <div className="bg-gradient-to-r from-burgundy-950 via-burgundy-900 to-burgundy-950 p-4 sm:p-5 text-white flex items-center justify-between border-b border-churchgold-400/20">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500 text-burgundy-950 font-black">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm sm:text-base font-black text-amber-50">{gateTitle}</h4>
                  <p className="text-[11px] text-churchgold-300">تحقق أمني مطلوب لحماية صلاحيات الإدارة</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAuthGate(false);
                  setPendingAction(null);
                }}
                className="p-1.5 rounded-xl hover:bg-white/10 text-amber-200/80 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleVerifyGateSubmit} className="p-5 sm:p-6 space-y-4 text-xs font-medium text-slate-700 dark:text-stone-300">
              <p className="text-xs text-slate-700 dark:text-stone-300 leading-relaxed font-bold bg-amber-50/70 dark:bg-[#250d18] p-3 rounded-xl border border-amber-200 dark:border-[#4d1d2c]">
                {gateDescription || 'للتأكد من هويتك وأنك المخول بإجراء هذا التعديل والتسكين، يرجى كتابة اسم المستخدم وكلمة السر الخاصة بك للتأكيد الأمني:'}
              </p>

              {gateError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-700 text-rose-800 dark:text-rose-200 text-xs font-bold flex items-center gap-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{gateError}</span>
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="block font-bold mb-1 text-slate-800 dark:text-stone-200">
                    اسم المستخدم الخاص بك للتأكيد (Username) *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={gateUsername}
                      onChange={(e) => setGateUsername(e.target.value)}
                      placeholder="اكتب اسم المستخدم الخاص بحسابك..."
                      className="w-full bg-stone-50 dark:bg-[#200a14] border border-amber-300 dark:border-[#4d1d2c] rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-burgundy-600/30"
                      dir="ltr"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold mb-1 text-slate-800 dark:text-stone-200">
                    كلمة السر الخاصة بك للتأكيد *
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      required
                      value={gatePassword}
                      onChange={(e) => setGatePassword(e.target.value)}
                      placeholder="أدخل كلمة السر الخاصة بحسابك للتأكيد..."
                      className="w-full bg-stone-50 dark:bg-[#200a14] border border-amber-300 dark:border-[#4d1d2c] rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-burgundy-600/30"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-amber-100 dark:border-[#341121]">
                <button
                  type="button"
                  onClick={() => {
                    setShowAuthGate(false);
                    setPendingAction(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-stone-100 dark:bg-[#250d18] hover:bg-stone-200 dark:hover:bg-[#341121] text-slate-700 dark:text-stone-300 font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={gateLoading}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-burgundy-900 to-burgundy-800 hover:from-burgundy-950 hover:to-burgundy-900 text-churchgold-100 font-black flex items-center gap-1.5 shadow-md cursor-pointer border border-churchgold-400/40"
                >
                  <ShieldCheck className="w-4 h-4 text-churchgold-300" />
                  <span>{gateLoading ? 'جاري التحقق...' : 'تأكيد الهوية واعتماد التعديل'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
