import React, { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { ClassAssignment, ClassAssignmentRole } from '../types';
import { Layers, ShieldCheck, ArrowLeftRight, Crown } from 'lucide-react';

interface ClassContextSwitcherProps {
  variant?: 'header' | 'sidebar';
}

const ROLE_ARABIC_LABEL: Record<string, string> = {
  amin_khedma_am: 'أمين الخدمة العام',
  amin_fasl: 'أمين مرحلة',
  mosaed_amin: 'مساعد أمين',
  khadem: 'خادم',
  general_dock: 'خادم عام'
};

export const ClassContextSwitcher: React.FC<ClassContextSwitcherProps> = ({
  variant = 'header'
}) => {
  const {
    currentUser,
    stagesList,
    activeStageId,
    activeStageName,
    activeRoleInStage,
    selectedStageScope,
    setActiveStageContext,
    children
  } = useApp();

  const isGeneralAdmin =
    currentUser?.role === 'amin_khedma_am' || Boolean(currentUser?.isAdminAssistant);

  const userAssignments: ClassAssignment[] = useMemo(() => {
    if (!currentUser || isGeneralAdmin) return [];
    const list: ClassAssignment[] = [];
    const seen = new Set<string>();

    if (Array.isArray(currentUser.assignments) && currentUser.assignments.length > 0) {
      currentUser.assignments.forEach(a => {
        if (!a || (!a.stageId && !a.stageName)) return;
        const matched = stagesList.find(s => s.id === a.stageId || s.name === a.stageName);
        const stageId = matched?.id || a.stageId || a.stageName;
        const stageName = matched?.name || a.stageName || a.stageId;
        if (!stageName || stageName === 'في انتظار التعيين' || seen.has(stageName)) return;
        seen.add(stageName);
        const roleVal: ClassAssignmentRole =
          a.role === 'amin_fasl' || a.role === 'mosaed_amin' || a.role === 'khadem'
            ? a.role
            : 'khadem';
        list.push({ stageId, stageName, role: roleVal });
      });
    } else {
      const primary = (currentUser.assignedStage || '').trim();
      if (primary && primary !== 'عامة' && primary !== 'في انتظار التعيين') {
        const matched = stagesList.find(s => s.id === primary || s.name === primary);
        const roleVal: ClassAssignmentRole =
          currentUser.role === 'amin_fasl' || currentUser.role === 'mosaed_amin'
            ? currentUser.role
            : 'khadem';
        seen.add(matched?.name || primary);
        list.push({
          stageId: matched?.id || primary,
          stageName: matched?.name || primary,
          role: roleVal
        });
      }
      if (Array.isArray(currentUser.assignedStages)) {
        currentUser.assignedStages.forEach(st => {
          const clean = (st || '').trim();
          if (!clean || clean === 'عامة' || clean === 'في انتظار التعيين' || seen.has(clean)) return;
          const matched = stagesList.find(s => s.id === clean || s.name === clean);
          seen.add(matched?.name || clean);
          list.push({
            stageId: matched?.id || clean,
            stageName: matched?.name || clean,
            role: 'khadem'
          });
        });
      }
    }

    return list;
  }, [currentUser, isGeneralAdmin, stagesList]);

  if (!currentUser) return null;

  // Case 1: General Admin / Admin Assistant -> Can inspect all stages or filter into a specific stage
  if (isGeneralAdmin) {
    if (variant === 'sidebar') {
      return (
        <div className="pt-1.5 border-t border-[#351320]">
          <label className="text-[10px] font-bold text-stone-400 flex items-center gap-1 mb-1">
            <Layers className="w-3 h-3 text-churchgold-400" />
            <span>نطاق المرحلة المعروضة:</span>
          </label>
          <select
            value={selectedStageScope}
            onChange={(e) => setActiveStageContext(e.target.value)}
            className="w-full bg-[#1a0810] border border-[#4a1c2f] rounded-lg px-2 py-1 text-[11px] font-bold text-churchgold-300 focus:outline-none cursor-pointer"
          >
            <option value="all">جميع المراحل ({children.length} ولد)</option>
            {stagesList.map(st => (
              <option key={st.id} value={st.name}>
                {st.name}
              </option>
            ))}
          </select>
        </div>
      );
    }

    return (
      <div className="hidden md:flex items-center gap-1.5 bg-[#fdfbf7] dark:bg-[#230d17] border border-amber-200/80 dark:border-[#4c1c2b] rounded-xl px-2.5 py-1 text-xs shadow-2xs">
        <Layers className="w-3.5 h-3.5 text-burgundy-700 dark:text-churchgold-400 shrink-0" />
        <span className="text-[11px] font-bold text-slate-500 dark:text-stone-400 hidden lg:inline">
          عرض المرحلة:
        </span>
        <select
          value={selectedStageScope}
          onChange={(e) => setActiveStageContext(e.target.value)}
          id="header-stage-scope-select"
          className="bg-transparent font-bold text-slate-800 dark:text-stone-200 text-xs focus:outline-none cursor-pointer"
        >
          <option value="all" className="dark:bg-[#1f0b14] dark:text-white">
            جميع المراحل ({children.length} ولد)
          </option>
          {stagesList.map(st => (
            <option key={st.id} value={st.name} className="dark:bg-[#1f0b14] dark:text-white">
              {st.name}
            </option>
          ))}
        </select>
      </div>
    );
  }

  // Case 2: Multi-Class Tree Context Switcher for Servants / Stage Leaders in >1 stage
  if (userAssignments.length > 1) {
    const selectedValue =
      userAssignments.find(a => a.stageId === activeStageId || a.stageName === activeStageName)?.stageId ||
      userAssignments[0].stageId;

    if (variant === 'sidebar') {
      return (
        <div className="pt-1.5 border-t border-[#351320]">
          <label className="text-[10px] font-bold text-churchgold-300 flex items-center gap-1 mb-1">
            <ArrowLeftRight className="w-3 h-3 text-churchgold-400" />
            <span>تبديل الفصل / الدور ({userAssignments.length} فصول):</span>
          </label>
          <select
            value={selectedValue}
            onChange={(e) => setActiveStageContext(e.target.value)}
            className="w-full bg-[#1a0810] border border-churchgold-500/40 rounded-lg px-2 py-1.5 text-[11px] font-bold text-stone-100 focus:outline-none cursor-pointer"
          >
            {userAssignments.map(a => (
              <option key={a.stageId} value={a.stageId}>
                {a.stageName} — ({ROLE_ARABIC_LABEL[a.role] || a.role})
              </option>
            ))}
          </select>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-1.5 bg-gradient-to-r from-amber-50 to-burgundy-50 dark:from-[#260f18] dark:to-[#1f0b14] border border-churchgold-400/70 dark:border-churchgold-500/40 rounded-xl px-2.5 py-1 text-xs shadow-2xs">
        <ArrowLeftRight className="w-3.5 h-3.5 text-burgundy-700 dark:text-churchgold-400 shrink-0" />
        <span className="text-[11px] font-bold text-slate-600 dark:text-stone-300 hidden xl:inline">
          الفصل النشط:
        </span>
        <select
          value={selectedValue}
          onChange={(e) => setActiveStageContext(e.target.value)}
          id="class-context-switcher-select"
          aria-label="تبديل الفصل والدور"
          className="bg-transparent font-extrabold text-burgundy-900 dark:text-churchgold-300 text-xs focus:outline-none cursor-pointer max-w-[165px] sm:max-w-[230px]"
        >
          {userAssignments.map(a => (
            <option key={a.stageId} value={a.stageId} className="dark:bg-[#1f0b14] dark:text-white">
              {a.stageName} ({ROLE_ARABIC_LABEL[a.role] || a.role})
            </option>
          ))}
        </select>
      </div>
    );
  }

  // Case 3: Single Class or General Servant -> Read-Only Context Badge
  const displayStage =
    activeStageName !== 'all'
      ? activeStageName
      : currentUser.assignedStage || selectedStageScope || 'عامة';
  const displayRole =
    activeRoleInStage !== 'all' ? ROLE_ARABIC_LABEL[activeRoleInStage] : ROLE_ARABIC_LABEL[currentUser.role];

  if (variant === 'sidebar') {
    return null;
  }

  return (
    <div
      className="hidden sm:flex items-center gap-1.5 bg-burgundy-50 dark:bg-[#260f18] border border-burgundy-200/70 dark:border-[#4d1f2e] text-burgundy-900 dark:text-churchgold-300 rounded-xl px-2.5 py-1 text-xs font-bold shadow-2xs"
      title={`${displayStage}${displayRole ? ` - ${displayRole}` : ''}`}
    >
      {activeRoleInStage === 'amin_fasl' || activeRoleInStage === 'mosaed_amin' ? (
        <Crown className="w-3.5 h-3.5 text-churchgold-600 dark:text-churchgold-400 shrink-0" />
      ) : (
        <ShieldCheck className="w-3.5 h-3.5 text-burgundy-700 dark:text-churchgold-400 shrink-0" />
      )}
      <span className="truncate max-w-[140px]">{displayStage}</span>
      {displayRole && (
        <span className="hidden lg:inline text-[10px] px-1.5 py-0.5 rounded-md bg-white/80 dark:bg-[#18080f] text-burgundy-700 dark:text-churchgold-300 border border-burgundy-200/50 dark:border-[#3e1624]">
          {displayRole}
        </span>
      )}
    </div>
  );
};
