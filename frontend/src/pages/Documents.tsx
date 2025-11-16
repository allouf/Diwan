import React, { useState, useEffect } from 'react';
import { 
  Plus, Search, Filter, Download, Eye, Edit, Trash2, 
  FileText, Calendar, User, Tag, ChevronDown, X
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import { Document, DocumentStatus } from '../types';
import { toast } from 'react-hot-toast';

interface DocumentFilters {
  status?: DocumentStatus;
  category?: string;
  department?: string;
  dateFrom?: string;
  dateTo?: string;
}

const statusOptions = [
  { value: 'DRAFT', label: 'Draft', color: 'bg-gray-100 text-gray-800' },
  { value: 'PENDING', label: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'IN_PROGRESS', label: 'In Progress', color: 'bg-blue-100 text-blue-800' },
  { value: 'COMPLETED', label: 'Completed', color: 'bg-green-100 text-green-800' },
  { value: 'ARCHIVED', label: 'Archived', color: 'bg-gray-100 text-gray-800' }
];

const StatusBadge: React.FC<{ status: DocumentStatus }> = ({ status }) => {
  const config = statusOptions.find(opt => opt.value === status);
  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-full ${config?.color || 'bg-gray-100 text-gray-800'}`}>
      {config?.label || status}
    </span>
  );
};

const FilterDropdown: React.FC<{
  title: string;
  options: { value: string; label: string }[];
  value?: string;
  onChange: (value: string) => void;
  onClear: () => void;
}> = ({ title, options, value, onChange, onClear }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center space-x-2 px-3 py-2 text-sm border rounded-lg hover:bg-gray-50 ${
          value ? 'bg-primary-50 border-primary-200 text-primary-700' : 'bg-white border-gray-300'
        }`}
      >
        <span>{value ? options.find(opt => opt.value === value)?.label : title}</span>
        {value ? (
          <X
            className="w-4 h-4 hover:text-primary-900"
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
          />
        ) : (
          <ChevronDown className="w-4 h-4" />
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
          <div className="p-1">
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded"
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export const Documents: React.FC = () => {
  const { user, hasAnyRole } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<DocumentFilters>({});
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [categories, setCategories] = useState<{ value: string; label: string }[]>([]);
  const [departments, setDepartments] = useState<{ value: string; label: string }[]>([]);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalDocuments, setTotalDocuments] = useState(0);
  const itemsPerPage = 10;

  useEffect(() => {
    loadDocuments();
    loadFilterOptions();
  }, [currentPage, filters, searchQuery]);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const params: any = {
        page: currentPage,
        limit: itemsPerPage,
        search: searchQuery || undefined,
        ...filters
      };

      const response = await apiService.get('/documents', { params });
      setDocuments(response.data.documents);
      setTotalPages(response.data.pagination.pages);
      setTotalDocuments(response.data.pagination.total);
    } catch (error) {
      console.error('Error loading documents:', error);
      toast.error('Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const loadFilterOptions = async () => {
    try {
      const [categoriesRes, departmentsRes] = await Promise.all([
        apiService.get('/categories'),
        apiService.get('/departments')
      ]);

      setCategories(
        categoriesRes.data.map((cat: any) => ({ 
          value: cat.id, 
          label: cat.name 
        }))
      );
      
      setDepartments(
        departmentsRes.data.map((dept: any) => ({ 
          value: dept.id, 
          label: dept.name 
        }))
      );
    } catch (error) {
      console.error('Error loading filter options:', error);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    loadDocuments();
  };

  const handleFilterChange = (key: keyof DocumentFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const handleFilterClear = (key: keyof DocumentFilters) => {
    setFilters(prev => {
      const newFilters = { ...prev };
      delete newFilters[key];
      return newFilters;
    });
    setCurrentPage(1);
  };

  const clearAllFilters = () => {
    setFilters({});
    setSearchQuery('');
    setCurrentPage(1);
  };

  const toggleDocumentSelection = (documentId: string) => {
    setSelectedDocuments(prev => 
      prev.includes(documentId) 
        ? prev.filter(id => id !== documentId)
        : [...prev, documentId]
    );
  };

  const selectAllDocuments = () => {
    setSelectedDocuments(
      selectedDocuments.length === documents.length 
        ? [] 
        : documents.map(doc => doc.id)
    );
  };

  const handleBulkAction = async (action: string) => {
    if (selectedDocuments.length === 0) {
      toast.error('Please select documents first');
      return;
    }

    try {
      await apiService.post('/documents/bulk-action', {
        documentIds: selectedDocuments,
        action
      });
      
      toast.success(`${action} completed successfully`);
      setSelectedDocuments([]);
      loadDocuments();
    } catch (error) {
      console.error('Error performing bulk action:', error);
      toast.error('Failed to perform action');
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
      await apiService.delete(`/documents/${documentId}`);
      toast.success('Document deleted successfully');
      loadDocuments();
    } catch (error) {
      console.error('Error deleting document:', error);
      toast.error('Failed to delete document');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading && documents.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
          <p className="text-gray-600 mt-1">
            Manage and track all correspondence documents
          </p>
        </div>
        {hasAnyRole(['ADMIN', 'CORRESPONDENCE_OFFICER']) && (
          <button className="flex items-center space-x-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700">
            <Plus className="w-4 h-4" />
            <span>New Document</span>
          </button>
        )}
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <form onSubmit={handleSearch} className="flex gap-4 items-center mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <button
            type="submit"
            className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700"
          >
            Search
          </button>
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Filter className="w-4 h-4" />
            <span>Filters</span>
          </button>
        </form>

        {/* Filter Controls */}
        {showFilters && (
          <div className="border-t pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <FilterDropdown
                title="Status"
                options={statusOptions.map(s => ({ value: s.value, label: s.label }))}
                value={filters.status}
                onChange={(value) => handleFilterChange('status', value as DocumentStatus)}
                onClear={() => handleFilterClear('status')}
              />
              <FilterDropdown
                title="Category"
                options={categories}
                value={filters.category}
                onChange={(value) => handleFilterChange('category', value)}
                onClear={() => handleFilterClear('category')}
              />
              <FilterDropdown
                title="Department"
                options={departments}
                value={filters.department}
                onChange={(value) => handleFilterChange('department', value)}
                onClear={() => handleFilterClear('department')}
              />
              <div className="flex items-center space-x-2">
                <input
                  type="date"
                  value={filters.dateFrom || ''}
                  onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg"
                />
                <span className="text-sm text-gray-500">to</span>
                <input
                  type="date"
                  value={filters.dateTo || ''}
                  onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg"
                />
              </div>
            </div>
            {Object.keys(filters).length > 0 && (
              <button
                onClick={clearAllFilters}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Bulk Actions */}
      {selectedDocuments.length > 0 && (
        <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-primary-700">
              {selectedDocuments.length} document{selectedDocuments.length !== 1 ? 's' : ''} selected
            </span>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handleBulkAction('archive')}
                className="px-3 py-1 text-sm bg-white border border-primary-300 rounded hover:bg-primary-50"
              >
                Archive
              </button>
              <button
                onClick={() => handleBulkAction('export')}
                className="px-3 py-1 text-sm bg-white border border-primary-300 rounded hover:bg-primary-50"
              >
                Export
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="w-12 px-6 py-3">
                  <input
                    type="checkbox"
                    checked={selectedDocuments.length === documents.length}
                    onChange={selectAllDocuments}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Document
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sender
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {documents.map((document) => (
                <tr key={document.id} className="hover:bg-gray-50">
                  <td className="w-12 px-6 py-4">
                    <input
                      type="checkbox"
                      checked={selectedDocuments.includes(document.id)}
                      onChange={() => toggleDocumentSelection(document.id)}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <FileText className="w-8 h-8 text-gray-400" />
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-900">
                          {document.title}
                        </p>
                        <p className="text-sm text-gray-500">
                          {document.referenceNumber}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={document.status} />
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {document.sender?.fullName || 'Unknown'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {formatDate(document.createdAt)}
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      <button className="text-gray-400 hover:text-primary-600">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button className="text-gray-400 hover:text-blue-600">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button className="text-gray-400 hover:text-green-600">
                        <Download className="w-4 h-4" />
                      </button>
                      {hasAnyRole(['ADMIN', 'CORRESPONDENCE_OFFICER']) && (
                        <button
                          onClick={() => handleDeleteDocument(document.id)}
                          className="text-gray-400 hover:text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-white px-6 py-3 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-500">
              Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalDocuments)} of {totalDocuments} results
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="px-3 py-2 text-sm font-medium">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Empty State */}
      {!loading && documents.length === 0 && (
        <div className="text-center py-12">
          <FileText className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No documents</h3>
          <p className="mt-1 text-sm text-gray-500">
            {searchQuery || Object.keys(filters).length > 0 
              ? 'No documents match your search criteria.'
              : 'Get started by creating a new document.'}
          </p>
        </div>
      )}
    </div>
  );
};