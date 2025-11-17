import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import toast from 'react-hot-toast';

// API Configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export interface ApiConfig extends AxiosRequestConfig {
  skipAuthRefresh?: boolean;
}

// Create axios instance
const createApiInstance = (): AxiosInstance => {
  const instance = axios.create({
    baseURL: API_BASE_URL,
    timeout: 10000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Request interceptor - add auth token
  instance.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem('accessToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  // Response interceptor - handle token refresh and errors
  instance.interceptors.response.use(
    (response: AxiosResponse) => {
      return response;
    },
    async (error: AxiosError) => {
      const original = error.config as ApiConfig;
      
      // Handle 401 unauthorized
      if (error.response?.status === 401 && !original.skipAuthRefresh) {
        try {
          const refreshToken = localStorage.getItem('refreshToken');
          if (refreshToken) {
            const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
              refreshToken
            });
            
            const { accessToken } = response.data;
            localStorage.setItem('accessToken', accessToken);
            
            // Retry original request with new token
            if (original.headers) {
              original.headers.Authorization = `Bearer ${accessToken}`;
            }
            return instance(original);
          }
        } catch (refreshError) {
          // Refresh failed, redirect to login
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('user');
          window.location.href = '/login';
          return Promise.reject(refreshError);
        }
      }
      
      // Handle other errors
      handleApiError(error);
      return Promise.reject(error);
    }
  );

  return instance;
};

// Error handler
const handleApiError = (error: AxiosError) => {
  if (error.response) {
    const { status, data } = error.response;
    const message = (data as any)?.message || 'An error occurred';
    
    switch (status) {
      case 400:
        toast.error(message);
        break;
      case 401:
        toast.error('Authentication required');
        break;
      case 403:
        toast.error('Access denied');
        break;
      case 404:
        toast.error('Resource not found');
        break;
      case 422:
        toast.error('Validation failed');
        break;
      case 429:
        toast.error('Too many requests. Please try again later.');
        break;
      case 500:
        toast.error('Server error. Please try again later.');
        break;
      default:
        toast.error(message);
    }
  } else if (error.request) {
    toast.error('Network error. Please check your connection.');
  } else {
    toast.error('An unexpected error occurred');
  }
};

// Create the API instance
export const api = createApiInstance();

// API utility functions
export const apiUtils = {
  // Generic GET request
  get: async <T>(url: string, config?: ApiConfig): Promise<T> => {
    const response = await api.get<T>(url, config);
    return response.data;
  },

  // Generic POST request
  post: async <T, D = any>(url: string, data?: D, config?: ApiConfig): Promise<T> => {
    const response = await api.post<T>(url, data, config);
    return response.data;
  },

  // Generic PUT request
  put: async <T, D = any>(url: string, data?: D, config?: ApiConfig): Promise<T> => {
    const response = await api.put<T>(url, data, config);
    return response.data;
  },

  // Generic PATCH request
  patch: async <T, D = any>(url: string, data?: D, config?: ApiConfig): Promise<T> => {
    const response = await api.patch<T>(url, data, config);
    return response.data;
  },

  // Generic DELETE request
  delete: async <T>(url: string, config?: ApiConfig): Promise<T> => {
    const response = await api.delete<T>(url, config);
    return response.data;
  },

  // File upload request
  upload: async <T>(url: string, formData: FormData, config?: ApiConfig): Promise<T> => {
    const response = await api.post<T>(url, formData, {
      ...config,
      headers: {
        'Content-Type': 'multipart/form-data',
        ...config?.headers,
      },
    });
    return response.data;
  },

  // Download file
  download: async (url: string, filename?: string, config?: ApiConfig): Promise<Blob> => {
    const response = await api.get(url, {
      ...config,
      responseType: 'blob',
    });
    
    // Handle filename from response headers
    if (filename) {
      const downloadUrl = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    }
    
    return response.data;
  }
};

// Request/response transformers
export const transformers = {
  // Transform dates to Date objects
  transformDates: (obj: any): any => {
    if (!obj) return obj;
    
    const dateFields = ['createdAt', 'updatedAt', 'dueDate'];
    const transformed = { ...obj };
    
    dateFields.forEach(field => {
      if (transformed[field] && typeof transformed[field] === 'string') {
        transformed[field] = new Date(transformed[field]);
      }
    });
    
    return transformed;
  },

  // Transform arrays of objects
  transformArray: <T>(items: T[], transformer: (item: T) => T): T[] => {
    return items.map(transformer);
  }
};

// Helper functions for common API patterns
export const apiHelpers = {
  // Build query string from object
  buildQueryString: (params: Record<string, any>): string => {
    const searchParams = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        if (Array.isArray(value)) {
          value.forEach(v => searchParams.append(key, v.toString()));
        } else {
          searchParams.set(key, value.toString());
        }
      }
    });
    
    return searchParams.toString();
  },

  // Get file URL
  getFileUrl: (path: string): string => {
    return `${API_BASE_URL.replace('/api', '')}${path}`;
  },

  // Get avatar URL
  getAvatarUrl: (filename?: string): string => {
    if (!filename) return '/default-avatar.png';
    return `${API_BASE_URL}/files/avatar/${filename}`;
  },

  // Get thumbnail URL
  getThumbnailUrl: (filename?: string): string => {
    if (!filename) return '';
    return `${API_BASE_URL}/files/thumbnail/${filename}`;
  }
};

// Export as apiService for backwards compatibility
export const apiService = api;

// Export the configured API instance as default
export default api;