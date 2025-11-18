import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Save, Send, FileText, Calendar, User, Building2,
  Tag, AlertCircle, Upload
} from 'lucide-react';
import { apiService } from '../services/api';
import { toast } from 'react-hot-toast';

interface Category {
  id: string;
  name: string;
  nameAr?: string;
}

interface Department {
  id: string;
  name: string;
  code: string;
}

interface User {
  id: string;
  fullName: string;
  email: string;
}

interface FormData {
  subject: string;
  summary: string;
  senderType: 'INTERNAL' | 'EXTERNAL';
  senderName: string;
  categoryId: string;
  priority: 'NORMAL' | 'HIGH' | 'URGENT';
  physicalLocation: string;
  departmentIds: string[];
  dateReceived: string;
  assignedToId: string;
}

export const CreateDocument: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [formData, setFormData] = useState<FormData>({
    subject: '',
    summary: '',
    senderType: 'EXTERNAL',
    senderName: '',
    categoryId: '',
    priority: 'NORMAL',
    physicalLocation: '',
    departmentIds: [],
    dateReceived: new Date().toISOString().split('T')[0],
    assignedToId: ''
  });
  const [errors, setErrors] = useState<Partial<FormData>>({});

  useEffect(() => {
    loadFormOptions();
  }, []);

  const loadFormOptions = async () => {
    try {
      const [categoriesRes, departmentsRes, usersRes] = await Promise.all([
        apiService.get('/categories'),
        apiService.get('/departments'),
        apiService.get('/users')
      ]);

      const categoriesData = categoriesRes.data || categoriesRes;
      const departmentsData = departmentsRes.data || departmentsRes;
      const usersData = usersRes.data || usersRes;

      setCategories(Array.isArray(categoriesData) ? categoriesData : []);
      setDepartments(Array.isArray(departmentsData) ? departmentsData : []);
      setUsers(Array.isArray(usersData) ? usersData : usersData.users || []);
    } catch (error) {
      console.error('Error loading form options:', error);
      toast.error('Failed to load form data');
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<FormData> = {};

    if (!formData.subject.trim()) {
      newErrors.subject = 'Subject is required';
    }
    if (!formData.summary.trim()) {
      newErrors.summary = 'Summary is required';
    }
    if (!formData.senderName.trim()) {
      newErrors.senderName = 'Sender name is required';
    }
    if (!formData.categoryId) {
      newErrors.categoryId = 'Category is required';
    }
    if (!formData.dateReceived) {
      newErrors.dateReceived = 'Date received is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (status: 'DRAFT' | 'PENDING') => {
    if (!validateForm()) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);

      const payload = {
        ...formData,
        status,
        departmentIds: formData.departmentIds.length > 0 ? formData.departmentIds : undefined,
        assignedToId: formData.assignedToId || undefined
      };

      await apiService.post('/documents', payload);

      toast.success(
        status === 'DRAFT'
          ? 'Document saved as draft'
          : 'Document created successfully'
      );

      navigate('/documents');
    } catch (error: any) {
      console.error('Error creating document:', error);
      toast.error(error.response?.data?.message || 'Failed to create document');
    } finally {
      setLoading(false);
    }
  };

  const handleDepartmentToggle = (departmentId: string) => {
    setFormData(prev => ({
      ...prev,
      departmentIds: prev.departmentIds.includes(departmentId)
        ? prev.departmentIds.filter(id => id !== departmentId)
        : [...prev.departmentIds, departmentId]
    }));
  };

  const handleInputChange = (
    field: keyof FormData,
    value: string | string[]
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <button
          onClick={() => navigate('/documents')}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Create New Document</h1>
          <p className="text-gray-600 mt-1">
            Fill in the details to create a new correspondence document
          </p>
        </div>
      </div>

      {/* Main Form */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 space-y-6">
          {/* Document Information Section */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center">
              <FileText className="w-5 h-5 mr-2 text-primary-600" />
              Document Information
            </h2>

            {/* Subject */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Subject <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.subject}
                onChange={(e) => handleInputChange('subject', e.target.value)}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                  errors.subject ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter document subject"
              />
              {errors.subject && (
                <p className="text-sm text-red-500 mt-1 flex items-center">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  {errors.subject}
                </p>
              )}
            </div>

            {/* Summary */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Summary <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.summary}
                onChange={(e) => handleInputChange('summary', e.target.value)}
                rows={4}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                  errors.summary ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter document summary"
              />
              {errors.summary && (
                <p className="text-sm text-red-500 mt-1 flex items-center">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  {errors.summary}
                </p>
              )}
            </div>

            {/* Date Received */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date Received <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <input
                  type="date"
                  value={formData.dateReceived}
                  onChange={(e) => handleInputChange('dateReceived', e.target.value)}
                  className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                    errors.dateReceived ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
              </div>
              {errors.dateReceived && (
                <p className="text-sm text-red-500 mt-1 flex items-center">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  {errors.dateReceived}
                </p>
              )}
            </div>
          </div>

          {/* Sender Information Section */}
          <div className="space-y-4 pt-6 border-t border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center">
              <User className="w-5 h-5 mr-2 text-primary-600" />
              Sender Information
            </h2>

            {/* Sender Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sender Type <span className="text-red-500">*</span>
              </label>
              <div className="flex space-x-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="EXTERNAL"
                    checked={formData.senderType === 'EXTERNAL'}
                    onChange={(e) => handleInputChange('senderType', e.target.value as 'EXTERNAL')}
                    className="mr-2 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">External</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="INTERNAL"
                    checked={formData.senderType === 'INTERNAL'}
                    onChange={(e) => handleInputChange('senderType', e.target.value as 'INTERNAL')}
                    className="mr-2 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">Internal</span>
                </label>
              </div>
            </div>

            {/* Sender Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sender Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.senderName}
                onChange={(e) => handleInputChange('senderName', e.target.value)}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                  errors.senderName ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter sender name"
              />
              {errors.senderName && (
                <p className="text-sm text-red-500 mt-1 flex items-center">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  {errors.senderName}
                </p>
              )}
            </div>
          </div>

          {/* Classification Section */}
          <div className="space-y-4 pt-6 border-t border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center">
              <Tag className="w-5 h-5 mr-2 text-primary-600" />
              Classification
            </h2>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.categoryId}
                onChange={(e) => handleInputChange('categoryId', e.target.value)}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                  errors.categoryId ? 'border-red-500' : 'border-gray-300'
                }`}
              >
                <option value="">Select a category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              {errors.categoryId && (
                <p className="text-sm text-red-500 mt-1 flex items-center">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  {errors.categoryId}
                </p>
              )}
            </div>

            {/* Priority */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Priority
              </label>
              <select
                value={formData.priority}
                onChange={(e) => handleInputChange('priority', e.target.value as 'NORMAL' | 'HIGH' | 'URGENT')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="NORMAL">Normal</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>

            {/* Physical Location */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Physical Location
              </label>
              <input
                type="text"
                value={formData.physicalLocation}
                onChange={(e) => handleInputChange('physicalLocation', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="e.g., Archive Room A, Shelf 3"
              />
            </div>
          </div>

          {/* Assignment Section */}
          <div className="space-y-4 pt-6 border-t border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center">
              <Building2 className="w-5 h-5 mr-2 text-primary-600" />
              Assignment
            </h2>

            {/* Departments */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Assign to Departments
              </label>
              <div className="border border-gray-300 rounded-lg p-4 max-h-48 overflow-y-auto">
                {departments.length > 0 ? (
                  <div className="space-y-2">
                    {departments.map((dept) => (
                      <label key={dept.id} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.departmentIds.includes(dept.id)}
                          onChange={() => handleDepartmentToggle(dept.id)}
                          className="mr-2 rounded text-primary-600 focus:ring-primary-500"
                        />
                        <span className="text-sm text-gray-700">
                          {dept.name} ({dept.code})
                        </span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No departments available</p>
                )}
              </div>
            </div>

            {/* Assign To User */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Assign to User (Optional)
              </label>
              <select
                value={formData.assignedToId}
                onChange={(e) => handleInputChange('assignedToId', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">No specific user</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.fullName} ({user.email})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-between items-center">
          <button
            onClick={() => navigate('/documents')}
            className="px-4 py-2 text-gray-700 hover:text-gray-900 transition-colors"
            disabled={loading}
          >
            Cancel
          </button>
          <div className="flex space-x-3">
            <button
              onClick={() => handleSubmit('DRAFT')}
              disabled={loading}
              className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              <span>Save as Draft</span>
            </button>
            <button
              onClick={() => handleSubmit('PENDING')}
              disabled={loading}
              className="flex items-center space-x-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Creating...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Create Document</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
