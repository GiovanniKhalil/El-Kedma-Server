// ============================================================================
// Domain Model: Multi-Class Tree Hierarchy & Strict RBAC
// ============================================================================

export type ServantRoleType =
  | 'amin_khedma_am'
  | 'amin_fasl'
  | 'mosaed_amin'
  | 'khadem'
  | 'general_dock';

export type ClassAssignmentRole = 'amin_fasl' | 'mosaed_amin' | 'khadem';

export type Role = ServantRoleType;

export type ThemeMode = 'light' | 'dark';

export type Stage = string;

export interface ClassAssignment {
  stageId: string;
  stageName: string;
  role: ClassAssignmentRole;
}

export interface AssistantSupervisor {
  name: string;
  phone?: string;
}

export interface StageItem {
  id: string;
  name: string;
  description?: string;
  supervisorName?: string;
  supervisorPhone?: string;
  assistantSupervisors?: AssistantSupervisor[];
  captainName?: string;
  captainPhone?: string;
  firstMateName?: string;
  firstMatePhone?: string;
  meetingTime?: string;
  isCustom?: boolean;
}

/**
 * Unified Multi-Assignment Account (Servant / Stage Leader / General Admin)
 */
export interface AppUser {
  id: string;
  uid?: string;
  username: string;
  authEmail?: string;
  name: string;
  fullName?: string;
  phone?: string;
  avatarUrl?: string;
  role: Role;
  assignedStage: Stage;
  assignedStages?: Stage[];
  assignments?: ClassAssignment[];
  isProtectedRoot?: boolean;
  isAdminAssistant?: boolean;
  canAssignMakhdomeen?: boolean;
  mustChangePassword?: boolean;
  isTempPassword?: boolean;
  password?: string;
  passwordHash?: string;
  job?: string;
  area?: string;
  birthDate?: string;
  notes?: string;
  canManageSupervisors?: boolean;
  isAuthorizedAdmin?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type Account = AppUser;
export type User = AppUser;

/**
 * Isolated Pending Servant Registration (unauthenticated submission -> admin review)
 */
export interface PendingRegistration {
  id: string;
  fullName: string;
  username: string;
  phone: string;
  birthDate?: string;
  notes?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

/**
 * Announcement / Event Notification
 */
export type AnnouncementTargetScope = 'all' | 'general_dock' | 'specific_stages';

export interface ChurchEventNotification {
  id: string;
  title: string;
  description: string;
  date: string; // YYYY-MM-DD
  time?: string;
  targetStage: Stage;
  targetScope?: AnnouncementTargetScope;
  targetStages?: Stage[];
  type: 'event' | 'alert' | 'spiritual' | 'meeting';
  createdBy?: string;
  createdAt?: string;
}

export type Announcement = ChurchEventNotification;

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

/**
 * Child / Makhdoom (Record-Only, No Login)
 */
export interface Child {
  id: string;
  name: string;
  stageId?: string;
  stage: Stage;
  secondaryStages?: Stage[];
  assignedServantId?: string;
  age: number;
  birthDate: string; // YYYY-MM-DD
  birthMonth: number; // 1-12
  area?: string;
  phone: string;
  // Primary Guardian
  parentName: string;
  parentRelation?: string;
  parentPhone: string;
  parentJob?: string;
  // Secondary Guardian
  parent2Name?: string;
  parent2Relation?: string;
  parent2Phone?: string;
  parent2Job?: string;
  address?: string;
  notes?: string;
  gender: 'boy' | 'girl';
  createdAt: string;
}

export interface Servant {
  id: string;
  name: string;
  assignedStage: Stage;
  assignedStages?: Stage[];
  assignments?: ClassAssignment[];
  area?: string;
  phone: string;
  job?: string;
  birthDate: string;
  birthMonth: number;
  roleTitle?: string;
  roleType?: 'captain' | 'first_mate' | 'crew' | 'general_dock';
  email?: string;
  notes?: string;
  is_directory_visible?: boolean;
  createdAt: string;
}

export interface Supervisor {
  id: string;
  name: string;
  supervisedStage?: Stage;
  assignedStage?: Stage;
  title?: string;
  isAssistant?: boolean;
  roleType?: 'supervisor' | 'assistant_supervisor';
  area?: string;
  phone: string;
  job?: string;
  birthDate?: string;
  birthMonth?: number;
  email?: string;
  notes?: string;
  is_directory_visible?: boolean;
  createdAt: string;
}

export type BookCategory =
  | 'spiritual'
  | 'preparation'
  | 'khedma'
  | 'mahrajan'
  | 'aqeda_taqs'
  | 'bible'
  | string;

export type BookVisibility = 'all' | 'specific_stages';

export interface Book {
  id: string;
  title: string;
  category: BookCategory;
  visibility?: BookVisibility;
  targetStage: Stage;
  targetStages?: Stage[];
  author?: string;
  year?: string;
  description: string;
  contentSummary?: string;
  pdfUrl?: string;
  pdfFileName?: string;
  pdfFileSize?: string;
  coverImage?: string;
  fileUrl?: string;
  coverBg?: string;
  pageCount?: number;
}

export interface SeasonalEvent {
  id: string;
  name: string;
  startDate: string;
  endDate?: string;
  stageScope: string;
  isActive: boolean;
  createdAt: string;
}

export type LibraryBook = Book;

export type ChildEventType = 'mass' | 'sunday_school' | string;
export type StaffEventType = 'mass' | 'sunday_school' | 'general_meeting' | 'supervisors_meeting';
export type EventType = ChildEventType | StaffEventType;
export type AttendancePeriodType = 'weekly' | 'monthly' | 'seasonal_event';

export interface AttendanceRecord {
  id: string;
  date: string; // YYYY-MM-DD
  periodType?: AttendancePeriodType;
  targetType: 'child' | 'servant' | 'supervisor';
  eventType: EventType;
  recordedByUid?: string;
  note?: string;
  records: Record<string, { status: AttendanceStatus; note?: string; recordedByUid?: string }>;
}

export interface FilterState {
  searchQuery: string;
  stageFilter: string;
  birthMonthFilter: string;
  ageFilter: string;
  areaFilter: string;
}
