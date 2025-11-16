// User types
export enum Role {
  ADMIN = 'ADMIN',
  CORRESPONDENCE_OFFICER = 'CORRESPONDENCE_OFFICER',
  DEPARTMENT_HEAD = 'DEPARTMENT_HEAD',
  DEPARTMENT_USER = 'DEPARTMENT_USER'
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE'
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  status: UserStatus;
  departmentId?: string;
  avatarPath?: string;
  createdAt: string;
  updatedAt: string;
  department?: Department;
}

// Department types
export interface Department {
  id: string;
  name: string;
  nameAr?: string;
  code: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  headId?: string;
  head?: User;
}

// Category types
export interface Category {
  id: string;
  name: string;
  nameAr?: string;
  description?: string;
  color?: string;
  createdAt: string;
  updatedAt: string;
}

// Document types
export enum DocumentStatus {
  DRAFT = 'DRAFT',
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  ON_HOLD = 'ON_HOLD',
  COMPLETED = 'COMPLETED',
  REJECTED = 'REJECTED',
  ARCHIVED = 'ARCHIVED'
}

export enum Priority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT'
}

export enum DocumentType {
  INCOMING = 'INCOMING',
  OUTGOING = 'OUTGOING',
  INTERNAL = 'INTERNAL'
}

export interface Document {
  id: string;
  referenceNumber: string;
  subject: string;
  content?: string;
  status: DocumentStatus;
  priority: Priority;
  type: DocumentType;
  sourceContact?: string;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
  createdById: string;
  assignedToId?: string;
  createdBy: User;
  assignedTo?: User;
  categories: DocumentCategory[];
  departments: DocumentDepartment[];
  attachments: Attachment[];
}

export interface DocumentCategory {
  documentId: string;
  categoryId: string;
  category: Category;
}

export interface DocumentDepartment {
  documentId: string;
  departmentId: string;
  department: Department;
}

// File/Attachment types
export interface Attachment {
  id: string;
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  path: string;
  thumbnailPath?: string;
  description?: string;
  isPublic: boolean;
  documentId?: string;
  outcomeId?: string;
  uploadedBy: string;
  createdAt: string;
  updatedAt: string;
  uploadedByUser: User;
  document?: Document;
}

// Notification types
export enum NotificationType {
  DOCUMENT_ASSIGNED = 'DOCUMENT_ASSIGNED',
  DOCUMENT_STATUS_CHANGED = 'DOCUMENT_STATUS_CHANGED',
  DOCUMENT_OVERDUE = 'DOCUMENT_OVERDUE',
  SYSTEM = 'SYSTEM'
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  userId: string;
  relatedId?: string;
  createdAt: string;
  user: User;
}

// API Response types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface ApiResponse<T> {
  data?: T;
  message: string;
  errors?: any[];
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginationResponse {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface ListResponse<T> {
  items: T[];
  pagination: PaginationResponse;
}

// Filter and search types
export interface DocumentFilters {
  status?: DocumentStatus[];
  priority?: Priority[];
  type?: DocumentType[];
  categoryIds?: string[];
  departmentIds?: string[];
  createdById?: string;
  assignedToId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface UserFilters {
  role?: Role[];
  status?: UserStatus[];
  departmentId?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Dashboard types
export interface DashboardStats {
  totalDocuments: number;
  pendingDocuments: number;
  overdueDocuments: number;
  completedDocuments: number;
  totalUsers: number;
  activeUsers: number;
  totalDepartments: number;
  recentDocuments: Document[];
  recentActivities: ActivityLog[];
}

export interface ActivityLog {
  id: string;
  action: string;
  details: string;
  relatedId?: string;
  createdAt: string;
  user: User;
}

// Form types
export interface CreateDocumentForm {
  subject: string;
  content?: string;
  priority: Priority;
  type: DocumentType;
  sourceContact?: string;
  dueDate?: string;
  categoryIds: string[];
  departmentIds: string[];
  assignedToId?: string;
}

export interface CreateUserForm {
  email: string;
  fullName: string;
  role: Role;
  departmentId?: string;
  password: string;
}

export interface UpdateProfileForm {
  fullName: string;
  email: string;
}

export interface ChangePasswordForm {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

// Error types
export interface ApiError {
  message: string;
  status: number;
  errors?: any[];
}

// Search types
export interface SearchFilters {
  categories: Category[];
  departments: Department[];
  users: User[];
  statuses: { status: DocumentStatus; count: number }[];
  priorities: { value: Priority; label: string }[];
}

export interface AutocompleteOption {
  value: string;
  label?: string;
  id?: string;
  type: string;
}