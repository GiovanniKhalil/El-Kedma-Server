import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { MONTHS } from '../data/mockData';
import {
  X, Cake, Phone, MessageCircle, Gift, Sparkles,
  Calendar, Search, Filter, CalendarDays
} from 'lucide-react';
import { calculateExactAge, parseBirthDateParts } from '../utils/ageUtils';
import { getWhatsAppHref } from '../utils/phoneHelper';

// Helper function to extract day and month from various date string formats
export function parseBirthDate(birthDateStr?: string, fallbackMonth?: number): { day: number; month: number } {
  const { day, month } = parseBirthDateParts(birthDateStr, fallbackMonth);
  return { day, month };
}

type BirthdayTab = 'today' | 'month' | 'annual';
type PersonCategory = 'مخدوم' | 'خادم' | 'أمين';

interface BirthdayEntry {
  id: string;
  name: string;
  category: PersonCategory;
  stage: string;
  secondaryStages?: string[];
  birthDate?: string;
  day: number;
  month: number;
  age: number;
  responsibleServant: string;
  phone: string;
}

export const BirthdayWidget: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const {
    children,
    servants,
    supervisors,
    users,
    stagesList,
    role,
    currentUser,
    selectedStageScope,
    activeStageName
  } = useApp();

  const today = new Date();
  const todayDay = today.getDate();
  const todayMonth = today.getMonth() + 1;

  // Default tab is Annual (12 months), default selected month is current month
  const [activeTab, setActiveTab] = useState<BirthdayTab>('annual');
  const [selectedAnnualMonth, setSelectedAnnualMonth] = useState<number>(todayMonth);
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('all');

  const userStages = useMemo(
    () =>
      Array.from(
        new Set(
          [
            currentUser?.assignedStage,
            ...(currentUser?.assignedStages || []),
            ...(currentUser?.assignments || []).map((a) => a.stageName)
          ].filter(Boolean)
        )
      ) as string[],
    [currentUser]
  );

  const initialScopedStage = useMemo(() => {
    if (role === 'amin_khedma_am') {
      return selectedStageScope || 'all';
    }
    if (activeStageName && activeStageName !== 'all') {
      return activeStageName;
    }
    return currentUser?.assignedStage || selectedStageScope || 'all';
  }, [role, selectedStageScope, activeStageName, currentUser]);

  useEffect(() => {
    if (isOpen) {
      setActiveTab('annual');
      setSelectedAnnualMonth(new Date().getMonth() + 1);
      setSearchQuery('');
      setStageFilter(initialScopedStage);
    }
  }, [isOpen, initialScopedStage]);

  // Dynamic stages available in the stage dropdown
  const stageDropdownOptions = useMemo(() => {
    if (role === 'amin_khedma_am') {
      return stagesList.map((s) => s.name);
    }
    if (userStages.length > 0) {
      return userStages;
    }
    return stagesList.map((s) => s.name);
  }, [role, stagesList, userStages]);

  // Helper to resolve responsible servant / stage leader
  const resolveStageLeader = useMemo(() => {
    const cache = new Map<string, string>();
    return (stageName: string, assignedServantId?: string): string => {
      if (assignedServantId) {
        const matchedServant = servants.find((s) => s.id === assignedServantId);
        if (matchedServant?.name) return matchedServant.name;
        const matchedUser = users.find((u) => u.id === assignedServantId || u.uid === assignedServantId);
        if (matchedUser?.name) return matchedUser.name;
      }

      const key = stageName || 'عامة';
      if (cache.has(key)) return cache.get(key)!;

      const stageMeta = stagesList.find((st) => st.name === key || st.id === key);
      if (stageMeta?.supervisorName?.trim()) {
        cache.set(key, stageMeta.supervisorName.trim());
        return stageMeta.supervisorName.trim();
      }

      const stageCaptain = supervisors.find(
        (sp) => (sp.supervisedStage === key || sp.assignedStage === key) && !sp.isAssistant
      );
      if (stageCaptain?.name) {
        cache.set(key, stageCaptain.name);
        return stageCaptain.name;
      }

      const stageServantCaptain = servants.find(
        (sv) =>
          (sv.assignedStage === key || sv.assignedStages?.includes(key)) &&
          (sv.roleType === 'captain' || sv.roleType === 'first_mate')
      );
      if (stageServantCaptain?.name) {
        cache.set(key, stageServantCaptain.name);
        return stageServantCaptain.name;
      }

      const anyStageSupervisor = supervisors.find(
        (sp) => sp.supervisedStage === key || sp.assignedStage === key
      );
      if (anyStageSupervisor?.name) {
        cache.set(key, anyStageSupervisor.name);
        return anyStageSupervisor.name;
      }

      const fallback = key === 'عامة' ? 'أمين الخدمة العام' : '—';
      cache.set(key, fallback);
      return fallback;
    };
  }, [servants, users, stagesList, supervisors]);

  // Unified normalized list of all birthday entries (children + servants + supervisors)
  const allEntries = useMemo<BirthdayEntry[]>(() => {
    const entries: BirthdayEntry[] = [];
    const seenKeys = new Set<string>();

    // 1. Children (مخدومين)
    const allowedChildren =
      role === 'amin_khedma_am' || userStages.length === 0
        ? children
        : children.filter(
            (c) =>
              userStages.includes(c.stage) ||
              (c.secondaryStages && c.secondaryStages.some((s) => userStages.includes(s)))
          );

    for (const c of allowedChildren) {
      const { day, month } = parseBirthDate(c.birthDate, c.birthMonth);
      const exactAge = calculateExactAge(c.birthDate, c.age || 0);
      entries.push({
        id: `child-${c.id}`,
        name: c.name,
        category: 'مخدوم',
        stage: c.stage,
        secondaryStages: c.secondaryStages,
        birthDate: c.birthDate,
        day,
        month,
        age: exactAge,
        responsibleServant: resolveStageLeader(c.stage, c.assignedServantId),
        phone: c.parentPhone || c.phone || c.parent2Phone || ''
      });
      seenKeys.add(`child:${c.id}`);
    }

    // 2. Supervisors (أمناء الفصول)
    for (const sp of supervisors) {
      const spStage = sp.supervisedStage || sp.assignedStage || 'عامة';
      const { day, month } = parseBirthDate(sp.birthDate, sp.birthMonth);
      const exactAge = calculateExactAge(sp.birthDate, 0);
      entries.push({
        id: `sup-${sp.id}`,
        name: sp.name,
        category: 'أمين',
        stage: spStage,
        birthDate: sp.birthDate,
        day,
        month,
        age: exactAge,
        responsibleServant: 'أمين الخدمة العام',
        phone: sp.phone || ''
      });
      seenKeys.add(`staff:${sp.name.trim()}`);
    }

    // 3. Servants (خدام) - avoid duplicating supervisors listed in both
    for (const sv of servants) {
      if (sv.is_directory_visible === false) continue;
      if (seenKeys.has(`staff:${sv.name.trim()}`)) continue;
      const svStage = sv.assignedStage || 'عامة';
      const { day, month } = parseBirthDate(sv.birthDate, sv.birthMonth);
      const exactAge = calculateExactAge(sv.birthDate, 0);
      const isLeader =
        sv.roleType === 'captain' ||
        sv.roleType === 'first_mate' ||
        Boolean(sv.roleTitle && (sv.roleTitle.includes('أمين مرحلة') || sv.roleTitle.includes('أمين فصل')));

      entries.push({
        id: `serv-${sv.id}`,
        name: sv.name,
        category: isLeader ? 'أمين' : 'خادم',
        stage: svStage,
        secondaryStages: sv.assignedStages,
        birthDate: sv.birthDate,
        day,
        month,
        age: exactAge,
        responsibleServant: isLeader ? 'أمين الخدمة العام' : resolveStageLeader(svStage),
        phone: sv.phone || ''
      });
    }

    return entries;
  }, [children, servants, supervisors, role, userStages, resolveStageLeader]);

  // Apply stage filter + search query across all entries
  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return allEntries.filter((entry) => {
      const matchesStage =
        stageFilter === 'all' ||
        entry.stage === stageFilter ||
        Boolean(entry.secondaryStages && entry.secondaryStages.includes(stageFilter));

      if (!matchesStage) return false;

      if (!q) return true;
      return (
        entry.name.toLowerCase().includes(q) ||
        entry.stage.toLowerCase().includes(q) ||
        entry.responsibleServant.toLowerCase().includes(q) ||
        entry.phone.includes(q) ||
        entry.category.includes(q)
      );
    });
  }, [allEntries, stageFilter, searchQuery]);

  // Today's & Current Month's counts (respecting active filters)
  const todayEntries = useMemo(
    () =>
      filteredEntries
        .filter((e) => e.month === todayMonth && e.day === todayDay)
        .sort((a, b) => a.name.localeCompare(b.name, 'ar')),
    [filteredEntries, todayMonth, todayDay]
  );

  const currentMonthEntries = useMemo(
    () =>
      filteredEntries
        .filter((e) => e.month === todayMonth)
        .sort((a, b) => a.day - b.day || a.name.localeCompare(b.name, 'ar')),
    [filteredEntries, todayMonth]
  );

  // Per-month statistics for the 12-month grid
  const monthStats = useMemo(() => {
    return MONTHS.map((m) => {
      const list = filteredEntries.filter((e) => e.month === m.value);
      const kidsCount = list.filter((e) => e.category === 'مخدوم').length;
      const staffCount = list.length - kidsCount;
      return {
        ...m,
        total: list.length,
        kidsCount,
        staffCount
      };
    });
  }, [filteredEntries]);

  // Rows displayed in the table below
  const displayedRows = useMemo(() => {
    if (activeTab === 'today') return todayEntries;
    if (activeTab === 'month') return currentMonthEntries;
    return filteredEntries
      .filter((e) => e.month === selectedAnnualMonth)
      .sort((a, b) => a.day - b.day || a.name.localeCompare(b.name, 'ar'));
  }, [activeTab, todayEntries, currentMonthEntries, filteredEntries, selectedAnnualMonth]);

  if (!isOpen) return null;

  const currentMonthLabel = MONTHS.find((m) => m.value === todayMonth)?.label || `شهر ${todayMonth}`;
  const selectedAnnualMonthLabel =
    MONTHS.find((m) => m.value === selectedAnnualMonth)?.label || `شهر ${selectedAnnualMonth}`;

  const getMonthCountLabel = (kidsCount: number, staffCount: number, total: number): string => {
    if (total === 0) return '0 مخدومين';
    if (staffCount === 0) {
      return kidsCount === 1 ? '1 مخدوم' : `${kidsCount} مخدومين`;
    }
    if (kidsCount === 0) {
      return staffCount === 1 ? '1 خادم' : `${staffCount} خدام`;
    }
    return `${kidsCount} مخدومين • ${staffCount} خدام`;
  };

  const getDayFlag = (day: number, month: number) => {
    if (month === todayMonth && day === todayDay) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#7A1523] text-[#FAF7F2] text-[10px] font-black border border-[#D4AF37]/60">
          <Sparkles className="w-2.5 h-2.5 text-[#D4AF37]" />
          <span>اليوم</span>
        </span>
      );
    }
    if (month === todayMonth && day === todayDay + 1) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#D4AF37]/20 text-[#7A1523] dark:text-[#D4AF37] text-[10px] font-black border border-[#D4AF37]/40">
          غداً
        </span>
      );
    }
    return null;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/65 backdrop-blur-xs overflow-y-auto"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-5xl rounded-3xl shadow-2xl border border-[#D4AF37]/45 bg-[#FAF7F2] dark:bg-[#16070d] text-slate-900 dark:text-stone-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col"
      >
        {/* Header - Burgundy & Gold */}
        <div className="bg-gradient-to-r from-[#5E0F1A] via-[#7A1523] to-[#5E0F1A] px-4 sm:px-6 py-4 text-white flex items-center justify-between gap-3 border-b-2 border-[#D4AF37]/60 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-[#D4AF37]/15 border border-[#D4AF37]/60 flex items-center justify-center shrink-0 shadow-xs">
              <Cake className="w-6 h-6 text-[#D4AF37]" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-black text-[#FAF7F2] truncate">
                سجل وتقويم أعياد الميلاد
              </h3>
              <p className="text-[11px] sm:text-xs text-[#F3E3B3] font-semibold truncate">
                متابعة شاملة على مدار 12 شهراً • المرحلة:{' '}
                <strong className="text-[#D4AF37]">
                  {stageFilter === 'all' ? 'جميع المراحل' : stageFilter}
                </strong>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-[#FAF7F2] border border-[#D4AF37]/30 transition-colors cursor-pointer shrink-0"
            aria-label="إغلاق نافذة أعياد الميلاد"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 3 Main Tabs Switcher */}
        <div className="px-4 sm:px-6 pt-3 pb-2.5 bg-[#F3ECE1] dark:bg-[#1d0912] border-b border-[#D4AF37]/30 shrink-0">
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('today')}
              className={`py-2 px-3 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-1.5 sm:gap-2 transition-all cursor-pointer border whitespace-nowrap ${
                activeTab === 'today'
                  ? 'bg-[#7A1523] text-[#FAF7F2] border-[#D4AF37] shadow-sm'
                  : 'bg-white dark:bg-[#240b17] text-[#7A1523] dark:text-stone-200 border-[#D4AF37]/30 hover:border-[#7A1523]/50'
              }`}
            >
              <Sparkles className={`w-4 h-4 shrink-0 ${activeTab === 'today' ? 'text-[#D4AF37]' : 'text-[#7A1523] dark:text-[#D4AF37]'}`} />
              <span>اليوم</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-black tabular-nums ${
                  activeTab === 'today'
                    ? 'bg-[#D4AF37] text-[#3F0810]'
                    : 'bg-[#7A1523]/10 dark:bg-[#7A1523]/40 text-[#7A1523] dark:text-[#F3E3B3]'
                }`}
              >
                {todayEntries.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('month')}
              className={`py-2 px-3 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-1.5 sm:gap-2 transition-all cursor-pointer border whitespace-nowrap ${
                activeTab === 'month'
                  ? 'bg-[#7A1523] text-[#FAF7F2] border-[#D4AF37] shadow-sm'
                  : 'bg-white dark:bg-[#240b17] text-[#7A1523] dark:text-stone-200 border-[#D4AF37]/30 hover:border-[#7A1523]/50'
              }`}
            >
              <Calendar className={`w-4 h-4 shrink-0 ${activeTab === 'month' ? 'text-[#D4AF37]' : 'text-[#7A1523] dark:text-[#D4AF37]'}`} />
              <span>الشهري</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-black tabular-nums ${
                  activeTab === 'month'
                    ? 'bg-[#D4AF37] text-[#3F0810]'
                    : 'bg-[#7A1523]/10 dark:bg-[#7A1523]/40 text-[#7A1523] dark:text-[#F3E3B3]'
                }`}
              >
                {currentMonthEntries.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('annual')}
              className={`py-2 px-3 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-1.5 sm:gap-2 transition-all cursor-pointer border whitespace-nowrap ${
                activeTab === 'annual'
                  ? 'bg-[#7A1523] text-[#FAF7F2] border-[#D4AF37] shadow-sm'
                  : 'bg-white dark:bg-[#240b17] text-[#7A1523] dark:text-stone-200 border-[#D4AF37]/30 hover:border-[#7A1523]/50'
              }`}
            >
              <CalendarDays className={`w-4 h-4 shrink-0 ${activeTab === 'annual' ? 'text-[#D4AF37]' : 'text-[#7A1523] dark:text-[#D4AF37]'}`} />
              <span>السنوي (12 شهر)</span>
            </button>
          </div>

          {/* Search & Dynamic Stage Filter Bar */}
          <div className="mt-2.5 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#7A1523] dark:text-[#D4AF37] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث بالاسم، المرحلة، الخادم المسؤول، أو رقم الهاتف..."
                className="w-full pl-8 pr-9 py-2 bg-white dark:bg-[#240b17] border border-[#D4AF37]/40 dark:border-[#4b1a2a] rounded-xl text-xs font-bold text-slate-800 dark:text-stone-100 placeholder:text-slate-400 dark:placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-[#7A1523]/30"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-slate-400 hover:text-[#7A1523] dark:hover:text-[#D4AF37] cursor-pointer"
                  aria-label="مسح البحث"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 bg-white dark:bg-[#240b17] border border-[#D4AF37]/40 dark:border-[#4b1a2a] rounded-xl px-3 py-1.5 shrink-0">
              <Filter className="w-3.5 h-3.5 text-[#7A1523] dark:text-[#D4AF37] shrink-0" />
              <select
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value)}
                className="bg-transparent text-xs font-black text-slate-800 dark:text-stone-100 focus:outline-none cursor-pointer"
                aria-label="تصفية حسب المرحلة"
              >
                <option value="all" className="dark:bg-[#1a0a12]">
                  {role === 'amin_khedma_am' ? 'جميع المراحل' : 'كل مراحلي'}
                </option>
                {stageDropdownOptions.map((stageName) => (
                  <option key={stageName} value={stageName} className="dark:bg-[#1a0a12]">
                    {stageName}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* ANNUAL VIEW: 12 Months Interactive Grid */}
          {activeTab === 'annual' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-black text-[#7A1523] dark:text-[#D4AF37] flex items-center gap-1.5">
                  <CalendarDays className="w-4 h-4" />
                  <span>اختر شهراً لعرض أعياد ميلاده بالجدول أدناه:</span>
                </span>
                <span className="text-[11px] font-bold text-slate-500 dark:text-stone-400 tabular-nums">
                  إجمالي السجل المصفّى: {filteredEntries.length}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {monthStats.map((m) => {
                  const isSelected = selectedAnnualMonth === m.value;
                  const isCurrentMonth = m.value === todayMonth;

                  return (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setSelectedAnnualMonth(m.value)}
                      className={`p-2.5 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5 ${
                        isSelected
                          ? 'bg-[#7A1523] text-[#FAF7F2] border-[#D4AF37] ring-2 ring-[#D4AF37]/35 shadow-sm'
                          : 'bg-white dark:bg-[#1f0a13] text-slate-800 dark:text-stone-100 border-[#D4AF37]/35 dark:border-[#4b1a2a] hover:border-[#7A1523]/60 hover:bg-[#FAF7F2] dark:hover:bg-[#2a0e1b]'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span
                          className={`text-[10px] font-mono font-bold tabular-nums px-1.5 py-0.5 rounded ${
                            isSelected
                              ? 'bg-[#D4AF37]/20 text-[#D4AF37]'
                              : 'bg-[#FAF7F2] dark:bg-[#2a0e1b] text-slate-500 dark:text-stone-400'
                          }`}
                        >
                          {m.value}
                        </span>
                        <span className="text-xs sm:text-sm font-black">{m.label}</span>
                        {isCurrentMonth && (
                          <span
                            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                              isSelected ? 'bg-[#D4AF37]' : 'bg-[#7A1523] dark:bg-[#D4AF37]'
                            }`}
                            title="الشهر الحالي"
                          />
                        )}
                      </div>

                      <span
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-black tabular-nums border ${
                          isSelected
                            ? 'bg-[#D4AF37] text-[#3F0810] border-[#D4AF37]'
                            : m.total > 0
                              ? 'bg-[#7A1523]/10 dark:bg-[#7A1523]/35 text-[#7A1523] dark:text-[#F3E3B3] border-[#7A1523]/20 dark:border-[#D4AF37]/25'
                              : 'bg-stone-100 dark:bg-[#271019] text-slate-500 dark:text-stone-400 border-stone-200 dark:border-[#3e1725]'
                        }`}
                      >
                        {getMonthCountLabel(m.kidsCount, m.staffCount, m.total)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Active Table Title Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-5 rounded-full bg-[#7A1523] dark:bg-[#D4AF37]" />
              <h4 className="text-sm font-black text-[#7A1523] dark:text-[#FAF7F2]">
                {activeTab === 'today'
                  ? `أعياد ميلاد اليوم (${todayDay} ${currentMonthLabel})`
                  : activeTab === 'month'
                    ? `أعياد ميلاد الشهر الحالي (${currentMonthLabel})`
                    : `أعياد ميلاد شهر ${selectedAnnualMonthLabel}`}
              </h4>
            </div>
            <span className="px-2.5 py-1 rounded-xl bg-white dark:bg-[#240b17] border border-[#D4AF37]/45 text-xs font-black text-[#7A1523] dark:text-[#D4AF37] tabular-nums">
              العدد: {displayedRows.length}
            </span>
          </div>

          {/* Data Table */}
          {displayedRows.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-white dark:bg-[#1f0a13] border border-[#D4AF37]/35 dark:border-[#4b1a2a] space-y-2.5">
              <Gift className="w-11 h-11 text-[#D4AF37] mx-auto opacity-85" />
              <div>
                <p className="font-black text-sm text-[#7A1523] dark:text-[#FAF7F2]">
                  لا توجد أعياد ميلاد مسجلة في هذا العرض
                </p>
                <p className="text-xs text-slate-500 dark:text-stone-400 mt-1">
                  {activeTab === 'today'
                    ? `لا يحتفل أحد بعيد ميلاده بتاريخ اليوم (${todayDay} ${currentMonthLabel}) ضمن الفلترة الحالية.`
                    : activeTab === 'month'
                      ? `لا توجد أعياد ميلاد في شهر ${currentMonthLabel} مطابقة للفلترة.`
                      : `لا توجد أعياد ميلاد في شهر ${selectedAnnualMonthLabel} مطابقة للبحث والمرحلة المحددة.`}
                </p>
              </div>
              {(searchQuery || (role === 'amin_khedma_am' && stageFilter !== 'all')) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setStageFilter('all');
                  }}
                  className="px-4 py-1.5 rounded-xl bg-[#7A1523] hover:bg-[#5E0F1A] text-[#FAF7F2] text-xs font-black border border-[#D4AF37]/50 transition-colors cursor-pointer"
                >
                  إظهار جميع المراحل ومسح البحث
                </button>
              )}
            </div>
          ) : (
            <div className="bg-white dark:bg-[#1f0a13] rounded-2xl border border-[#D4AF37]/40 dark:border-[#4b1a2a] overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#7A1523] text-[#FAF7F2] border-b border-[#D4AF37]/50">
                      <th className="py-3 px-3.5 font-black whitespace-nowrap">تاريخ الميلاد</th>
                      <th className="py-3 px-3.5 font-black whitespace-nowrap">الاسم</th>
                      <th className="py-3 px-3.5 font-black whitespace-nowrap">المرحلة والفصل</th>
                      <th className="py-3 px-3.5 font-black whitespace-nowrap">العمر</th>
                      <th className="py-3 px-3.5 font-black whitespace-nowrap">الخادم المسؤول</th>
                      <th className="py-3 px-3.5 font-black whitespace-nowrap text-center">إجراءات التواصل</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D4AF37]/20 dark:divide-[#3a1322]">
                    {displayedRows.map((row) => {
                      const monthName = MONTHS.find((m) => m.value === row.month)?.label || `${row.month}`;
                      const greetingMsg = `كل سنة وحضرتك طيب يا ${row.name} بمناسبة عيد الميلاد السعيد، بنصلي لك بسنة مباركة مليئة بالنعمة والفرح في كنيسة ماريوحنا بالمعراج 🎂🎉`;
                      const waHref = getWhatsAppHref(row.phone, greetingMsg);

                      return (
                        <tr
                          key={row.id}
                          className="hover:bg-[#FAF7F2] dark:hover:bg-[#280d19] transition-colors"
                        >
                          {/* 1. تاريخ الميلاد */}
                          <td className="py-3 px-3.5 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span className="font-black text-slate-900 dark:text-stone-100 tabular-nums">
                                {row.day} {monthName}
                              </span>
                              {getDayFlag(row.day, row.month)}
                            </div>
                          </td>

                          {/* 2. الاسم (مخدوم vs خادم/أمين) */}
                          <td className="py-3 px-3.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-black text-slate-950 dark:text-stone-50">
                                {row.name}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-black border whitespace-nowrap ${
                                  row.category === 'مخدوم'
                                    ? 'bg-[#7A1523]/10 dark:bg-[#7A1523]/40 text-[#7A1523] dark:text-[#FAF7F2] border-[#7A1523]/25 dark:border-[#7A1523]'
                                    : row.category === 'أمين'
                                      ? 'bg-[#D4AF37]/20 text-[#6B4E00] dark:text-[#D4AF37] border-[#D4AF37]/50'
                                      : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-300/60 dark:border-emerald-800'
                                }`}
                              >
                                {row.category}
                              </span>
                            </div>
                          </td>

                          {/* 3. المرحلة والفصل */}
                          <td className="py-3 px-3.5 whitespace-nowrap">
                            <div className="flex items-center gap-1 flex-wrap">
                              <span className="px-2 py-0.5 rounded-lg bg-[#FAF7F2] dark:bg-[#2a0f1b] border border-[#D4AF37]/40 text-slate-800 dark:text-stone-200 font-bold">
                                {row.stage}
                              </span>
                              {row.secondaryStages && row.secondaryStages.length > 0 && (
                                <span className="text-[10px] font-bold text-[#7A1523] dark:text-[#D4AF37]">
                                  (+{row.secondaryStages.length})
                                </span>
                              )}
                            </div>
                          </td>

                          {/* 4. العمر */}
                          <td className="py-3 px-3.5 whitespace-nowrap font-black text-[#7A1523] dark:text-[#D4AF37] tabular-nums">
                            {row.age > 0 ? `${row.age} سنة` : '—'}
                          </td>

                          {/* 5. الخادم المسؤول */}
                          <td className="py-3 px-3.5 whitespace-nowrap font-bold text-slate-700 dark:text-stone-300">
                            {row.responsibleServant}
                          </td>

                          {/* 6. إجراءات التواصل */}
                          <td className="py-3 px-3.5 whitespace-nowrap">
                            {row.phone ? (
                              <div className="flex items-center justify-center gap-1.5">
                                <a
                                  href={`tel:${row.phone}`}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#7A1523] hover:bg-[#5E0F1A] text-[#FAF7F2] text-[11px] font-bold border border-[#D4AF37]/40 transition-colors"
                                  title={`اتصال: ${row.phone}`}
                                >
                                  <Phone className="w-3.5 h-3.5 text-[#D4AF37]" />
                                  <span>اتصال</span>
                                </a>
                                {waHref && (
                                  <a
                                    href={waHref}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition-colors"
                                    title="تهنئة واتساب"
                                  >
                                    <MessageCircle className="w-3.5 h-3.5" />
                                    <span>واتساب</span>
                                  </a>
                                )}
                              </div>
                            ) : (
                              <span className="block text-center text-[11px] text-slate-400 dark:text-stone-500">
                                لا يوجد رقم
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 bg-[#F3ECE1] dark:bg-[#1d0912] border-t border-[#D4AF37]/35 flex items-center justify-between gap-2 shrink-0 text-xs">
          <span className="font-bold text-[#7A1523] dark:text-[#F3E3B3] tabular-nums">
            أعياد اليوم: {todayEntries.length} • الشهر الحالي ({currentMonthLabel}): {currentMonthEntries.length}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#7A1523] hover:bg-[#5E0F1A] text-[#FAF7F2] font-black border border-[#D4AF37]/50 transition-colors cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
