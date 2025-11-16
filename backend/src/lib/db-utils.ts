import prisma from './prisma';

/**
 * Generate a unique reference number for documents
 * Format: HIAST-YYYY-XXXXX (e.g., HIAST-2024-00001)
 */
export const generateReferenceNumber = async (): Promise<string> => {
  const prefix = process.env.REFERENCE_NUMBER_PREFIX || 'HIAST';
  const year = process.env.REFERENCE_NUMBER_YEAR || new Date().getFullYear().toString();
  
  // Get the count of documents created this year
  const startOfYear = new Date(`${year}-01-01`);
  const endOfYear = new Date(`${year}-12-31`);
  
  const count = await prisma.document.count({
    where: {
      createdAt: {
        gte: startOfYear,
        lte: endOfYear,
      },
    },
  });
  
  // Increment by 1 and pad with zeros
  const sequenceNumber = (count + 1).toString().padStart(5, '0');
  
  return `${prefix}-${year}-${sequenceNumber}`;
};

/**
 * Database health check function
 */
export const checkDatabaseHealth = async (): Promise<{
  status: 'healthy' | 'unhealthy';
  message: string;
  timestamp: Date;
}> => {
  try {
    // Try to query the database
    await prisma.$queryRaw`SELECT 1`;
    
    return {
      status: 'healthy',
      message: 'Database connection is working',
      timestamp: new Date(),
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: `Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      timestamp: new Date(),
    };
  }
};

/**
 * Get document statistics for dashboard
 */
export const getDocumentStats = async () => {
  const [total, pending, thisWeek, urgent, completedThisMonth] = await Promise.all([
    // Total documents
    prisma.document.count(),
    
    // Pending documents (not completed or archived)
    prisma.document.count({
      where: {
        status: {
          notIn: ['COMPLETED', 'ARCHIVED'],
        },
      },
    }),
    
    // This week's documents
    prisma.document.count({
      where: {
        dateReceived: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      },
    }),
    
    // Urgent documents
    prisma.document.count({
      where: {
        priority: 'URGENT',
        status: {
          notIn: ['COMPLETED', 'ARCHIVED'],
        },
      },
    }),
    
    // Completed this month
    prisma.document.count({
      where: {
        status: 'COMPLETED',
        updatedAt: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      },
    }),
  ]);
  
  return {
    totalDocuments: total,
    pendingDocuments: pending,
    thisWeekDocuments: thisWeek,
    urgentDocuments: urgent,
    completedThisMonth,
  };
};