import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { X, Calendar, Plus, Trash2, CheckCircle2, AlertCircle, Sparkles, ToggleLeft, ToggleRight } from 'lucide-react';
import { SeasonalEvent } from '../types';

interface SeasonalEventsManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SeasonalEventsManager: React.FC<SeasonalEventsManagerProps> = ({ isOpen, onClose }) => {
  const { seasonalEvents, addSeasonalEvent, updateSeasonalEvent, deleteSeasonalEvent, stagesList, role, currentUser } = useApp();

  const [eventName, setEventName] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  const [stageScope, setStageScope] = useState('all');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  if (role !== 'amin_khedma_am' && !currentUser?.isAdminAssistant) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
        <div className="bg-white dark:bg-[#1a0a12] border border-amber-200 dark:border-[#3e1423] rounded-3xl max-w-md w-full p-6 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
          <h3 className="text-lg font-bold text-slate-900 dark:text-stone-100">صلاحية مقتصرة</h3>
          <p className="text-xs text-slate-600 dark:text-stone-400">
            إدارة المناسبات الموسمية مقتصرة حصرياً على أمين الخدمة العام.
          </p>
          <button onClick={onClose} className="px-5 py-2 bg-burgundy-900 text-amber-50 rounded-xl text-xs font-bold cursor-pointer">
            إغلاق
          </button>
        </div>
      </div>
    );
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const name = eventName.trim();
    if (!name) {
      setErrorMsg('يرجى إدخال اسم المناسبة أو المهرجان');
      return;
    }

    try {
      await addSeasonalEvent({
        name,
        startDate,
        endDate: endDate || undefined,
        stageScope,
        isActive: true
      });
      setSuccessMsg(`تمت إضافة المناسبة "${name}" بنجاح وتفعيلها!`);
      setEventName('');
      setEndDate('');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err?.message || 'حدث خطأ أثناء إضافة المناسبة');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-[#1a0a12] rounded-3xl max-w-2xl w-full shadow-2xl border border-amber-200/80 dark:border-[#3e1423] overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-4 max-h-[92vh] flex flex-col transition-colors">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-burgundy-950 via-burgundy-900 to-burgundy-950 p-5 text-white flex items-center justify-between shrink-0 border-b border-churchgold-400/20">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-gradient-to-tr from-churchgold-600 to-amber-500 text-burgundy-950 shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-amber-50">إدارة المناسبات والمهرجانات الموسمية</h3>
              <p className="text-xs text-churchgold-300">أضف مؤتمرات أو مهرجانات الصيف لتظهر تلقائياً في سجلات الحضور</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-white/10 text-amber-200/80 hover:text-white transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {successMsg && (
            <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 text-rose-800 dark:text-rose-200 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Add Form */}
          <form onSubmit={handleAdd} className="p-4 rounded-2xl bg-stone-50 dark:bg-[#200a14] border border-amber-200/80 dark:border-[#381622] space-y-3">
            <div className="text-xs font-black text-slate-900 dark:text-stone-100 flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-churchgold-600" />
              <span>إضافة مناسبة أو مهرجان جديد</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-700 dark:text-stone-300 mb-1">اسم المناسبة / المهرجان *</label>
                <input
                  type="text"
                  required
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  placeholder="مثال: مهرجان الكرازة المرقسية 2026، مؤتمر الشباب..."
                  className="w-full bg-white dark:bg-[#280c18] border border-amber-200/80 dark:border-[#4d1f2e] rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-stone-100 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-stone-300 mb-1">تاريخ البدء *</label>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-white dark:bg-[#280c18] border border-amber-200/80 dark:border-[#4d1f2e] rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-stone-100 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-stone-300 mb-1">تاريخ الانتهاء (اختياري)</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-white dark:bg-[#280c18] border border-amber-200/80 dark:border-[#4d1f2e] rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-stone-100 focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-700 dark:text-stone-300 mb-1">نطاق المرحلة المستهدفة</label>
                <select
                  value={stageScope}
                  onChange={(e) => setStageScope(e.target.value)}
                  className="w-full bg-white dark:bg-[#280c18] border border-amber-200/80 dark:border-[#4d1f2e] rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-stone-100 focus:outline-none cursor-pointer"
                >
                  <option value="all">عام لكافة مراحل الكنيسة</option>
                  {stagesList.map(st => (
                    <option key={st.id || st.name} value={st.name}>مرحلة {st.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                className="px-4 py-2 bg-gradient-to-r from-churchgold-600 to-amber-600 hover:from-churchgold-700 hover:to-amber-700 text-burgundy-950 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>حفظ وتفعيل المناسبة</span>
              </button>
            </div>
          </form>

          {/* List */}
          <div className="space-y-2.5">
            <div className="text-xs font-black text-slate-700 dark:text-stone-300 px-1">
              المناسبات والمهرجانات المسجلة ({seasonalEvents.length}):
            </div>

            {seasonalEvents.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-stone-50 dark:bg-[#200a14] border border-dashed border-amber-200/80 dark:border-[#381622] text-xs text-slate-500">
                لا توجد مناسبات موسمية مسجلة حالياً. أضف مناسبة جديدة بالأعلى.
              </div>
            ) : (
              <div className="space-y-2">
                {seasonalEvents.map(ev => (
                  <div key={ev.id} className="p-3.5 rounded-2xl bg-white dark:bg-[#240b17] border border-amber-200/80 dark:border-[#3e1423] flex items-center justify-between gap-3 shadow-2xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-slate-900 dark:text-stone-100 text-xs sm:text-sm">{ev.name}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${ev.isActive ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-400'}`}>
                          {ev.isActive ? 'نشط حالياً ✓' : 'مؤرشف'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-stone-400 flex items-center gap-3">
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3 text-churchgold-600" /> من {ev.startDate} {ev.endDate ? `إلى ${ev.endDate}` : ''}</span>
                        <span>•</span>
                        <span>النطاق: {ev.stageScope === 'all' ? 'كافة المراحل' : ev.stageScope}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => updateSeasonalEvent(ev.id, { isActive: !ev.isActive })}
                        className={`p-2 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors ${ev.isActive ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-[#341121] dark:text-stone-300'}`}
                        title={ev.isActive ? 'تعطيل وأرشفة' : 'تفعيل'}
                      >
                        {ev.isActive ? <ToggleRight className="w-5 h-5 text-emerald-600" /> : <ToggleLeft className="w-5 h-5 text-stone-400" />}
                      </button>

                      <button
                        onClick={() => deleteSeasonalEvent(ev.id)}
                        className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 text-rose-600 transition-colors cursor-pointer"
                        title="حذف المناسبة"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
};
