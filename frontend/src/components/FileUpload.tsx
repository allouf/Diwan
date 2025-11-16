import React, { useState, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
  Upload, File, X, Image, FileText, Download, Eye, 
  CheckCircle, AlertCircle, Loader2
} from 'lucide-react';
import { apiService } from '../services/api';
import { toast } from 'react-hot-toast';

export interface UploadedFile {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  path: string;
  url?: string;
  thumbnailUrl?: string;
  uploadedAt: string;
}

interface FileUploadProps {
  onUpload?: (files: UploadedFile[]) => void;
  onRemove?: (fileId: string) => void;
  maxFiles?: number;
  maxSize?: number; // in bytes
  accept?: Record<string, string[]>;
  existingFiles?: UploadedFile[];
  disabled?: boolean;
  showPreview?: boolean;
  uploadEndpoint?: string;
}

interface FileWithProgress {
  file: File;
  progress: number;
  status: 'uploading' | 'completed' | 'error';
  uploadedFile?: UploadedFile;
  error?: string;
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const getFileIcon = (mimeType: string) => {
  if (mimeType.startsWith('image/')) {
    return <Image className="w-8 h-8 text-blue-500" />;
  }
  return <FileText className="w-8 h-8 text-gray-500" />;
};

const FilePreview: React.FC<{
  file: UploadedFile;
  onRemove: (fileId: string) => void;
  showActions?: boolean;
}> = ({ file, onRemove, showActions = true }) => {
  const isImage = file.mimeType.startsWith('image/');
  
  return (
    <div className="flex items-center p-3 bg-gray-50 rounded-lg border border-gray-200">
      <div className="flex-shrink-0">
        {isImage && file.thumbnailUrl ? (
          <img
            src={file.thumbnailUrl}
            alt={file.originalName}
            className="w-12 h-12 object-cover rounded"
          />
        ) : (
          <div className="w-12 h-12 flex items-center justify-center bg-white rounded border">
            {getFileIcon(file.mimeType)}
          </div>
        )}
      </div>
      <div className="ml-3 flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">
          {file.originalName}
        </p>
        <p className="text-xs text-gray-500">
          {formatFileSize(file.size)} • {new Date(file.uploadedAt).toLocaleDateString()}
        </p>
      </div>
      {showActions && (
        <div className="ml-3 flex items-center space-x-2">
          <button
            onClick={() => window.open(file.url || `/api/files/${file.id}`, '_blank')}
            className="p-1 text-gray-400 hover:text-blue-600"
            title="View file"
          >
            <Eye className="w-4 h-4" />
          </button>
          <a
            href={file.url || `/api/files/${file.id}`}
            download={file.originalName}
            className="p-1 text-gray-400 hover:text-green-600"
            title="Download file"
          >
            <Download className="w-4 h-4" />
          </a>
          <button
            onClick={() => onRemove(file.id)}
            className="p-1 text-gray-400 hover:text-red-600"
            title="Remove file"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

const FileUploadProgress: React.FC<{
  fileWithProgress: FileWithProgress;
  onRetry: () => void;
}> = ({ fileWithProgress, onRetry }) => {
  const { file, progress, status, error } = fileWithProgress;

  return (
    <div className="flex items-center p-3 bg-white rounded-lg border border-gray-200">
      <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center bg-gray-100 rounded">
        {status === 'uploading' && <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />}
        {status === 'completed' && <CheckCircle className="w-6 h-6 text-green-500" />}
        {status === 'error' && <AlertCircle className="w-6 h-6 text-red-500" />}
      </div>
      <div className="ml-3 flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
        <div className="flex items-center space-x-2">
          <div className="flex-1 bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${
                status === 'error' ? 'bg-red-500' : 
                status === 'completed' ? 'bg-green-500' : 'bg-blue-500'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs text-gray-500">{progress}%</span>
        </div>
        {error && (
          <p className="text-xs text-red-600 mt-1">{error}</p>
        )}
      </div>
      {status === 'error' && (
        <button
          onClick={onRetry}
          className="ml-3 px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
        >
          Retry
        </button>
      )}
    </div>
  );
};

export const FileUpload: React.FC<FileUploadProps> = ({
  onUpload,
  onRemove,
  maxFiles = 10,
  maxSize = 10 * 1024 * 1024, // 10MB default
  accept = {
    'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp'],
    'application/pdf': ['.pdf'],
    'application/msword': ['.doc'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    'text/*': ['.txt']
  },
  existingFiles = [],
  disabled = false,
  showPreview = true,
  uploadEndpoint = '/files/upload'
}) => {
  const [uploadingFiles, setUploadingFiles] = useState<FileWithProgress[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFile = async (file: File): Promise<UploadedFile> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await apiService.post(uploadEndpoint, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  };

  const handleFileUpload = useCallback(async (files: File[]) => {
    if (disabled) return;

    const totalFiles = existingFiles.length + uploadingFiles.length + files.length;
    if (totalFiles > maxFiles) {
      toast.error(`Maximum ${maxFiles} files allowed`);
      return;
    }

    const validFiles = files.filter(file => {
      if (file.size > maxSize) {
        toast.error(`File ${file.name} is too large. Maximum size: ${formatFileSize(maxSize)}`);
        return false;
      }
      return true;
    });

    const newUploadingFiles: FileWithProgress[] = validFiles.map(file => ({
      file,
      progress: 0,
      status: 'uploading'
    }));

    setUploadingFiles(prev => [...prev, ...newUploadingFiles]);

    // Upload files one by one
    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i];
      const fileIndex = uploadingFiles.length + i;

      try {
        // Simulate progress updates
        const progressInterval = setInterval(() => {
          setUploadingFiles(prev => 
            prev.map((f, index) => 
              index === fileIndex ? { ...f, progress: Math.min(f.progress + 10, 90) } : f
            )
          );
        }, 200);

        const uploadedFile = await uploadFile(file);

        clearInterval(progressInterval);

        setUploadingFiles(prev => 
          prev.map((f, index) => 
            index === fileIndex 
              ? { ...f, progress: 100, status: 'completed', uploadedFile }
              : f
          )
        );

        // Remove from uploading list after a brief delay
        setTimeout(() => {
          setUploadingFiles(prev => prev.filter((_, index) => index !== fileIndex));
        }, 1000);

        if (onUpload) {
          onUpload([uploadedFile]);
        }

        toast.success(`File ${file.name} uploaded successfully`);

      } catch (error: any) {
        setUploadingFiles(prev => 
          prev.map((f, index) => 
            index === fileIndex 
              ? { ...f, progress: 0, status: 'error', error: error.message || 'Upload failed' }
              : f
          )
        );
        
        toast.error(`Failed to upload ${file.name}`);
      }
    }
  }, [disabled, existingFiles.length, maxFiles, maxSize, uploadEndpoint, onUpload, uploadingFiles.length]);

  const retryUpload = useCallback((fileIndex: number) => {
    const fileWithProgress = uploadingFiles[fileIndex];
    if (fileWithProgress) {
      setUploadingFiles(prev => 
        prev.map((f, index) => 
          index === fileIndex ? { ...f, progress: 0, status: 'uploading', error: undefined } : f
        )
      );
      handleFileUpload([fileWithProgress.file]);
    }
  }, [uploadingFiles, handleFileUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleFileUpload,
    accept,
    disabled,
    multiple: maxFiles > 1
  });

  const handleRemoveFile = (fileId: string) => {
    if (onRemove) {
      onRemove(fileId);
    }
  };

  const openFileDialog = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="w-full">
      {/* Upload Area */}
      <div
        {...getRootProps()}
        className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          disabled
            ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
            : isDragActive
            ? 'border-primary-400 bg-primary-50'
            : 'border-gray-300 hover:border-primary-400 cursor-pointer'
        }`}
      >
        <input {...getInputProps()} ref={fileInputRef} />
        
        <div className="space-y-2">
          <Upload className={`mx-auto h-12 w-12 ${
            disabled ? 'text-gray-400' : 'text-gray-500'
          }`} />
          
          <div>
            <p className={`text-lg font-medium ${
              disabled ? 'text-gray-400' : 'text-gray-700'
            }`}>
              {isDragActive ? 'Drop files here...' : 'Drag & drop files here'}
            </p>
            <p className={`text-sm ${disabled ? 'text-gray-400' : 'text-gray-500'}`}>
              or{' '}
              <button
                type="button"
                onClick={openFileDialog}
                disabled={disabled}
                className="text-primary-600 hover:text-primary-700 font-medium underline"
              >
                browse files
              </button>
            </p>
          </div>
          
          <p className="text-xs text-gray-400">
            Maximum {maxFiles} files, up to {formatFileSize(maxSize)} each
          </p>
        </div>
      </div>

      {/* Uploading Files */}
      {uploadingFiles.length > 0 && (
        <div className="mt-4 space-y-2">
          <h4 className="text-sm font-medium text-gray-700">Uploading...</h4>
          {uploadingFiles.map((fileWithProgress, index) => (
            <FileUploadProgress
              key={`${fileWithProgress.file.name}-${index}`}
              fileWithProgress={fileWithProgress}
              onRetry={() => retryUpload(index)}
            />
          ))}
        </div>
      )}

      {/* Existing Files */}
      {showPreview && existingFiles.length > 0 && (
        <div className="mt-4 space-y-2">
          <h4 className="text-sm font-medium text-gray-700">
            Files ({existingFiles.length})
          </h4>
          {existingFiles.map((file) => (
            <FilePreview
              key={file.id}
              file={file}
              onRemove={handleRemoveFile}
            />
          ))}
        </div>
      )}

      {/* File Limit Warning */}
      {existingFiles.length >= maxFiles && (
        <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            Maximum file limit reached ({maxFiles} files). Remove files to upload new ones.
          </p>
        </div>
      )}
    </div>
  );
};