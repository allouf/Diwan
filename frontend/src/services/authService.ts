import { apiUtils } from './api';
import { LoginRequest, LoginResponse, User, ChangePasswordForm, UpdateProfileForm } from '../types';

export const authService = {
  // Login user
  login: async (credentials: LoginRequest): Promise<LoginResponse> => {
    const response = await apiUtils.post<LoginResponse>('/auth/login', credentials);
    
    // Store tokens and user data
    localStorage.setItem('accessToken', response.accessToken);
    localStorage.setItem('refreshToken', response.refreshToken);
    localStorage.setItem('user', JSON.stringify(response.user));
    
    return response;
  },

  // Logout user
  logout: async (): Promise<void> => {
    try {
      await apiUtils.post('/auth/logout');
    } catch (error) {
      // Continue with logout even if API call fails
      console.error('Logout API call failed:', error);
    } finally {
      // Clear local storage
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
    }
  },

  // Refresh token
  refreshToken: async (): Promise<{ accessToken: string }> => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await apiUtils.post<{ accessToken: string }>('/auth/refresh', {
      refreshToken
    });

    localStorage.setItem('accessToken', response.accessToken);
    return response;
  },

  // Get current user profile
  getProfile: async (): Promise<User> => {
    return await apiUtils.get<User>('/auth/me');
  },

  // Update user profile
  updateProfile: async (data: UpdateProfileForm): Promise<User> => {
    const response = await apiUtils.patch<User>('/auth/profile', data);
    
    // Update stored user data
    localStorage.setItem('user', JSON.stringify(response));
    
    return response;
  },

  // Change password
  changePassword: async (data: ChangePasswordForm): Promise<{ message: string }> => {
    return await apiUtils.post<{ message: string }>('/auth/change-password', {
      currentPassword: data.currentPassword,
      newPassword: data.newPassword
    });
  },

  // Get stored user data
  getCurrentUser: (): User | null => {
    const userData = localStorage.getItem('user');
    if (!userData || userData === 'undefined' || userData === 'null') {
      return null;
    }
    try {
      return JSON.parse(userData);
    } catch (error) {
      console.error('Error parsing user data:', error);
      return null;
    }
  },

  // Check if user is authenticated
  isAuthenticated: (): boolean => {
    const token = localStorage.getItem('accessToken');
    const user = localStorage.getItem('user');
    return !!(token && user);
  },

  // Check if user has specific role
  hasRole: (role: string): boolean => {
    const user = authService.getCurrentUser();
    return user?.role === role;
  },

  // Check if user has any of the specified roles
  hasAnyRole: (roles: string[]): boolean => {
    const user = authService.getCurrentUser();
    return user ? roles.includes(user.role) : false;
  },

  // Check if user is admin
  isAdmin: (): boolean => {
    return authService.hasRole('ADMIN');
  },

  // Check if user is correspondence officer
  isCorrespondenceOfficer: (): boolean => {
    return authService.hasRole('CORRESPONDENCE_OFFICER');
  },

  // Check if user is department head
  isDepartmentHead: (): boolean => {
    return authService.hasRole('DEPARTMENT_HEAD');
  },

  // Check if user has administrative privileges
  hasAdminPrivileges: (): boolean => {
    return authService.hasAnyRole(['ADMIN', 'CORRESPONDENCE_OFFICER']);
  }
};