import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Crown, ShieldCheck, Users, ChevronDown, ChevronUp, Phone, 
  MessageCircle, UserCheck, Sparkles, Building2, Layers, ArrowDown
} from 'lucide-react';
import { getWhatsAppHref } from '../utils/phoneHelper';
import { getStageBadgeClass } from '../utils/themeColors';

export const ChurchHierarchyTree: React.FC = () => {
  const { users, servants, supervisors, stagesList, children } = useApp();
  const [collapsedStages, setCollapsedStages] = useState<Record<string, boolean>>({});
  const [showDockList, setShowDockList] = useState(true);

  // 1. Apex of the tree: General Admin(s)
  const generalAdmins = users.filter(u => u.role === 'amin_khedma_am');
  const adminAssistants = users.filter(u => u.isAdminAssistant && u.role !== 'amin_khedma_am');

  // Fallback if no explicit amin_khedma_am found in users
  const primaryAdmin = generalAdmins[0] || {
    id: 'admin_root',
    name: 'أمين الخدمة العام',
    username: '',
    phone: '',
    role: 'amin_khedma_am'
  };

  // 2. Direct branch under General Admin: Servants under distribution (general_dock)
  const dockServants = servants.filter(s => {
    const hasClassAssignment =
      Boolean(s.assignments && s.assignments.some(a => a.stageName && a.stageName !== 'عامة' && a.stageName !== 'في انتظار التعيين')) ||
      Boolean(s.assignedStage && s.assignedStage !== 'عامة' && s.assignedStage !== 'في انتظار التعيين');
    if (hasClassAssignment) return false;
    return s.roleType === 'general_dock' || s.assignedStage === 'عامة' || s.assignedStage === 'في انتظار التعيين' || !s.assignedStage;
  });

  const toggleStageCollapse = (stageName: string) => {
    setCollapsedStages(prev => ({
      ...prev,
      [stageName]: !prev[stageName]
    }));
  };

  return (
    <div className="bg-[#FAF7F2] dark:bg-[#180810] border border-amber-200/90 dark:border-[#381622] rounded-3xl p-4 sm:p-6 shadow-sm space-y-6 transition-colors duration-200 font-['Cairo',sans-serif]">
      
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200/80 dark:border-[#381622] pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-churchgold-600 to-amber-500 text-burgundy-950 flex items-center justify-center font-black shadow-xs">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-stone-100 flex items-center gap-2">
              <span>الهيكل الكنسي والشجري لتوزيع الخدمة</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-churchgold-100 dark:bg-[#341121] text-burgundy-900 dark:text-churchgold-300 font-bold border border-churchgold-300">
                تسلسل هرمي كنسي دقيق
              </span>
            </h3>
            <p className="text-xs text-slate-600 dark:text-stone-400">
              أمين الخدمة العام ⬅️ الخدام تحت التوزيع (مباشر) ⬅️ فروع الفصول والمراحل
            </p>
          </div>
        </div>

        <div className="text-xs font-bold text-slate-500 dark:text-stone-400 flex items-center gap-2">
          <span>{stagesList.length} فصل ومرحلة</span>
          <span>•</span>
          <span>{servants.length} خادم</span>
          <span>•</span>
          <span>{children.length} مخدوم</span>
        </div>
      </div>

      {/* TREE TOP: APEX (أمين الخدمة العام والمساعدون الإداريون) */}
      <div className="flex flex-col items-center">
        <div className="w-full max-w-lg bg-gradient-to-r from-burgundy-950 via-burgundy-900 to-burgundy-950 text-white rounded-3xl p-4 sm:p-5 shadow-lg border-2 border-churchgold-400/60 relative">
          <div className="absolute -top-3.5 right-6 px-3 py-0.5 rounded-full bg-churchgold-500 text-burgundy-950 text-[10px] font-black shadow-xs flex items-center gap-1">
            <Crown className="w-3.5 h-3.5" />
            <span>قمة الهيكل الكنسي للخدمة</span>
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-churchgold-500 to-amber-400 text-burgundy-950 flex items-center justify-center font-black text-lg shadow-md shrink-0">
                👑
              </div>
              <div>
                <h4 className="text-base font-black text-amber-50 flex items-center gap-2">
                  <span>{primaryAdmin.name}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/10 text-churchgold-300 border border-white/10">
                    أمين الخدمة العام
                  </span>
                </h4>
                {primaryAdmin.phone && (
                  <div className="text-xs text-churchgold-200/90 font-mono mt-0.5" dir="ltr">
                    📞 {primaryAdmin.phone}
                  </div>
                )}
              </div>
            </div>

            {primaryAdmin.phone && (
              <div className="flex items-center gap-1.5 shrink-0">
                <a
                  href={`tel:${primaryAdmin.phone}`}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
                  title="اتصال"
                >
                  <Phone className="w-3.5 h-3.5 text-churchgold-300" />
                </a>
                <a
                  href={getWhatsAppHref(primaryAdmin.phone) || '#'}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
                  title="واتساب"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                </a>
              </div>
            )}
          </div>

          {/* Administrative Assistants (المساعدون الإداريون الثابتون إن وجدوا) */}
          {adminAssistants.length > 0 && (
            <div className="mt-3 pt-3 border-t border-churchgold-400/20 space-y-1.5">
              <div className="text-[11px] font-bold text-churchgold-300 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>المساعدون الإداريون المعتمدون ({adminAssistants.length}):</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {adminAssistants.map(asst => (
                  <div key={asst.id} className="px-2.5 py-1 rounded-xl bg-white/10 text-xs font-bold text-stone-100 flex items-center gap-2">
                    <span>👤 {asst.name}</span>
                    {asst.phone && <span className="font-mono text-[10px] text-churchgold-200">({asst.phone})</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Tree Trunk Stem */}
        <div className="w-0.5 h-8 bg-churchgold-500/80 my-1"></div>
        <div className="w-16 h-0.5 bg-churchgold-500/80"></div>
        <div className="flex justify-between w-full max-w-2xl px-8 sm:px-16 -mt-0.5">
          <div className="w-0.5 h-6 bg-amber-500/70"></div>
          <div className="w-0.5 h-6 bg-churchgold-600/70"></div>
        </div>
      </div>

      {/* TWO PRIMARY TREE BRANCHES */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* BRANCH 1: DIRECT UNDER GENERAL ADMIN (الخدام تحت التوزيع general_dock) */}
        <div className="lg:col-span-4 space-y-3">
          <div className="bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent dark:from-[#2a111e] dark:to-[#1a0a12] border-2 border-amber-400/80 dark:border-amber-700/60 rounded-3xl p-4 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-500 text-burgundy-950 flex items-center justify-center font-black text-xs">
                  ⚡
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-900 dark:text-stone-100">
                    الخدام تحت التوزيع (خدمة عامة)
                  </h4>
                  <p className="text-[10px] text-amber-800 dark:text-amber-300 font-bold">
                    إشراف مباشر لأمين الخدمة العام (Direct)
                  </p>
                </div>
              </div>

              <span className="px-2 py-0.5 rounded-full bg-amber-200/70 dark:bg-amber-950 text-amber-950 dark:text-amber-200 text-xs font-black">
                {dockServants.length} خادم
              </span>
            </div>

            <p className="text-[11px] text-slate-600 dark:text-stone-400 leading-relaxed">
              هؤلاء الخدام يتبعون أمين الخدمة العام مباشرة لحين إسنادهم لفصول ومراحل محددة.
            </p>

            {dockServants.length === 0 ? (
              <div className="p-4 rounded-2xl bg-white/80 dark:bg-[#200914] text-center text-[11px] text-slate-500 font-bold border border-amber-200/60">
                جميع الخدام مسكنون حالياً داخل فصول الخدمة.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
                {dockServants.map(s => (
                  <div key={s.id} className="p-2.5 rounded-xl bg-white dark:bg-[#220c18] border border-amber-200/80 dark:border-[#421626] flex items-center justify-between text-xs shadow-2xs">
                    <div>
                      <div className="font-black text-slate-900 dark:text-stone-100 flex items-center gap-1">
                        <span>خ/ {s.name}</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 font-bold">
                          عام
                        </span>
                      </div>
                      {s.phone && (
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5" dir="ltr">
                          {s.phone}
                        </div>
                      )}
                    </div>

                    {s.phone && (
                      <div className="flex items-center gap-1 shrink-0">
                        <a
                          href={`tel:${s.phone}`}
                          className="p-1 rounded-lg bg-stone-100 dark:bg-[#341121] text-slate-700 dark:text-stone-300 hover:bg-stone-200"
                          title="اتصال"
                        >
                          <Phone className="w-3 h-3" />
                        </a>
                        <a
                          href={getWhatsAppHref(s.phone) || '#'}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600"
                          title="واتساب"
                        >
                          <MessageCircle className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* BRANCH 2: CLASS & STAGE HIERARCHY BRANCHES (فروع الفصول والمراحل) */}
        <div className="lg:col-span-8 space-y-3">
          <div className="flex items-center justify-between px-1">
            <h4 className="text-xs font-black text-slate-900 dark:text-stone-100 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-churchgold-600" />
              <span>فروع المراحل والفصول الخدمية ({stagesList.length})</span>
            </h4>
            <span className="text-[11px] text-slate-500 dark:text-stone-400">
              التسلسل: أمين الفصل ⬅️ المساعدون ⬅️ الخدام ⬅️ المخدومون
            </span>
          </div>

          <div className="space-y-3">
            {stagesList.map(st => {
              const isCollapsed = Boolean(collapsedStages[st.name]);
              
              // 1. Stage Leader (أمين الفصل - 1)
              const stageLeader =
                supervisors.find(sp => sp.supervisedStage === st.name && !sp.isAssistant) ||
                servants.find(s => s.roleType === 'captain' && s.assignedStage === st.name);
              const leaderName = stageLeader?.name || st.supervisorName || st.captainName || 'في انتظار التعيين';
              const leaderPhone = stageLeader?.phone || st.supervisorPhone || st.captainPhone;

              // 2. Assistants (مساعدو أمين الفصل - 0+)
              const stageAssistants = [
                ...supervisors.filter(sp => sp.supervisedStage === st.name && sp.isAssistant),
                ...servants.filter(s => s.roleType === 'first_mate' && s.assignedStage === st.name),
                ...(st.assistantSupervisors || []).map(a => ({ id: a.name, name: a.name, phone: a.phone }))
              ];
              // Deduplicate assistants by name
              const uniqueAssistants = Array.from(new Map(stageAssistants.map(a => [a.name, a])).values());

              // 3. Regular Servants (الخدام العاديون - 0+)
              const stageRegularServants = servants.filter(s => {
                const servesHere =
                  s.assignedStage === st.name ||
                  Boolean(s.assignedStages && s.assignedStages.includes(st.name)) ||
                  Boolean(s.assignments && s.assignments.some(a => a.stageName === st.name && a.role === 'khadem'));
                return servesHere && s.roleType !== 'captain' && s.roleType !== 'first_mate';
              });

              // 4. Total Makhdomeen (إجمالي المخدومين - 0+)
              const stageKids = children.filter(c => c.stage === st.name || (c.secondaryStages && c.secondaryStages.includes(st.name)));

              return (
                <div
                  key={st.id || st.name}
                  className="bg-white dark:bg-[#1e0a15] border border-amber-200/90 dark:border-[#3e1423] rounded-2xl overflow-hidden shadow-2xs transition-all hover:border-churchgold-400/80"
                >
                  {/* Class Header Bar */}
                  <div
                    onClick={() => toggleStageCollapse(st.name)}
                    className="p-3.5 bg-stone-50/90 dark:bg-[#250d1a] flex items-center justify-between gap-3 cursor-pointer select-none border-b border-amber-100 dark:border-[#381622]"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black border ${getStageBadgeClass(st.name)}`}>
                        {st.name}
                      </span>
                      {st.meetingTime && (
                        <span className="text-[10px] text-slate-500 font-bold truncate">
                          ⏰ {st.meetingTime}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-[11px] font-bold text-slate-600 dark:text-stone-300 flex items-center gap-2">
                        <span>👤 {leaderName}</span>
                        <span>•</span>
                        <span>👦 {stageKids.length} ولد</span>
                      </div>
                      {isCollapsed ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronUp className="w-4 h-4 text-slate-400" />}
                    </div>
                  </div>

                  {/* Class Details Tree Body */}
                  {!isCollapsed && (
                    <div className="p-4 space-y-3.5 text-xs">
                      
                      {/* Step 1: Amin El-Fasl */}
                      <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-[#280e1c] border border-amber-300/80 dark:border-[#4d1f2e] flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span className="w-7 h-7 rounded-lg bg-churchgold-500 text-burgundy-950 font-black text-xs flex items-center justify-center">
                            👑
                          </span>
                          <div>
                            <div className="font-black text-slate-950 dark:text-stone-100 flex items-center gap-1.5">
                              <span>أمين الفصل: {leaderName}</span>
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-200/80 text-burgundy-950 font-black">
                                مسؤول أول
                              </span>
                            </div>
                            {leaderPhone && (
                              <div className="text-[10px] text-slate-600 dark:text-stone-400 font-mono mt-0.5" dir="ltr">
                                📞 {leaderPhone}
                              </div>
                            )}
                          </div>
                        </div>

                        {leaderPhone && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <a
                              href={`tel:${leaderPhone}`}
                              className="p-1.5 rounded-lg bg-white dark:bg-[#1a0810] text-slate-700 dark:text-stone-300 hover:bg-stone-100"
                              title="اتصال"
                            >
                              <Phone className="w-3 h-3" />
                            </a>
                            <a
                              href={getWhatsAppHref(leaderPhone) || '#'}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600"
                              title="واتساب"
                            >
                              <MessageCircle className="w-3 h-3" />
                            </a>
                          </div>
                        )}
                      </div>

                      {/* Step 2: Mosaedo Amin El-Fasl */}
                      {uniqueAssistants.length > 0 && (
                        <div className="pl-4 pr-2 space-y-1.5 border-r-2 border-churchgold-400">
                          <div className="text-[11px] font-bold text-slate-700 dark:text-stone-300 flex items-center gap-1.5">
                            <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                            <span>مساعدو أمين الفصل ({uniqueAssistants.length}):</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {uniqueAssistants.map((asst, idx) => (
                              <div key={idx} className="p-2 rounded-lg bg-stone-50 dark:bg-[#180810] border border-amber-200/60 dark:border-[#3d1523] flex items-center justify-between text-xs">
                                <div>
                                  <div className="font-bold text-slate-900 dark:text-stone-100">
                                    خ/ {asst.name}
                                  </div>
                                  {asst.phone && <div className="text-[10px] text-slate-500 font-mono" dir="ltr">{asst.phone}</div>}
                                </div>
                                {asst.phone && (
                                  <a
                                    href={getWhatsAppHref(asst.phone) || '#'}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-1 text-emerald-600 hover:underline"
                                    title="واتساب"
                                  >
                                    <MessageCircle className="w-3.5 h-3.5" />
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Step 3: Regular Servants */}
                      <div className="pl-4 pr-2 space-y-1.5 border-r-2 border-slate-300 dark:border-stone-700">
                        <div className="text-[11px] font-bold text-slate-700 dark:text-stone-300 flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-churchgold-600" />
                          <span>خدام الفصل المباشرون ({stageRegularServants.length}):</span>
                        </div>

                        {stageRegularServants.length === 0 ? (
                          <div className="text-[11px] text-slate-400 italic">
                            لم يتم إسناد خدام عاديين لهذا الفصل بعد.
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {stageRegularServants.map(srv => (
                              <div key={srv.id} className="px-2.5 py-1 rounded-xl bg-stone-50 dark:bg-[#1a0812] border border-stone-200 dark:border-[#381622] text-xs font-bold text-slate-800 dark:text-stone-200 flex items-center gap-1.5">
                                <span>✝️ {srv.name}</span>
                                {srv.phone && (
                                  <a
                                    href={getWhatsAppHref(srv.phone) || '#'}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-emerald-600 hover:text-emerald-700"
                                  >
                                    <MessageCircle className="w-3 h-3" />
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Step 4: Makhdomeen Count Badge */}
                      <div className="pt-2 border-t border-amber-100/60 dark:border-[#381622] flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-stone-300">
                        <div className="flex items-center gap-1.5">
                          <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                          <span>إجمالي الأولاد المقيدين بالفصل:</span>
                          <strong className="text-burgundy-900 dark:text-churchgold-300 font-black">{stageKids.length} مخدوم</strong>
                        </div>
                        <span className="text-[10px] text-slate-400">
                          نسبة خادم لكل {(stageKids.length / Math.max(1, stageRegularServants.length + 1)).toFixed(1)} مخدوم
                        </span>
                      </div>

                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

      </div>

    </div>
  );
};
