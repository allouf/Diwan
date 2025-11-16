import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import { 
  getThumbnailPath, 
  getAvatarPath, 
  generateFileName,
  deleteFile 
} from './fileStorage';

// Image processing configuration
export const IMAGE_CONFIG = {
  AVATAR: {
    WIDTH: 150,
    HEIGHT: 150,
    QUALITY: 85,
    FORMAT: 'jpeg' as const
  },
  THUMBNAIL: {
    WIDTH: 300,
    HEIGHT: 200,
    QUALITY: 80,
    FORMAT: 'jpeg' as const
  },
  WATERMARK: {
    TEXT: 'HIAST CMS',
    FONT_SIZE: 24,
    OPACITY: 0.3,
    COLOR: 'rgba(255, 255, 255, 0.7)'
  }
};

// Avatar processing
export const processAvatar = async (inputPath: string, userId: string): Promise<string> => {
  try {
    const outputFileName = generateFileName(`avatar_${userId}.jpg`, 'avatar');
    const outputPath = getAvatarPath(outputFileName);

    await sharp(inputPath)
      .resize(IMAGE_CONFIG.AVATAR.WIDTH, IMAGE_CONFIG.AVATAR.HEIGHT, {
        fit: 'cover',
        position: 'center'
      })
      .jpeg({ 
        quality: IMAGE_CONFIG.AVATAR.QUALITY,
        progressive: true
      })
      .toFile(outputPath);

    // Delete original file after processing
    await deleteFile(inputPath);

    return outputFileName;
  } catch (error) {
    console.error('Error processing avatar:', error);
    throw new Error('Failed to process avatar image');
  }
};

// Thumbnail generation for documents
export const generateThumbnail = async (inputPath: string, originalFileName: string): Promise<string | null> => {
  try {
    const outputFileName = generateFileName(`thumb_${originalFileName}.jpg`, 'thumb');
    const outputPath = getThumbnailPath(outputFileName);

    // Check if input is an image
    const metadata = await sharp(inputPath).metadata();
    
    if (!metadata.width || !metadata.height) {
      return null; // Not a valid image
    }

    await sharp(inputPath)
      .resize(IMAGE_CONFIG.THUMBNAIL.WIDTH, IMAGE_CONFIG.THUMBNAIL.HEIGHT, {
        fit: 'cover',
        position: 'center'
      })
      .jpeg({ 
        quality: IMAGE_CONFIG.THUMBNAIL.QUALITY,
        progressive: true
      })
      .toFile(outputPath);

    return outputFileName;
  } catch (error) {
    console.error('Error generating thumbnail:', error);
    return null; // Return null for non-image files
  }
};

// Add watermark to sensitive documents
export const addWatermark = async (inputPath: string, watermarkText?: string): Promise<string> => {
  try {
    const text = watermarkText || IMAGE_CONFIG.WATERMARK.TEXT;
    const outputFileName = generateFileName(path.basename(inputPath, path.extname(inputPath)) + '_watermarked.jpg');
    const outputPath = path.join(path.dirname(inputPath), outputFileName);

    // Create watermark SVG
    const watermarkSvg = `
      <svg width="400" height="100" xmlns="http://www.w3.org/2000/svg">
        <text x="50%" y="50%" 
              font-family="Arial, sans-serif" 
              font-size="${IMAGE_CONFIG.WATERMARK.FONT_SIZE}" 
              font-weight="bold"
              text-anchor="middle" 
              dominant-baseline="middle"
              fill="${IMAGE_CONFIG.WATERMARK.COLOR}"
              opacity="${IMAGE_CONFIG.WATERMARK.OPACITY}"
              transform="rotate(-45 200 50)">${text}</text>
      </svg>
    `;

    const watermarkBuffer = Buffer.from(watermarkSvg);

    await sharp(inputPath)
      .composite([{ 
        input: watermarkBuffer,
        gravity: 'center',
        blend: 'overlay'
      }])
      .jpeg({ quality: 85 })
      .toFile(outputPath);

    return outputFileName;
  } catch (error) {
    console.error('Error adding watermark:', error);
    throw new Error('Failed to add watermark to image');
  }
};

// Optimize image file size
export const optimizeImage = async (inputPath: string, targetSizeKB?: number): Promise<void> => {
  try {
    const targetSize = targetSizeKB ? targetSizeKB * 1024 : 500 * 1024; // Default 500KB
    let quality = 85;
    let outputBuffer: Buffer;

    do {
      outputBuffer = await sharp(inputPath)
        .jpeg({ quality, progressive: true })
        .toBuffer();
      
      if (outputBuffer.length <= targetSize || quality <= 20) {
        break;
      }
      
      quality -= 10;
    } while (quality > 20);

    await fs.writeFile(inputPath, outputBuffer);
  } catch (error) {
    console.error('Error optimizing image:', error);
    throw new Error('Failed to optimize image');
  }
};

