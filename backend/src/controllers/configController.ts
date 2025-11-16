import { Request, Response } from 'express';
import { PrismaClient } from '../generated/prisma';
import { logActivity } from '../lib/db-utils';
import { z } from 'zod';

const prisma = new PrismaClient();

// Validation schemas
const updateConfigSchema = z.object({
  key: z.string().min(1),
  value: z.string(),
  description: z.string().optional()
});

const bulkUpdateConfigSchema = z.object({
  configs: z.array(z.object({
    key: z.string().min(1),
    value: z.string(),
    description: z.string().optional()
  })).min(1)
});

// Get all system configurations
export const getSystemConfigurations = async (req: Request, res: Response) => {
  try {
    const currentUser = req.user!;

    // Only admins can view system configurations
    if (currentUser.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Insufficient permissions to view system configurations' });
    }

    const configurations = await prisma.systemConfig.findMany({
      select: {
        id: true,
        key: true,
        value: true,
        description: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: { key: 'asc' }
    });

    res.json({ configurations });
  } catch (error) {
    console.error('Error fetching system configurations:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Get specific configuration by key
export const getConfigurationByKey = async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const currentUser = req.user!;

    // Only admins can view individual configurations
    if (currentUser.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Insufficient permissions to view configuration' });
    }

    const configuration = await prisma.systemConfig.findUnique({
      where: { key },
      select: {
        id: true,
        key: true,
        value: true,
        description: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!configuration) {
      return res.status(404).json({ message: 'Configuration not found' });
    }

    res.json(configuration);
  } catch (error) {
    console.error('Error fetching configuration:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Update or create system configuration
export const updateSystemConfiguration = async (req: Request, res: Response) => {
  try {
    const validatedData = updateConfigSchema.parse(req.body);
    const currentUser = req.user!;

    // Only admins can update system configurations
    if (currentUser.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Insufficient permissions to update system configuration' });
    }

    const { key, value, description } = validatedData;

    // Check if configuration exists
    const existingConfig = await prisma.systemConfig.findUnique({
      where: { key }
    });

    let configuration;
    let action;

    if (existingConfig) {
      // Update existing configuration
      configuration = await prisma.systemConfig.update({
        where: { key },
        data: {
          value,
          description,
          updatedAt: new Date()
        },
        select: {
          id: true,
          key: true,
          value: true,
          description: true,
          createdAt: true,
          updatedAt: true
        }
      });
      action = 'UPDATE_CONFIG';
    } else {
      // Create new configuration
      configuration = await prisma.systemConfig.create({
        data: {
          key,
          value,
          description: description || null
        },
        select: {
          id: true,
          key: true,
          value: true,
          description: true,
          createdAt: true,
          updatedAt: true
        }
      });
      action = 'CREATE_CONFIG';
    }

    // Log activity
    await logActivity(
      currentUser.id,
      action,
      `${action === 'UPDATE_CONFIG' ? 'Updated' : 'Created'} system configuration: ${key} = ${value}`
    );

    res.json(configuration);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: 'Validation error', 
        errors: error.errors 
      });
    }
    console.error('Error updating system configuration:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Bulk update system configurations
export const bulkUpdateSystemConfigurations = async (req: Request, res: Response) => {
  try {
    const validatedData = bulkUpdateConfigSchema.parse(req.body);
    const currentUser = req.user!;

    // Only admins can update system configurations
    if (currentUser.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Insufficient permissions to update system configurations' });
    }

    const { configs } = validatedData;
    const results = [];

    // Process each configuration
    for (const config of configs) {
      const { key, value, description } = config;

      // Check if configuration exists
      const existingConfig = await prisma.systemConfig.findUnique({
        where: { key }
      });

      let configuration;
      let action;

      if (existingConfig) {
        // Update existing configuration
        configuration = await prisma.systemConfig.update({
          where: { key },
          data: {
            value,
            description,
            updatedAt: new Date()
          }
        });
        action = 'UPDATE_CONFIG';
      } else {
        // Create new configuration
        configuration = await prisma.systemConfig.create({
          data: {
            key,
            value,
            description: description || null
          }
        });
        action = 'CREATE_CONFIG';
      }

      results.push({
        ...configuration,
        action
      });

      // Log activity
      await logActivity(
        currentUser.id,
        action,
        `${action === 'UPDATE_CONFIG' ? 'Updated' : 'Created'} system configuration: ${key} = ${value}`
      );
    }

    res.json({
      message: `Successfully processed ${results.length} configurations`,
      configurations: results
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: 'Validation error', 
        errors: error.errors 
      });
    }
    console.error('Error bulk updating system configurations:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Delete system configuration
export const deleteSystemConfiguration = async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const currentUser = req.user!;

    // Only admins can delete system configurations
    if (currentUser.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Insufficient permissions to delete system configuration' });
    }

    // Check if configuration exists
    const existingConfig = await prisma.systemConfig.findUnique({
      where: { key }
    });

    if (!existingConfig) {
      return res.status(404).json({ message: 'Configuration not found' });
    }

    // Delete configuration
    await prisma.systemConfig.delete({
      where: { key }
    });

    // Log activity
    await logActivity(
      currentUser.id,
      'DELETE_CONFIG',
      `Deleted system configuration: ${key}`
    );

    res.json({ message: 'Configuration deleted successfully' });
  } catch (error) {
    console.error('Error deleting system configuration:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Get public configurations (non-sensitive configs that frontend can access)
export const getPublicConfigurations = async (req: Request, res: Response) => {
  try {
    // Define which configurations are public (safe to expose to frontend)
    const publicKeys = [
      'app_name',
      'app_version',
      'organization_name',
      'organization_logo',
      'max_file_size',
      'allowed_file_types',
      'default_language',
      'default_timezone',
      'maintenance_mode',
      'registration_enabled',
      'email_notifications_enabled',
      'auto_archive_days'
    ];

    const publicConfigurations = await prisma.systemConfig.findMany({
      where: {
        key: { in: publicKeys }
      },
      select: {
        key: true,
        value: true,
        description: true
      }
    });

    // Convert to key-value object for easier frontend consumption
    const configMap = publicConfigurations.reduce((acc, config) => {
      acc[config.key] = {
        value: config.value,
        description: config.description
      };
      return acc;
    }, {} as Record<string, { value: string; description: string | null }>);

    res.json(configMap);
  } catch (error) {
    console.error('Error fetching public configurations:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Reset configurations to defaults
export const resetToDefaults = async (req: Request, res: Response) => {
  try {
    const currentUser = req.user!;

    // Only admins can reset configurations
    if (currentUser.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Insufficient permissions to reset configurations' });
    }

    // Define default configurations for HIAST CMS
    const defaultConfigs = [
      { key: 'app_name', value: 'HIAST Correspondence Management System', description: 'Application name' },
      { key: 'app_version', value: '1.0.0', description: 'Current application version' },
      { key: 'organization_name', value: 'Higher Institute for Applied Science and Technology', description: 'Organization name' },
      { key: 'max_file_size', value: '10485760', description: 'Maximum file size in bytes (10MB)' },
      { key: 'allowed_file_types', value: 'pdf,doc,docx,txt,jpg,jpeg,png,gif', description: 'Comma-separated list of allowed file extensions' },
      { key: 'default_language', value: 'en', description: 'Default system language' },
      { key: 'default_timezone', value: 'Asia/Damascus', description: 'Default system timezone' },
      { key: 'maintenance_mode', value: 'false', description: 'Enable/disable maintenance mode' },
      { key: 'registration_enabled', value: 'false', description: 'Allow user self-registration' },
      { key: 'email_notifications_enabled', value: 'true', description: 'Enable email notifications' },
      { key: 'auto_archive_days', value: '365', description: 'Days after which completed documents are auto-archived' },
      { key: 'session_timeout', value: '3600', description: 'Session timeout in seconds' },
      { key: 'password_min_length', value: '6', description: 'Minimum password length' },
      { key: 'max_login_attempts', value: '5', description: 'Maximum failed login attempts before lockout' }
    ];

    // Delete all existing configurations
    await prisma.systemConfig.deleteMany();

    // Insert default configurations
    await prisma.systemConfig.createMany({
      data: defaultConfigs
    });

    // Log activity
    await logActivity(
      currentUser.id,
      'RESET_CONFIG',
      'Reset all system configurations to defaults'
    );

    res.json({
      message: 'System configurations reset to defaults successfully',
      configurationsCount: defaultConfigs.length
    });
  } catch (error) {
    console.error('Error resetting configurations:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Export configurations (backup)
export const exportConfigurations = async (req: Request, res: Response) => {
  try {
    const currentUser = req.user!;

    // Only admins can export configurations
    if (currentUser.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Insufficient permissions to export configurations' });
    }

    const configurations = await prisma.systemConfig.findMany({
      select: {
        key: true,
        value: true,
        description: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: { key: 'asc' }
    });

    const exportData = {
      exportedAt: new Date().toISOString(),
      exportedBy: currentUser.fullName,
      configurationsCount: configurations.length,
      configurations
    };

    // Log activity
    await logActivity(
      currentUser.id,
      'EXPORT_CONFIG',
      `Exported ${configurations.length} system configurations`
    );

    res.json(exportData);
  } catch (error) {
    console.error('Error exporting configurations:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Import configurations (restore)
export const importConfigurations = async (req: Request, res: Response) => {
  try {
    const { configurations, overwrite = false } = req.body;
    const currentUser = req.user!;

    // Only admins can import configurations
    if (currentUser.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Insufficient permissions to import configurations' });
    }

    if (!Array.isArray(configurations)) {
      return res.status(400).json({ message: 'Configurations must be an array' });
    }

    let imported = 0;
    let updated = 0;
    let skipped = 0;

    for (const config of configurations) {
      const { key, value, description } = config;

      if (!key || !value) {
        skipped++;
        continue;
      }

      const existing = await prisma.systemConfig.findUnique({
        where: { key }
      });

      if (existing && !overwrite) {
        skipped++;
        continue;
      }

      if (existing) {
        await prisma.systemConfig.update({
          where: { key },
          data: {
            value,
            description,
            updatedAt: new Date()
          }
        });
        updated++;
      } else {
        await prisma.systemConfig.create({
          data: {
            key,
            value,
            description: description || null
          }
        });
        imported++;
      }
    }

    // Log activity
    await logActivity(
      currentUser.id,
      'IMPORT_CONFIG',
      `Imported configurations: ${imported} new, ${updated} updated, ${skipped} skipped`
    );

    res.json({
      message: 'Configuration import completed',
      summary: {
        imported,
        updated,
        skipped,
        total: configurations.length
      }
    });
  } catch (error) {
    console.error('Error importing configurations:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};