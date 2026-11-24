import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Role, Stage, AppUser } from '../types';
import { 
  X, UserPlus, Users, Trash2, ShieldCheck, 
  CheckCircle2, Sparkles, RefreshCw, AlertCircle, Edit3, Crown, Save, ArrowRight,
  Lock, KeyRound, UserCheck, Check, Database, Wifi, Server
} from 'lucide-react';
import { getStageBadgeClass } from '../utils/themeColors';
import { validateUsername, verifyPassword } from '../utils/cryptoUtils';
import { testFirestoreLiveSync } from '../services/firestoreService';

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserManagementModal: React.FC<UserManagementModalProps> = ({ isOpen, onClose }) => {
  const { users, createUser, updateUser, deleteUser, resetUserTempPassword, currentUser, stagesList, clearAllNonAdminUsers } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<'list' | 'add' | 'edit'>('list');
  const [showPurgeModal, setShowPurgeModal] = useState(false);
  const [isPurging, setIsPurging] = useState(false);
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

  // Editing User State
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    username: '',
    role: 'khadem' as Role,
    assignedStage: 'عامة' as Stage,
    phone: '',
    password: ''
  });

  // New User Form State
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    tempPassword: 'temp' + Math.floor(1000 + Math.random() * 9000),
    role: 'khadem' as Role,
    assignedStage: 'ابتدائي (ثالثة ورابعة)' as Stage,
    phone: ''
  });

  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

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

  // Check authorization: General Secretary only
  const isAuthorizedAdmin = currentUser?.role === 'amin_khedma_am';

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

  const startEditing = (u: AppUser) => {
    setEditingUser(u);
    setEditFormData({
      name: u.name,
      username: u.username,
      role: u.role,
      assignedStage: (u.assignedStage || 'عامة') as Stage,
      phone: u.phone || '',
      password: ''
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

    const cleanUser = gateUsername.trim().toLowerCase();
    const cleanPass = gatePassword.trim();

    if (!cleanUser || !cleanPass) {
      setGateError('يرجى تسجيل اسم المستخدم وكلمة السر الحالية للتأكيد');
      return;
    }

    setGateLoading(true);
    try {
      // Find matching user from current user or users list
      const isCurrent = cleanUser === (currentUser?.username || '').trim().toLowerCase();
      const currentPassValid = isCurrent && await verifyPassword(cleanPass, currentUser?.password);

      // Or check if entered credentials match amin_khedma_am
      const aminUser = users.find(u => u.role === 'amin_khedma_am');
      const isAminUser = cleanUser === (aminUser?.username || '').trim().toLowerCase();
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

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    if (!editFormData.name.trim() || !editFormData.username.trim()) return;

    // Validate username strictly per requirements
    const usernameVal = validateUsername(editFormData.username.trim(), users, editingUser.id);
    if (!usernameVal.valid) {
      setActionSuccessMsg(`❌ ${usernameVal.error}`);
      setTimeout(() => setActionSuccessMsg(null), 6000);
      return;
    }

    // Protect General Secretary role: cannot assign another user as amin_khedma_am, and cannot demote the General Secretary
    if (editingUser.role !== 'amin_khedma_am' && editFormData.role === 'amin_khedma_am') {
      setActionSuccessMsg('❌ حساب أمين الخدمة العام ثابت ولا يمكن تعيين حساب آخر كأمين عام.');
      setTimeout(() => setActionSuccessMsg(null), 5000);
      return;
    }
    const finalRole: Role = editingUser.role === 'amin_khedma_am' ? 'amin_khedma_am' : editFormData.role;

    const updatePayload: Partial<AppUser> = {
      name: editFormData.name.trim(),
      username: editFormData.username.trim(),
      role: finalRole,
      assignedStage: editFormData.assignedStage,
      phone: editFormData.phone.trim()
    };

    if (editFormData.password.trim()) {
      updatePayload.password = editFormData.password.trim();
      updatePayload.isTempPassword = false;
    }

    const executeSave = () => {
      updateUser(editingUser.id, updatePayload);
      setActionSuccessMsg(`✅ تم تحديث وتعديل بيانات حساب (${editFormData.name}) بنجاح!`);
      setTimeout(() => setActionSuccessMsg(null), 6000);
      setActiveSubTab('list');
      setEditingUser(null);
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

    executeSave();
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.username.trim() || !formData.tempPassword.trim()) return;

    // Validate username strictly per requirements
    const usernameVal = validateUsername(formData.username.trim(), users);
    if (!usernameVal.valid) {
      setActionSuccessMsg(`❌ ${usernameVal.error}`);
      setTimeout(() => setActionSuccessMsg(null), 6000);
      return;
    }

    createUser({
      name: formData.name,
      username: formData.username.trim(),
      password: formData.tempPassword,
      role: formData.role,
      assignedStage: formData.assignedStage,
      phone: formData.phone
    });

    setActionSuccessMsg(`✅ تم إنشاء حساب جديد لـ (${formData.name}) بنجاح!`);
    setTimeout(() => setActionSuccessMsg(null), 6000);

    setFormData({
      name: '',
      username: '',
      tempPassword: 'temp' + Math.floor(1000 + Math.random() * 9000),
      role: 'khadem',
      assignedStage: 'ابتدائي (ثالثة ورابعة)',
      phone: ''
    });

    setActiveSubTab('list');
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
          <div className="flex gap-2">
            <button
              onClick={() => {
                setActiveSubTab('list');
                setEditingUser(null);
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
                setActiveSubTab('add');
                setEditingUser(null);
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
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 dark:text-stone-100 text-sm">{u.name}</span>
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
                        <div className="text-slate-500 dark:text-stone-400 text-[11px] mt-0.5 flex flex-wrap items-center gap-2">
                          <span>اسم المستخدم: <strong className="text-slate-700 dark:text-stone-300 font-mono">@{u.username}</strong></span>
                          <span>•</span>
                          <span>الصفة: {u.role === 'amin_khedma_am' ? 'أمين الخدمة العام' : u.role === 'amin_fasl' ? 'أمين فصل' : 'خادم'}</span>
                          <span>•</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${getStageBadgeClass(u.assignedStage)}`}>
                            {u.assignedStage}
                          </span>
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
                    placeholder="مثال: admin, mina_adel"
                    className="w-full bg-stone-50 dark:bg-[#240b17] border border-amber-200/80 dark:border-[#4d1d2c] rounded-xl px-3 py-2 text-sm font-mono font-semibold text-slate-900 dark:text-stone-100 focus:bg-white dark:focus:bg-[#2c0e1c] focus:outline-none focus:ring-2 focus:ring-burgundy-600/30"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                        <option value="amin_fasl">أمين فصل / مساعدة</option>
                        <option value="khadem">خادم</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block font-bold mb-1 text-slate-800 dark:text-stone-200">المرحلة المسئول عنها</label>
                  <select
                    value={editFormData.assignedStage}
                    onChange={(e) => setEditFormData({ ...editFormData, assignedStage: e.target.value as Stage })}
                    className="w-full bg-stone-50 dark:bg-[#240b17] border border-amber-200/80 dark:border-[#4d1d2c] rounded-xl px-3 py-2 font-bold text-slate-800 dark:text-stone-100 focus:outline-none"
                  >
                    <option value="في انتظار التعيين">⏳ في انتظار التعيين (جديد)</option>
                    {stagesList.map(s => (
                      <option key={s.id || s.name} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

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
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-burgundy-900 to-burgundy-800 hover:from-burgundy-950 hover:to-burgundy-900 text-churchgold-100 font-black flex items-center gap-1.5 shadow-md cursor-pointer border border-churchgold-400/40"
                >
                  <Save className="w-4 h-4 text-churchgold-300" />
                  <span>حفظ التعديلات</span>
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
                    <option value="amin_fasl">أمين فصل / مساعدة</option>
                    <option value="amin_khedma_am">أمين الخدمة العام</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold mb-1 text-slate-800 dark:text-stone-200">المرحلة المسئول عنها</label>
                  <select
                    value={formData.assignedStage}
                    onChange={(e) => setFormData({ ...formData, assignedStage: e.target.value as Stage })}
                    className="w-full bg-stone-50 dark:bg-[#240b17] border border-amber-200/80 dark:border-[#4d1d2c] rounded-xl px-3 py-2 font-bold text-slate-800 dark:text-stone-100 focus:outline-none"
                  >
                    {stagesList.map(s => (
                      <option key={s.id || s.name} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                </div>
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
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-churchgold-600 to-amber-600 hover:from-churchgold-700 hover:to-amber-700 text-burgundy-950 font-black flex items-center gap-1.5 shadow-md cursor-pointer border border-churchgold-400/40"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>إنشاء الحساب بكلمة السر المؤقتة</span>
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
