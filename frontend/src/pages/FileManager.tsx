/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect } from 'react';
import {
  Upload, Grid, List, Search, Download, Eye,
  Trash2, FolderOpen, FileText, Image, File as FileIcon,
  HardDrive
} from 'lucide-react';
import { FileUpload, UploadedFile } from '../components/FileUpload';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import { toast } from 'react-hot-toast';

interface FileWithOwner extends UploadedFile {
  uploadedBy?: {
    fullName: string;
    email: string;
  };
  documentId?: string;
  isPublic?: boolean;
}

interface FileFilters {
  type?: string;
  dateFrom?: string;
  dateTo?: string;
  owner?: string;
  isPublic?: boolean;
}

// const FILE_TYPES = [
//   { value: 'image', label: 'Images', icon: Image },
//   { value: 'document', label: 'Documents', icon: FileText },
//   { value: 'all', label: 'All Files', icon: FileIcon }
// ];

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const getFileIcon = (mimeType: string) => {
  if (mimeType.startsWith('image/')) return Image;
  if (mimeType.includes('pdf')) return FileText;
  return FileIcon;
};

const FileGridView: React.FC<{
  files: FileWithOwner[];
  onView: (file: FileWithOwner) => void;
  onDownload: (file: FileWithOwner) => void;
  onDelete: (file: FileWithOwner) => void;
  canDelete: boolean;
}> = ({ files, onView, onDownload, onDelete, canDelete }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
      {files.map((file) => {
        const isImage = file.mimeType.startsWith('image/');
        const IconComponent = getFileIcon(file.mimeType);
        
        return (
          <div key={file.id} className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
            <div className="aspect-square mb-3 bg-gray-50 rounded-lg flex items-center justify-center overflow-hidden">
              {isImage && file.thumbnailUrl ? (
                <img
                  src={file.thumbnailUrl}
                  alt={file.originalName}
                  className="w-full h-full object-cover cursor-pointer"
                  onClick={() => onView(file)}
                />
              ) : (
                <IconComponent className="w-12 h-12 text-gray-400" />
              )}
            </div>
            
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-gray-900 truncate" title={file.originalName}>
                {file.originalName}
              </h3>
              <p className="text-xs text-gray-500">
                {formatFileSize(file.size)}
              </p>
              <p className="text-xs text-gray-400">
                {new Date(file.uploadedAt).toLocaleDateString()}
              </p>
            </div>
            
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
              <div className="flex space-x-1">
                <button
                  onClick={() => onView(file)}
                  className="p-1 text-gray-400 hover:text-blue-600"
                  title="View"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onDownload(file)}
                  className="p-1 text-gray-400 hover:text-green-600"
                  title="Download"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
              {canDelete && (
                <button
                  onClick={() => onDelete(file)}
                  className="p-1 text-gray-400 hover:text-red-600"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const FileListView: React.FC<{
  files: FileWithOwner[];
  onView: (file: FileWithOwner) => void;
  onDownload: (file: FileWithOwner) => void;
  onDelete: (file: FileWithOwner) => void;
  canDelete: boolean;
}> = ({ files, onView, onDownload, onDelete, canDelete }) => {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">File</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Size</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Owner</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Upload Date</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {files.map((file) => {
              const IconComponent = getFileIcon(file.mimeType);
              
              return (
                <tr key={file.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        {file.mimeType.startsWith('image/') && file.thumbnailUrl ? (
                          <img
                            src={file.thumbnailUrl}
                            alt={file.originalName}
                            className="w-10 h-10 object-cover rounded"
                          />
                        ) : (
                          <div className="w-10 h-10 flex items-center justify-center bg-gray-100 rounded">
                            <IconComponent className="w-5 h-5 text-gray-500" />
                          </div>
                        )}
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-900 truncate max-w-xs">
                          {file.originalName}
                        </p>
                        <p className="text-xs text-gray-500 uppercase">
                          {file.mimeType.split('/')[1]}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {formatFileSize(file.size)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {file.uploadedBy?.fullName || 'Unknown'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(file.uploadedAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => onView(file)}
                        className="text-gray-400 hover:text-blue-600"
                        title="View"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDownload(file)}
                        className="text-gray-400 hover:text-green-600"
                        title="Download"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      {canDelete && (
                        <button
                          onClick={() => onDelete(file)}
                          className="text-gray-400 hover:text-red-600"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const FilePreviewModal: React.FC<{
  file: FileWithOwner | null;
  isOpen: boolean;
  onClose: () => void;
}> = ({ file, isOpen, onClose }) => {
  if (!isOpen || !file) return null;

  const isImage = file.mimeType.startsWith('image/');
  const isPDF = file.mimeType === 'application/pdf';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="fixed inset-0 bg-black bg-opacity-75" onClick={onClose} />
        
        <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-full overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="text-lg font-medium text-gray-900 truncate">
              {file.originalName}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          </div>
          
          <div className="p-4 max-h-96 overflow-auto">
            {isImage ? (
              <img
                src={file.url || `/api/files/${file.id}`}
                alt={file.originalName}
                className="max-w-full h-auto mx-auto"
              />
            ) : isPDF ? (
              <iframe
                src={file.url || `/api/files/${file.id}`}
                className="w-full h-96"
                title={file.originalName}
              />
            ) : (
              <div className="text-center py-8">
                <FileIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">Preview not available for this file type</p>
                <a
                  href={file.url || `/api/files/${file.id}`}
                  download={file.originalName}
                  className="mt-4 inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </a>
              </div>
            )}
          </div>
          
          <div className="border-t p-4 bg-gray-50">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Size</p>
                <p className="font-medium">{formatFileSize(file.size)}</p>
              </div>
              <div>
                <p className="text-gray-500">Type</p>
                <p className="font-medium">{file.mimeType}</p>
              </div>
              <div>
                <p className="text-gray-500">Uploaded</p>
                <p className="font-medium">{new Date(file.uploadedAt).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-gray-500">Owner</p>
                <p className="font-medium">{file.uploadedBy?.fullName || 'Unknown'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const FileManager: React.FC = () => {
  const { hasAnyRole } = useAuth();
  const [files, setFiles] = useState<FileWithOwner[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [filters] = useState<FileFilters>({});
  const [showUpload, setShowUpload] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FileWithOwner | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [stats, setStats] = useState({
    totalFiles: 0,
    totalSize: 0,
    imageCount: 0,
    documentCount: 0
  });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 24;

  useEffect(() => {
    loadFiles();
    loadStats();
  }, [currentPage, filters, searchQuery]);

  const loadFiles = async () => {
    try {
      setLoading(true);
      const params: any = {
        page: currentPage,
        limit: itemsPerPage,
        search: searchQuery || undefined,
        ...filters
      };

      const response = await apiService.get('/files', { params });
      setFiles(response.data.files);
      setTotalPages(response.data.pagination.pages);
    } catch (error) {
      console.error('Error loading files:', error);
      toast.error('Failed to load files');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await apiService.get('/files/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Error loading file stats:', error);
    }
  };

  const handleUploadComplete = (uploadedFiles: UploadedFile[]) => {
    loadFiles();
    loadStats();
    toast.success(`${uploadedFiles.length} file(s) uploaded successfully`);
  };

  const handleView = (file: FileWithOwner) => {
    setSelectedFile(file);
    setShowPreview(true);
  };

  const handleDownload = (file: FileWithOwner) => {
    const url = file.url || `/api/files/${file.id}`;
    const link = document.createElement('a');
    link.href = url;
    link.download = file.originalName;
    link.click();
  };

  const handleDelete = async (file: FileWithOwner) => {
    if (!window.confirm(`Are you sure you want to delete ${file.originalName}?`)) return;

    try {
      await apiService.delete(`/files/${file.id}`);
      toast.success('File deleted successfully');
      loadFiles();
      loadStats();
    } catch (error) {
      console.error('Error deleting file:', error);
      toast.error('Failed to delete file');
    }
  };

  const canDeleteFiles = hasAnyRole(['ADMIN', 'CORRESPONDENCE_OFFICER']);

  if (loading && files.length === 0) {
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
          <h1 className="text-2xl font-bold text-gray-900">File Manager</h1>
          <p className="text-gray-600 mt-1">Manage and organize all system files</p>
        </div>
        <button
          onClick={() => setShowUpload(!showUpload)}
          className="flex items-center space-x-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700"
        >
          <Upload className="w-4 h-4" />
          <span>Upload Files</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <HardDrive className="w-8 h-8 text-blue-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Total Files</p>
              <p className="text-lg font-bold text-gray-900">{stats.totalFiles}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <HardDrive className="w-8 h-8 text-green-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Storage Used</p>
              <p className="text-lg font-bold text-gray-900">{formatFileSize(stats.totalSize)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <Image className="w-8 h-8 text-purple-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Images</p>
              <p className="text-lg font-bold text-gray-900">{stats.imageCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <FileText className="w-8 h-8 text-orange-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Documents</p>
              <p className="text-lg font-bold text-gray-900">{stats.documentCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Upload Section */}
      {showUpload && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Upload Files</h2>
          <FileUpload
            onUpload={handleUploadComplete}
            maxFiles={10}
            maxSize={50 * 1024 * 1024} // 50MB
            showPreview={false}
          />
        </div>
      )}

      {/* Search and Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex-1 w-full sm:max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <div className="flex items-center border border-gray-300 rounded-lg">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 ${viewMode === 'grid' ? 'bg-primary-100 text-primary-700' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 ${viewMode === 'list' ? 'bg-primary-100 text-primary-700' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* File Display */}
      {viewMode === 'grid' ? (
        <FileGridView
          files={files}
          onView={handleView}
          onDownload={handleDownload}
          onDelete={handleDelete}
          canDelete={canDeleteFiles}
        />
      ) : (
        <FileListView
          files={files}
          onView={handleView}
          onDownload={handleDownload}
          onDelete={handleDelete}
          canDelete={canDeleteFiles}
        />
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center space-x-2">
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
      )}

      {/* Empty State */}
      {!loading && files.length === 0 && (
        <div className="text-center py-12">
          <FolderOpen className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No files found</h3>
          <p className="mt-1 text-sm text-gray-500">
            {searchQuery ? 'No files match your search criteria.' : 'Upload some files to get started.'}
          </p>
        </div>
      )}

      {/* File Preview Modal */}
      <FilePreviewModal
        file={selectedFile}
        isOpen={showPreview}
        onClose={() => {
          setShowPreview(false);
          setSelectedFile(null);
        }}
      />
    </div>
  );
};