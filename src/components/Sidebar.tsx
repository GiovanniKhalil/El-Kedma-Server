import React from 'react';
import { useApp, TabId } from '../context/AppContext';
import { 
  Home, BookOpen, Users, UserCheck, ShieldCheck, 
  CalendarCheck, Crown, Cake, LogOut, 
  Settings, RotateCcw, X, ChevronLeft, Layers
} from 'lucide-react';
import { parseBirthDate } from './BirthdayWidget';
import { ThemeToggle } from './ThemeToggle';
import { PWAInstallButton } from './PWAInstallButton';
import { ClassContextSwitcher } from './ClassContextSwitcher';
import { isSafeImageUrl } from '../utils/imageHelper';

interface SidebarProps {
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  onOpenBirthdays: () => void;
  onOpenProfile?: () => void;
  onOpenUserManagement: () => void;
  onOpenServicesManager: () => void;
  onResetData: () => void;
}

interface NavItem {
  id: TabId;
  label: string;
  icon: any;
  badge?: string;
  category: 'main' | 'children' | 'servants' | 'supervisors';
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpenMobile,
  onCloseMobile,
  onOpenBirthdays,
  onOpenProfile,
  onOpenUserManagement,
  onOpenServicesManager,
  onResetData
}) => {
  const { role, activeTab, setActiveTab, currentUser, logout, children, servants, selectedStageScope, activeStageName } = useApp();
  const [showResetConfirm, setShowResetConfirm] = React.useState(false);

  // Compute today's birthdays count
  const today = new Date();
  const todayDay = today.getDate();
  const currentMonthNum = today.getMonth() + 1;

  const effectiveStage =
    role === 'amin_khedma_am'
      ? selectedStageScope
      : activeStageName !== 'all'
        ? activeStageName
        : (currentUser?.assignedStage || selectedStageScope);
  const scopedKids = effectiveStage === 'all' ? children : children.filter(c => c.stage === effectiveStage);
  
  const todayKidsCount = scopedKids.filter(c => {
    const { day, month } = parseBirthDate(c.birthDate, c.birthMonth);
    return month === currentMonthNum && day === todayDay;
  }).length;

  const todayServantsCount = servants.filter(s => {
    const { day, month } = parseBirthDate(s.birthDate, s.birthMonth);
    return month === currentMonthNum && day === todayDay;
  }).length;

  const totalBirthdaysToday = todayKidsCount + todayServantsCount;

  // Nav Items Definitions (Church Sunday School Architecture)
  const navItems: NavItem[] = [
    {
      id: 'home',
      label: 'الرئيسية ولوحة المتابعة',
      icon: Home,
      category: 'main'
    },
    {
      id: 'library',
      label: 'المكتبة والمناهج',
      icon: BookOpen,
      category: 'main'
    },
    {
      id: 'children_attendance',
      label: 'تسجيل حضور المخدومين',
      icon: UserCheck,
      category: 'children',
      badge: 'المدارس'
    },
    {
      id: 'children_directory',
      label: 'دليل المخدومين (الأولاد)',
      icon: Users,
      category: 'children'
    },
    {
      id: 'servants_attendance',
      label: 'تسجيل حضور الخدام',
      icon: CalendarCheck,
      category: 'servants',
      badge: 'التحضير'
    },
    {
      id: 'servants_directory',
      label: 'دليل خدام المراحل',
      icon: ShieldCheck,
      category: 'servants'
    },
    {
      id: 'supervisors_directory',
      label: 'أمناء الخدمة والمراحل',
      icon: Crown,
      category: 'supervisors'
    },
    {
      id: 'supervisors_attendance',
      label: 'تسجيل حضور أمناء المراحل',
      icon: CalendarCheck,
      category: 'supervisors',
      badge: 'قادة'
    }
  ];

  // Filter based on user role
  const isKhadem = role === 'khadem' || role === 'general_dock';
  const isAminFasl = role === 'amin_fasl' || role === 'mosaed_amin';
  const isAminAm =
    role === 'amin_khedma_am' ||
    Boolean(currentUser?.isAdminAssistant) ||
    Boolean(currentUser?.canManageSupervisors);

  const canShowItem = (item: NavItem) => {
    // 1. الخادم العادي: الرئيسية والمكتبة ودليل وحضور مخدومي فصله النشط فقط (بدون أقسام الخدام أو الأمناء)
    if (isKhadem) {
      return (
        item.id === 'home' ||
        item.id === 'library' ||
        item.id === 'children_attendance' ||
        item.id === 'children_directory'
      );
    }

    // 2. أمين المرحلة ومساعد الأمين: مخدومو المرحلة + دليل وحضور خدام المرحلة النشطة
    if (isAminFasl) {
      return item.category === 'main' || item.category === 'children' || item.category === 'servants';
    }

    // 3. الأمين العام / المساعد الإداري: كامل الصلاحيات لجميع الأقسام
    if (isAminAm) {
      return true;
    }

    return false;
  };

  const visibleItems = navItems.filter(canShowItem);

  const mainGroup = visibleItems.filter(i => i.category === 'main');
  const childrenGroup = visibleItems.filter(i => i.category === 'children');
  const servantsGroup = visibleItems.filter(i => i.category === 'servants');
  const supervisorsGroup = visibleItems.filter(i => i.category === 'supervisors');

  const handleSelectTab = (tabId: TabId) => {
    setActiveTab(tabId);
    onCloseMobile();
  };

  const getRoleArabicTitle = () => {
    if (currentUser?.role === 'amin_khedma_am') return 'أمين الخدمة العام';
    if (currentUser?.isAdminAssistant) return 'مساعد إداري للخدمة';
    if (role === 'amin_fasl') return 'أمين مرحلة وفصل';
    if (role === 'mosaed_amin') return 'مساعد أمين مرحلة';
    if (role === 'general_dock') return 'خادم عام';
    return 'خادم فصل';
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div 
          onClick={onCloseMobile}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-40 lg:hidden transition-opacity"
        />
      )}

      {/* Sidebar Container */}
      <aside 
        className={`fixed top-0 bottom-0 right-0 z-50 w-72 bg-[#18080f] text-stone-100 flex flex-col shadow-2xl border-l border-[#3a1421] transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:z-10 no-print ${
          isOpenMobile ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Church Logo & App Header */}
        <div className="p-4 border-b border-[#35121e] flex items-center justify-between bg-[#14060c]">
          <div className="flex items-center gap-3">
            <img 
              src="/church_logo.jpg" 
              alt="شعار كنيسة ماريوحنا المعمدان بالمعراج" 
              className="w-11 h-11 rounded-full object-cover ring-2 ring-churchgold-400 shadow-lg shadow-black/40"
              referrerPolicy="no-referrer"
            />
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="font-extrabold text-sm text-stone-100 tracking-tight leading-tight">
                  كنيسة ماريوحنا
                </h1>
                <span className="p-0.5 px-1.5 rounded-full bg-churchgold-500/20 text-churchgold-300 text-[10px] font-black border border-churchgold-500/30">
                  المعراج
                </span>
              </div>
              <p className="text-[11px] text-stone-400">
                التربية الكنسية • خدمة ماريوحنا
              </p>
            </div>
          </div>

          {/* Close button on mobile */}
          <button
            onClick={onCloseMobile}
            className="p-1.5 rounded-xl bg-[#260c16] text-stone-400 hover:text-stone-100 hover:bg-[#34111f] lg:hidden"
            aria-label="إغلاق القائمة"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current User Card */}
        <div className="p-2.5 mx-2.5 mt-2 rounded-xl bg-[#220b15] border border-[#3e1624] shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              {isSafeImageUrl(currentUser?.avatarUrl) ? (
                <img
                  src={currentUser?.avatarUrl}
                  alt={currentUser?.name || 'صورة الخادم'}
                  className="w-7 h-7 rounded-lg object-cover border border-churchgold-500/40 shrink-0 shadow-xs"
                />
              ) : (
                <div className="w-7 h-7 rounded-lg bg-burgundy-900 text-churchgold-300 border border-churchgold-500/30 flex items-center justify-center font-black text-xs shrink-0 shadow-xs">
                  {currentUser?.name?.slice(0, 2) || 'خ'}
                </div>
              )}
              <div className="overflow-hidden">
                <div className="text-xs font-bold text-stone-100 truncate max-w-[125px]">
                  {currentUser?.name || 'مستخدم'}
                </div>
                <div className="text-[10px] text-churchgold-400 font-bold truncate">
                  {getRoleArabicTitle()} • {activeStageName !== 'all' ? activeStageName : (currentUser?.assignedStage || selectedStageScope)}
                </div>
              </div>
            </div>

            <button
              onClick={() => logout()}
              className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 transition-colors shrink-0 cursor-pointer"
              title="تسجيل الخروج"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Multi-Class Switcher / Admin Stage Scope in Sidebar */}
          <ClassContextSwitcher variant="sidebar" />

          {/* Quick Profile button */}
          {onOpenProfile && (
            <div className="pt-1.5 border-t border-[#351320] text-[10px]">
              <button
                onClick={() => {
                  onOpenProfile();
                  onCloseMobile();
                }}
                className="w-full flex items-center justify-center gap-1 py-1.5 rounded-lg bg-[#2e101d] hover:bg-[#3d1627] text-stone-200 font-bold border border-[#4a1c2f] transition-colors cursor-pointer"
              >
                <span>بياناتي الشخصية</span>
              </button>
            </div>
          )}
        </div>

        {/* Navigation Links Scrollable List */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3.5 scrollbar-thin scrollbar-thumb-[#3a1422]">
          
          {/* Main Section */}
          <div>
            <div className="px-3 mb-1 text-[10px] font-black text-churchgold-400/80 uppercase tracking-wider">
              الرئيسية والمناهج
            </div>
            <div className="space-y-1">
              {mainGroup.map(item => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelectTab(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      isActive 
                        ? 'bg-gradient-to-r from-burgundy-700 to-burgundy-800 text-white shadow-md shadow-black/40 border-r-4 border-churchgold-400' 
                        : 'text-stone-300 hover:bg-[#280e1a] hover:text-churchgold-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-churchgold-300' : 'text-stone-400'}`} />
                      <span>{item.label}</span>
                    </div>
                    {isActive && <ChevronLeft className="w-3.5 h-3.5 text-churchgold-300" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Children Section */}
          {childrenGroup.length > 0 && (
            <div>
              <div className="px-3 mb-1 text-[10px] font-black text-churchgold-400/80 uppercase tracking-wider">
                مخدومي المرحلة (الأولاد)
              </div>
              <div className="space-y-1">
                {childrenGroup.map(item => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelectTab(item.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        isActive 
                          ? 'bg-gradient-to-r from-burgundy-700 to-burgundy-800 text-white shadow-md shadow-black/40 border-r-4 border-churchgold-400' 
                          : 'text-stone-300 hover:bg-[#280e1a] hover:text-churchgold-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className={`w-4 h-4 ${isActive ? 'text-churchgold-300' : 'text-stone-400'}`} />
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold ${
                          isActive ? 'bg-churchgold-400 text-burgundy-950' : 'bg-[#2a0f1b] text-churchgold-300'
                        }`}>
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Servants Section */}
          {servantsGroup.length > 0 && (
            <div>
              <div className="px-3 mb-1 text-[10px] font-black text-churchgold-400/80 uppercase tracking-wider">
                خدام المرحلة
              </div>
              <div className="space-y-1">
                {servantsGroup.map(item => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelectTab(item.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        isActive 
                          ? 'bg-gradient-to-r from-emerald-800 to-emerald-900 text-white shadow-md shadow-black/40 border-r-4 border-churchgold-400' 
                          : 'text-stone-300 hover:bg-[#280e1a] hover:text-churchgold-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className={`w-4 h-4 ${isActive ? 'text-churchgold-300' : 'text-stone-400'}`} />
                        <span>{item.label}</span>
                      </div>
                      {isActive && <ChevronLeft className="w-3.5 h-3.5 text-emerald-300" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Supervisors Section */}
          {supervisorsGroup.length > 0 && (
            <div>
              <div className="px-3 mb-1 text-[10px] font-black text-churchgold-400/80 uppercase tracking-wider">
                أمناء الفصول والمراحل
              </div>
              <div className="space-y-1">
                {supervisorsGroup.map(item => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelectTab(item.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        isActive 
                          ? 'bg-gradient-to-r from-churchgold-700 to-churchgold-800 text-white shadow-md shadow-black/40 border-r-4 border-amber-200' 
                          : 'text-stone-300 hover:bg-[#280e1a] hover:text-churchgold-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className={`w-4 h-4 ${isActive ? 'text-amber-200' : 'text-stone-400'}`} />
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold ${
                          isActive ? 'bg-white text-burgundy-950' : 'bg-[#2a0f1b] text-churchgold-300'
                        }`}>
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* Bottom Utility Actions - Compact & Well-Organized */}
        <div className="p-2.5 border-t border-[#35121e] bg-[#14060c] space-y-1.5">
          {/* Birthday Alert Button */}
          <button
            onClick={() => {
              onOpenBirthdays();
              onCloseMobile();
            }}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-[#2b0e1b] hover:bg-[#391325] text-pink-200 border border-[#521c33] text-xs font-bold transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Cake className="w-3.5 h-3.5 text-pink-400" />
              <span>أعياد الميلاد</span>
            </div>
            {totalBirthdaysToday > 0 ? (
              <span className="px-2 py-0.2 rounded-full bg-rose-600 text-white text-[10px] font-black animate-pulse">
                {totalBirthdaysToday} اليوم!
              </span>
            ) : (
              <span className="text-[10px] text-pink-400/80">عرض الشهر</span>
            )}
          </button>

          {/* Admin Tools: 2-column Compact Grid for General Admin */}
          {isAminAm && (
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => {
                  onOpenServicesManager();
                  onCloseMobile();
                }}
                className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-xl bg-[#230b15] hover:bg-[#320f1f] text-churchgold-300 text-[11px] font-bold border border-churchgold-500/30 transition-all cursor-pointer truncate"
                title="إدارة الخدمات وقاعدة البيانات"
              >
                <Layers className="w-3.5 h-3.5 text-churchgold-400 shrink-0" />
                <span className="truncate">الخدمات</span>
              </button>

              <button
                onClick={() => {
                  onOpenUserManagement();
                  onCloseMobile();
                }}
                className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-xl bg-[#230b15] hover:bg-[#320f1f] text-stone-200 text-[11px] font-bold border border-[#3e1624] transition-colors cursor-pointer truncate"
                title="إدارة المستخدمين والحسابات"
              >
                <Settings className="w-3.5 h-3.5 text-churchgold-400 shrink-0" />
                <span className="truncate">الحسابات</span>
              </button>
            </div>
          )}

          {/* PWA Install shortcut button */}
          <PWAInstallButton variant="sidebar" />

          {/* Utility Row: Theme Switcher & Admin-Only Reset in a clean single strip */}
          <div className="flex items-center justify-between pt-1 border-t border-[#260a16] text-[11px]">
            <ThemeToggle variant="full" />
            {currentUser?.role === 'amin_khedma_am' && (
              <button
                onClick={() => setShowResetConfirm(true)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-[#280e1a] transition-colors cursor-pointer"
                title="استعادة البيانات الافتراضية"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

      </aside>

      {/* In-App Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#1a0813] border border-stone-200 dark:border-[#421527] rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/60 flex items-center justify-center text-amber-600 shrink-0">
                <RotateCcw className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-stone-900 dark:text-stone-100">استعادة البيانات الأصلية</h4>
                <p className="text-xs text-stone-500 dark:text-stone-400">إعادة ضبط المصنع للمنظومة</p>
              </div>
            </div>

            <p className="text-sm text-stone-700 dark:text-stone-300 bg-amber-50/50 dark:bg-amber-950/30 p-3.5 rounded-2xl border border-amber-100 dark:border-amber-900/40">
              هل ترغب في استعادة البيانات الأصلية للكنيسة؟ سيتم إعادة تحميل المراحل والبيانات الافتراضية.
            </p>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => {
                  setShowResetConfirm(false);
                  onResetData();
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-sm"
              >
                تأكيد الاستعادة
              </button>
              <button
                onClick={() => setShowResetConfirm(false)}
                className="py-2.5 px-4 rounded-xl bg-stone-100 dark:bg-[#250c1b] text-stone-700 dark:text-stone-300 hover:bg-stone-200 text-xs font-bold transition-colors cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