// Extract image metadata
export const extractImageMetadata = async (filePath: string) => {
  try {
    const metadata = await sharp(filePath).metadata();
    const stats = await fs.stat(filePath);

    return {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      size: stats.size,
      density: metadata.density,
      hasProfile: metadata.hasProfile,
      hasAlpha: metadata.hasAlpha,
      orientation: metadata.orientation,
      colorspace: metadata.space,
      channels: metadata.channels,
      isAnimated: metadata.pages && metadata.pages > 1
    };
  } catch (error) {
    console.error('Error extracting image metadata:', error);
    return null;
  }
};

// Convert image format
export const convertImageFormat = async (
  inputPath: string, 
  outputFormat: 'jpeg' | 'png' | 'webp',
  quality: number = 85
): Promise<string> => {
  try {
    const outputFileName = generateFileName(
      path.basename(inputPath, path.extname(inputPath)) + `.${outputFormat}`
    );
    const outputPath = path.join(path.dirname(inputPath), outputFileName);

    let sharpInstance = sharp(inputPath);

    switch (outputFormat) {
      case 'jpeg':
        sharpInstance = sharpInstance.jpeg({ quality, progressive: true });
        break;
      case 'png':
        sharpInstance = sharpInstance.png({ 
          quality, 
          compressionLevel: 9,
          progressive: true 
        });
        break;
      case 'webp':
        sharpInstance = sharpInstance.webp({ quality, effort: 6 });
        break;
    }

    await sharpInstance.toFile(outputPath);
    return outputFileName;
  } catch (error) {
    console.error('Error converting image format:', error);
    throw new Error(`Failed to convert image to ${outputFormat}`);
  }
};

// Create responsive images (multiple sizes)
export const createResponsiveImages = async (inputPath: string, sizes: number[] = [300, 600, 1200]): Promise<string[]> => {
  const results: string[] = [];

  try {
    for (const size of sizes) {
      const outputFileName = generateFileName(
        `${path.basename(inputPath, path.extname(inputPath))}_${size}w.jpg`
      );
      const outputPath = path.join(path.dirname(inputPath), outputFileName);

      await sharp(inputPath)
        .resize(size, null, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ quality: 85, progressive: true })
        .toFile(outputPath);

      results.push(outputFileName);
    }

    return results;
  } catch (error) {
    console.error('Error creating responsive images:', error);
    throw new Error('Failed to create responsive images');
  }
};

// Remove EXIF data from images (privacy)
export const stripExifData = async (inputPath: string): Promise<void> => {
  try {
    const outputBuffer = await sharp(inputPath)
      .rotate() // Auto-rotate based on EXIF orientation
      .withMetadata(false) // Remove all metadata
      .toBuffer();

    await fs.writeFile(inputPath, outputBuffer);
  } catch (error) {
    console.error('Error stripping EXIF data:', error);
    throw new Error('Failed to strip EXIF data');
  }
};

// Batch image processing
export const batchProcessImages = async (
  filePaths: string[],
  operations: {
    resize?: { width: number; height: number };
    optimize?: boolean;
    watermark?: string;
    format?: 'jpeg' | 'png' | 'webp';
    quality?: number;
  }
): Promise<string[]> => {
  const results: string[] = [];

  try {
    for (const filePath of filePaths) {
      let sharpInstance = sharp(filePath);

      // Apply resize
      if (operations.resize) {
        sharpInstance = sharpInstance.resize(
          operations.resize.width, 
          operations.resize.height,
          { fit: 'cover', position: 'center' }
        );
      }

      // Apply format conversion
      const format = operations.format || 'jpeg';
      const quality = operations.quality || 85;

      switch (format) {
        case 'jpeg':
          sharpInstance = sharpInstance.jpeg({ quality, progressive: true });
          break;
        case 'png':
          sharpInstance = sharpInstance.png({ quality, compressionLevel: 9 });
          break;
        case 'webp':
          sharpInstance = sharpInstance.webp({ quality, effort: 6 });
          break;
      }

      // Generate output path
      const outputFileName = generateFileName(
        `processed_${path.basename(filePath, path.extname(filePath))}.${format}`
      );
      const outputPath = path.join(path.dirname(filePath), outputFileName);

      await sharpInstance.toFile(outputPath);
      results.push(outputFileName);

      // Add watermark if requested
      if (operations.watermark) {
        await addWatermark(outputPath, operations.watermark);
      }
    }

    return results;
  } catch (error) {
    console.error('Error in batch processing:', error);
    throw new Error('Failed to process images in batch');
  }
};

// Validate image integrity
export const validateImageIntegrity = async (filePath: string): Promise<boolean> => {
  try {
    const metadata = await sharp(filePath).metadata();
    return !!(metadata.width && metadata.height && metadata.format);
  } catch (error) {
    console.error('Invalid image file:', error);
    return false;
  }
};