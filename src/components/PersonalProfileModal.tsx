import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { 
  X, User, Phone, Briefcase, MapPin, Calendar, 
  Lock, Check, AlertCircle, ShieldCheck, KeyRound, Sparkles, Anchor, Camera, Trash2
} from 'lucide-react';
import { AREAS } from '../data/mockData';
import { compressAvatarImage, isSafeImageUrl } from '../utils/imageHelper';
import { validateUsername } from '../utils/cryptoUtils';

interface PersonalProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PersonalProfileModal: React.FC<PersonalProfileModalProps> = ({ isOpen, onClose }) => {
  const { currentUser, users, updatePersonalProfile, changePassword } = useApp();

  const [activeTab, setActiveTab] = useState<'info' | 'password'>('info');

  // Form Fields
  const [name, setName] = useState(currentUser?.name || '');
  const [username, setUsername] = useState(currentUser?.username || '');
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [birthDate, setBirthDate] = useState(currentUser?.birthDate || '1995-01-01');
  const [notes, setNotes] = useState(currentUser?.notes || '');
  const [avatarUrl, setAvatarUrl] = useState(currentUser?.avatarUrl || '');

  // Password Fields
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && currentUser) {
      setName(currentUser.name || '');
      setUsername(currentUser.username || '');
      setPhone(currentUser.phone || '');
      setBirthDate(currentUser.birthDate || '1995-01-01');
      setNotes(currentUser.notes || '');
      setAvatarUrl(currentUser.avatarUrl || '');
      setErrorMsg(null);
      setSuccessMsg(null);
    }
  }, [isOpen, currentUser]);

  if (!isOpen || !currentUser) return null;

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    try {
      const compressed = await compressAvatarImage(file);
      setAvatarUrl(compressed);
    } catch (err: any) {
      setErrorMsg(err?.message || 'تعذر معالجة الصورة المختارة');
    } finally {
      e.target.value = '';
    }
  };

  const handleInfoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!name.trim()) {
      setErrorMsg('الاسم الكامل مطلوب');
      return;
    }

    const cleanUsername = username.trim().toLowerCase();
    const usernameCheck = validateUsername(cleanUsername, users, currentUser.id);
    if (!usernameCheck.valid) {
      setErrorMsg(usernameCheck.error || 'اسم المستخدم غير صالح');
      return;
    }

    setIsSubmitting(true);
    try {
      await updatePersonalProfile({
        name: name.trim(),
        username: cleanUsername,
        phone: phone.trim(),
        birthDate,
        notes: notes.trim(),
        avatarUrl: avatarUrl || ''
      });
      setSuccessMsg('تم حفظ وتحديث بياناتك الشخصية بنجاح!');
      setTimeout(() => {
        setSuccessMsg(null);
        onClose();
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || 'حدث خطأ أثناء تحديث البيانات');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!newPassword.trim() || newPassword.length < 4) {
      setErrorMsg('كلمة المرور الجديدة يجب أن تكون 4 أحرف أو أرقام على الأقل');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('كلمة المرور وتأكيدها غير متطابقين');
      return;
    }

    setIsSubmitting(true);
    try {
      await changePassword(currentUser.id, newPassword.trim());
      setSuccessMsg('تم تغيير كلمة المرور بنجاح! احتفظ بكلمة المرور الجديدة.');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setSuccessMsg(null);
        onClose();
      }, 1800);
    } catch (err: any) {
      setErrorMsg(err.message || 'فشل تحديث كلمة المرور');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRoleArabicTitle = () => {
    if (currentUser.isAdminAssistant) return 'مساعد أمين الخدمة العام';
    if (currentUser.role === 'amin_khedma_am') return 'أمين الخدمة العام';
    if (currentUser.role === 'amin_fasl') return `أمين مرحلة وفصل (${currentUser.assignedStage})`;
    if (currentUser.role === 'mosaed_amin') return `مساعد أمين مرحلة (${currentUser.assignedStage})`;
    if (currentUser.role === 'general_dock') return 'خادم خدمة عامة (عام)';
    return `خادم مرحلة (${currentUser.assignedStage || 'عامة'})`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto font-['Cairo',sans-serif]">
      <div className="bg-white dark:bg-[#1a0a12] text-slate-900 dark:text-stone-100 rounded-3xl max-w-lg w-full shadow-2xl border border-amber-200/80 dark:border-[#4d1d2c] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-burgundy-900 via-burgundy-800 to-[#1e0711] text-white p-4 sm:p-5 flex items-center justify-between border-b border-amber-500/30">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-churchgold-500/20 ring-1 ring-churchgold-400/40 flex items-center justify-center text-churchgold-300 font-bold overflow-hidden shrink-0">
              {isSafeImageUrl(avatarUrl) ? (
                <img src={avatarUrl} alt={currentUser.name} className="w-full h-full object-cover" />
              ) : (
                <User className="w-5 h-5 text-churchgold-300" />
              )}
            </div>
            <div>
              <h3 className="font-black text-base sm:text-lg flex items-center gap-2">
                <span>تعديل بياناتي الشخصية</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-churchgold-500/25 text-churchgold-200 border border-churchgold-400/50 font-bold">
                  {currentUser.username}
                </span>
              </h3>
              <p className="text-xs text-churchgold-200 font-bold flex items-center gap-1.5 mt-1">
                <ShieldCheck className="w-4 h-4 text-churchgold-400" />
                <span>{getRoleArabicTitle()}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-stone-200 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher (بيانات شخصية / كلمة السر) */}
        <div className="flex border-b border-amber-200/60 dark:border-[#381622] bg-amber-50/50 dark:bg-[#15060d] px-4 pt-2 gap-2">
          <button
            type="button"
            onClick={() => { setActiveTab('info'); setErrorMsg(null); setSuccessMsg(null); }}
            className={`px-4 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 cursor-pointer ${
              activeTab === 'info'
                ? 'border-burgundy-700 dark:border-churchgold-400 text-burgundy-900 dark:text-churchgold-300 bg-white dark:bg-[#1a0a12]'
                : 'border-transparent text-slate-500 dark:text-stone-400 hover:text-slate-800'
            }`}
          >
            البيانات والتواصل
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('password'); setErrorMsg(null); setSuccessMsg(null); }}
            className={`px-4 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 cursor-pointer ${
              activeTab === 'password'
                ? 'border-burgundy-700 dark:border-churchgold-400 text-burgundy-900 dark:text-churchgold-300 bg-white dark:bg-[#1a0a12]'
                : 'border-transparent text-slate-500 dark:text-stone-400 hover:text-slate-800'
            }`}
          >
            تغيير كلمة المرور
          </button>
        </div>

        {/* Feedback messages */}
        {successMsg && (
          <div className="m-4 p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="m-4 p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form Body */}
        {activeTab === 'info' ? (
          <form onSubmit={handleInfoSubmit} className="p-4 sm:p-5 space-y-4 text-xs">
            {/* Avatar Upload & Preview */}
            <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-amber-50/70 dark:bg-[#240b17] border border-amber-200/80 dark:border-[#4d1d2c]">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-burgundy-900 text-churchgold-300 flex items-center justify-center font-black text-xl overflow-hidden border border-churchgold-400/40 shrink-0">
                  {isSafeImageUrl(avatarUrl) ? (
                    <img src={avatarUrl} alt={name || currentUser.name} className="w-full h-full object-cover" />
                  ) : (
                    (name || currentUser.name || 'خ').charAt(0)
                  )}
                </div>
                <div>
                  <div className="text-xs font-black text-slate-900 dark:text-stone-100">الصورة الشخصية</div>
                  <div className="text-[11px] text-slate-500 dark:text-stone-400">يتم ضغطها تلقائياً لتناسب المزامنة السحابية</div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <label className="px-3 py-1.5 rounded-xl bg-burgundy-800 hover:bg-burgundy-900 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs">
                  <Camera className="w-3.5 h-3.5 text-churchgold-300" />
                  <span>{isSafeImageUrl(avatarUrl) ? 'تغيير' : 'رفع صورة'}</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={handleAvatarFileChange}
                    className="hidden"
                  />
                </label>
                {isSafeImageUrl(avatarUrl) && (
                  <button
                    type="button"
                    onClick={() => setAvatarUrl('')}
                    className="p-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 hover:bg-rose-100 border border-rose-200 dark:border-rose-800 cursor-pointer"
                    title="حذف الصورة"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs sm:text-sm font-black text-slate-950 dark:text-stone-100 mb-1.5">
                  الاسم الكامل *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-white dark:bg-[#200b14] border-2 border-stone-300 dark:border-[#521c32] focus:border-burgundy-700 dark:focus:border-churchgold-400 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-black text-slate-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-burgundy-600/20 transition-all"
                  />
                  <User className="w-4 h-4 text-churchgold-600 dark:text-churchgold-400 absolute left-3.5 top-3" />
                </div>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-black text-slate-950 dark:text-stone-100 mb-1.5">
                  اسم المستخدم للدخول (Username) *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value.replace(/\s+/g, ''))}
                    className="w-full bg-white dark:bg-[#200b14] border-2 border-stone-300 dark:border-[#521c32] focus:border-burgundy-700 dark:focus:border-churchgold-400 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-mono font-black text-slate-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-burgundy-600/20 transition-all"
                    dir="ltr"
                  />
                  <ShieldCheck className="w-4 h-4 text-churchgold-600 dark:text-churchgold-400 absolute left-3.5 top-3" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs sm:text-sm font-black text-slate-950 dark:text-stone-100 mb-1.5">
                  رقم الهاتف الشخصي
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="01xxxxxxxxx"
                    className="w-full bg-white dark:bg-[#200b14] border-2 border-stone-300 dark:border-[#521c32] focus:border-burgundy-700 dark:focus:border-churchgold-400 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-black text-slate-950 dark:text-white placeholder:text-stone-400 font-mono focus:outline-none focus:ring-2 focus:ring-burgundy-600/20 transition-all"
                  />
                  <Phone className="w-4 h-4 text-churchgold-600 dark:text-churchgold-400 absolute left-3.5 top-3" />
                </div>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-black text-slate-950 dark:text-stone-100 mb-1.5">
                  تاريخ الميلاد
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    className="w-full bg-white dark:bg-[#200b14] border-2 border-stone-300 dark:border-[#521c32] focus:border-burgundy-700 dark:focus:border-churchgold-400 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-black text-slate-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-burgundy-600/20 transition-all cursor-pointer font-mono"
                  />
                  <Calendar className="w-4 h-4 text-churchgold-600 dark:text-churchgold-400 absolute left-3.5 top-3" />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-black text-slate-950 dark:text-stone-100 mb-1.5">
                ملاحظات الخدمة
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="أي بيانات تود تدوينها حول خدمتك أو دراستك..."
                className="w-full bg-white dark:bg-[#200b14] border-2 border-stone-300 dark:border-[#521c32] focus:border-burgundy-700 dark:focus:border-churchgold-400 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-black text-slate-950 dark:text-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-burgundy-600/20 resize-none transition-all"
              />
            </div>

            {/* Action buttons */}
            <div className="pt-2 flex items-center justify-end gap-2 border-t border-amber-200/80 dark:border-[#381622]">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-stone-100 dark:bg-[#250d18] text-slate-700 dark:text-stone-300 font-bold hover:bg-stone-200 cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2 rounded-xl bg-gradient-to-r from-burgundy-700 to-burgundy-800 hover:from-burgundy-800 hover:to-burgundy-900 text-white font-black shadow-md cursor-pointer transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>حفظ التعديلات</span>
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handlePasswordSubmit} className="p-4 sm:p-5 space-y-4 text-xs">
            <div>
              <label className="block text-xs sm:text-sm font-black text-slate-950 dark:text-stone-100 mb-1.5">
                كلمة المرور الجديدة *
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="أدخل كلمة مرور قوية (4 أحرف/أرقام على الأقل)"
                  className="w-full bg-white dark:bg-[#200b14] border-2 border-stone-300 dark:border-[#521c32] focus:border-burgundy-700 dark:focus:border-churchgold-400 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-black text-slate-950 dark:text-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-burgundy-600/20 transition-all"
                />
                <KeyRound className="w-4 h-4 text-churchgold-600 dark:text-churchgold-400 absolute left-3.5 top-3" />
              </div>
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-black text-slate-950 dark:text-stone-100 mb-1.5">
                تأكيد كلمة المرور الجديدة *
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="أعد إدخال كلمة المرور للتأكيد"
                  className="w-full bg-white dark:bg-[#200b14] border-2 border-stone-300 dark:border-[#521c32] focus:border-burgundy-700 dark:focus:border-churchgold-400 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-black text-slate-950 dark:text-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-burgundy-600/20 transition-all"
                />
                <Lock className="w-4 h-4 text-churchgold-600 dark:text-churchgold-400 absolute left-3.5 top-3" />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-amber-200/80 dark:border-[#381622]">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-stone-100 dark:bg-[#250d18] text-slate-700 dark:text-stone-300 font-bold hover:bg-stone-200 cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-black shadow-md cursor-pointer transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>تحديث كلمة المرور</span>
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
};
