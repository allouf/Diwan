import React, { useState, useEffect } from 'react';
import { 
  FileText, Users, Clock, CheckCircle, AlertCircle, 
  TrendingUp, Calendar, Bell, Activity
} from 'lucide-react';
import { apiService } from '../services/api';
import { toast } from 'react-hot-toast';

interface DashboardStats {
  totalDocuments: number;
  pendingDocuments: number;
  completedDocuments: number;
  totalUsers: number;
  documentsThisMonth: number;
  pendingActions: number;
}

interface RecentDocument {
  id: string;
  subject: string;
  referenceNumber: string;
  status: string;
  createdAt: string;
  createdBy?: {
    fullName: string;
  };
}

interface RecentActivity {
  id: string;
  type: string;
  description: string;
  performedBy: {
    fullName: string;
  };
  createdAt: string;
}

const StatCard: React.FC<{
  title: string;
  value: number;
  icon: React.ComponentType<any>;
  color: string;
  trend?: number;
}> = ({ title, value, icon: Icon, color, trend }) => (
  <div className="bg-white rounded-lg shadow-sm p-6 border border-secondary-200">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-secondary-600">{title}</p>
        <p className="text-2xl font-bold text-secondary-900 mt-2">
          {value.toLocaleString()}
        </p>
        {trend !== undefined && (
          <p className={`text-sm mt-1 flex items-center ${
            trend >= 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            <TrendingUp className="w-4 h-4 mr-1" />
            {trend >= 0 ? '+' : ''}{trend}% from last month
          </p>
        )}
      </div>
      <div className={`p-3 rounded-full ${color}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
    </div>
  </div>
);

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const getStatusConfig = (status: string) => {
    switch (status.toLowerCase()) {
      case 'draft':
        return { color: 'bg-secondary-100 text-secondary-800', label: 'Draft' };
      case 'pending':
        return { color: 'bg-yellow-100 text-yellow-800', label: 'Pending' };
      case 'in_progress':
        return { color: 'bg-blue-100 text-blue-800', label: 'In Progress' };
      case 'completed':
        return { color: 'bg-green-100 text-green-800', label: 'Completed' };
      case 'archived':
        return { color: 'bg-secondary-100 text-secondary-800', label: 'Archived' };
      default:
        return { color: 'bg-secondary-100 text-secondary-800', label: status };
    }
  };

  const config = getStatusConfig(status);
  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-full ${config.color}`}>
      {config.label}
    </span>
  );
};

export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalDocuments: 0,
    pendingDocuments: 0,
    completedDocuments: 0,
    totalUsers: 0,
    documentsThisMonth: 0,
    pendingActions: 0
  });
  const [recentDocuments, setRecentDocuments] = useState<RecentDocument[]>([]);
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Load dashboard statistics
      const statsResponse = await apiService.get('/dashboard/stats');
      setStats(statsResponse.data);

      // Load recent documents
      const documentsResponse = await apiService.get('/documents', {
        params: { limit: 5, sort: 'createdAt', order: 'desc' }
      });
      setRecentDocuments(documentsResponse.data.documents || []);

      // Load recent activities
      const activitiesResponse = await apiService.get('/activities', {
        params: { limit: 10 }
      });
      setRecentActivities(activitiesResponse.data.activities || []);

    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getActivityIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'document_created':
        return FileText;
      case 'document_updated':
        return Clock;
      case 'user_login':
        return Users;
      default:
        return Activity;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-secondary-900">Dashboard</h1>
        <p className="text-secondary-600 mt-1">
          Welcome back! Here's what's happening with your correspondence management system.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Documents"
          value={stats.totalDocuments}
          icon={FileText}
          color="bg-blue-500"
          trend={12}
        />
        <StatCard
          title="Pending Documents"
          value={stats.pendingDocuments}
          icon={Clock}
          color="bg-yellow-500"
          trend={-5}
        />
        <StatCard
          title="Completed Documents"
          value={stats.completedDocuments}
          icon={CheckCircle}
          color="bg-green-500"
          trend={18}
        />
        <StatCard
          title="Total Users"
          value={stats.totalUsers}
          icon={Users}
          color="bg-purple-500"
        />
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow-sm p-6 border border-secondary-200">
        <h2 className="text-lg font-semibold text-secondary-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="flex items-center p-4 border border-primary-200 rounded-lg hover:bg-primary-50 transition-colors">
            <FileText className="w-5 h-5 text-primary-600 mr-3" />
            <span className="text-sm font-medium text-primary-700">Create New Document</span>
          </button>
          <button className="flex items-center p-4 border border-secondary-200 rounded-lg hover:bg-secondary-50 transition-colors">
            <Bell className="w-5 h-5 text-secondary-600 mr-3" />
            <span className="text-sm font-medium text-secondary-700">View Notifications</span>
          </button>
          <button className="flex items-center p-4 border border-secondary-200 rounded-lg hover:bg-secondary-50 transition-colors">
            <Calendar className="w-5 h-5 text-secondary-600 mr-3" />
            <span className="text-sm font-medium text-secondary-700">Schedule Meeting</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Documents */}
        <div className="bg-white rounded-lg shadow-sm p-6 border border-secondary-200">
          <h2 className="text-lg font-semibold text-secondary-900 mb-4">Recent Documents</h2>
          {recentDocuments.length > 0 ? (
            <div className="space-y-4">
              {recentDocuments.map((document) => (
                <div key={document.id} className="flex items-center justify-between py-3 border-b border-secondary-100 last:border-b-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-secondary-900 truncate">
                      {document.subject}
                    </p>
                    <p className="text-xs text-secondary-500">
                      {document.referenceNumber} • {document.createdBy?.fullName}
                    </p>
                    <p className="text-xs text-secondary-400 mt-1">
                      {formatDate(document.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <StatusBadge status={document.status} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-secondary-500 text-sm">No recent documents</p>
          )}
        </div>

        {/* Recent Activities */}
        <div className="bg-white rounded-lg shadow-sm p-6 border border-secondary-200">
          <h2 className="text-lg font-semibold text-secondary-900 mb-4">Recent Activities</h2>
          {recentActivities.length > 0 ? (
            <div className="space-y-4">
              {recentActivities.map((activity) => {
                const ActivityIcon = getActivityIcon(activity.type);
                return (
                  <div key={activity.id} className="flex items-start space-x-3 py-2">
                    <div className="flex-shrink-0">
                      <div className="h-8 w-8 bg-secondary-100 rounded-full flex items-center justify-center">
                        <ActivityIcon className="w-4 h-4 text-secondary-600" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-secondary-900">
                        {activity.description}
                      </p>
                      <p className="text-xs text-secondary-500 mt-1">
                        {activity.performedBy.fullName} • {formatDate(activity.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-secondary-500 text-sm">No recent activities</p>
          )}
        </div>
      </div>

      {/* Pending Actions Alert */}
      {stats.pendingActions > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-yellow-600 mr-3" />
            <div>
              <p className="text-sm font-medium text-yellow-800">
                You have {stats.pendingActions} pending action{stats.pendingActions !== 1 ? 's' : ''}
              </p>
              <p className="text-sm text-yellow-700 mt-1">
                Review and complete pending tasks to keep your workflow up to date.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};