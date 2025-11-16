export interface Document {
  id: string;
  referenceNumber: string;
  dateReceived: Date;
  subject: string;
  summary: string;
  senderType: 'internal' | 'external';
  senderName: string;
  category: Category;
  status: DocumentStatus;
  priority: Priority;
  physicalLocation?: string;
  assignedDepartments: Department[];
  departmentSeenStatus: DepartmentSeenStatus[];
  outcomes: Outcome[];
  attachments: Attachment[];
  createdBy: User;
  createdAt: Date;
  updatedAt: Date;
}

export interface Department {
  id: string;
  name: string;
  nameAr: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  description?: string;
}

export interface Category {
  id: string;
  name: string;
  nameAr: string;
  suggestedDepartments: Department[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department?: Department;
  avatar?: string;
  password?: string; // Only for backend
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Outcome {
  id: string;
  documentId: string;
  departmentId: string;
  type: OutcomeType;
  summary: string;
  date: Date;
  attachments: Attachment[];
  requiresFollowUp: boolean;
  followUpDate?: Date;
  loggedBy: User;
  loggedAt: Date;
}

export interface Attachment {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  uploadedAt: Date;
}

export type DocumentStatus = 'registered' | 'pending' | 'seen' | 'completed' | 'archived';

export type Priority = 'normal' | 'high' | 'urgent';

export type UserRole = 'admin' | 'correspondence-officer' | 'department-head' | 'department-user';

export type OutcomeType = 'approved' | 'rejected' | 'pending-review' | 'requires-action' | 'completed' | 'on-hold';

export interface HistoryEntry {
  id: string;
  documentId: string;
  action: string;
  actionAr: string;
  details?: string;
  user: User;
  timestamp: Date;
}

export interface SearchFilters {
  referenceNumber?: string;
  dateFrom?: Date;
  dateTo?: Date;
  senderName?: string;
  subject?: string;
  summary?: string;
  departments?: string[];
  categories?: string[];
  statuses?: DocumentStatus[];
  priorities?: Priority[];
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface DashboardStats {
  totalDocuments: number;
  pendingDocuments: number;
  thisWeekDocuments: number;
  urgentDocuments: number;
  completedThisMonth: number;
  averageProcessingTime: number;
  departmentStats?: DepartmentStat[];
  categoryStats?: CategoryStat[];
}

export interface DepartmentStat {
  departmentId: string;
  departmentName: string;
  totalDocuments: number;
  pendingDocuments: number;
  completedDocuments: number;
}

export interface CategoryStat {
  categoryId: string;
  categoryName: string;
  documentCount: number;
}

export interface ActivityLog {
  id: string;
  action: string;
  actionAr: string;
  user: User;
  timestamp: Date;
  documentReference?: string;
  details?: string;
}

export interface DepartmentSeenStatus {
  departmentId: string;
  seenBy: User[];
  seenAt: Date[];
  isSeen: boolean;
}

export interface Notification {
  id: string;
  documentId: string;
  documentReference: string;
  recipientUserId: string;
  departmentId: string;
  message: string;
  messageAr: string;
  isRead: boolean;
  createdAt: Date;
  readAt?: Date;
}

export interface DepartmentUser extends User {
  role: 'department-user';
  department: Department;
  notifications: Notification[];
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    stack?: string;
  };
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// Authentication Types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: Omit<User, 'password'>;
  token: string;
  refreshToken: string;
}

export interface TokenPayload {
  userId: string;
  email: string;
  role: UserRole;
  iat: number;
  exp: number;
}

// File Upload Types
export interface FileUploadResult {
  id: string;
  name: string;
  originalName: string;
  size: number;
  type: string;
  url: string;
  path: string;
}