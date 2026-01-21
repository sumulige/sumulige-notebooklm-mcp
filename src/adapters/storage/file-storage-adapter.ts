/**
 * File Storage Adapter
 *
 * Implements IStoragePort using Node.js filesystem APIs.
 * Uses async operations throughout for better performance.
 *
 * This adapter:
 * - Provides async file I/O
 * - Handles JSON serialization/deserialization
 * - Creates directories automatically
 * - Implements safe file operations
 */

import { injectable } from "tsyringe";
import fs from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import type {
  IStoragePort,
  StorageOptions,
  FileInfo,
} from "../../core/ports/storage-port.js";
import { log } from "../../utils/logger.js";

/**
 * File Storage Adapter
 *
 * Provides filesystem operations with async I/O.
 */
@injectable()
export class FileStorageAdapter implements IStoragePort {
  async readFile(filePath: string, options?: StorageOptions): Promise<string | null> {
    try {
      const content = await fs.readFile(filePath, {
        encoding: options?.encoding ?? "utf-8",
      });
      return content;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }
      log.warning(`[FileStorage] Failed to read file ${filePath}: ${error}`);
      return null;
    }
  }

  async readJson<T = unknown>(filePath: string): Promise<T | null> {
    const content = await this.readFile(filePath);
    if (content === null) {
      return null;
    }

    try {
      return JSON.parse(content) as T;
    } catch (error) {
      log.warning(`[FileStorage] Failed to parse JSON from ${filePath}: ${error}`);
      return null;
    }
  }

  async writeFile(
    filePath: string,
    content: string,
    options?: StorageOptions
  ): Promise<boolean> {
    try {
      // Create parent directory if needed
      if (options?.createDirs !== false) {
        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true });
      }

      await fs.writeFile(filePath, content, {
        encoding: options?.encoding ?? "utf-8",
      });
      return true;
    } catch (error) {
      log.warning(`[FileStorage] Failed to write file ${filePath}: ${error}`);
      return false;
    }
  }

  async writeJson<T = unknown>(
    filePath: string,
    data: T,
    pretty = true
  ): Promise<boolean> {
    try {
      const content = pretty
        ? JSON.stringify(data, null, 2)
        : JSON.stringify(data);
      return this.writeFile(filePath, content);
    } catch (error) {
      log.warning(`[FileStorage] Failed to serialize JSON for ${filePath}: ${error}`);
      return false;
    }
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async deleteFile(filePath: string): Promise<boolean> {
    try {
      await fs.unlink(filePath);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return true; // File doesn't exist, consider it deleted
      }
      log.warning(`[FileStorage] Failed to delete file ${filePath}: ${error}`);
      return false;
    }
  }

  async getFileInfo(filePath: string): Promise<FileInfo> {
    try {
      const stats = await fs.stat(filePath);
      return {
        path: filePath,
        exists: true,
        size: stats.size,
        modifiedAt: stats.mtime,
        createdAt: stats.birthtime,
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return {
          path: filePath,
          exists: false,
        };
      }
      return {
        path: filePath,
        exists: existsSync(filePath),
      };
    }
  }

  async createDirectory(dirPath: string): Promise<boolean> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
      return true;
    } catch (error) {
      log.warning(`[FileStorage] Failed to create directory ${dirPath}: ${error}`);
      return false;
    }
  }

  async deleteDirectory(dirPath: string): Promise<boolean> {
    try {
      await fs.rm(dirPath, { recursive: true, force: true });
      return true;
    } catch (error) {
      log.warning(`[FileStorage] Failed to delete directory ${dirPath}: ${error}`);
      return false;
    }
  }

  async listDirectory(dirPath: string, pattern?: string): Promise<string[]> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      let files = entries
        .filter((e) => e.isFile())
        .map((e) => path.join(dirPath, e.name));

      if (pattern) {
        const regex = new RegExp(pattern.replace(/\*/g, ".*"));
        files = files.filter((f) => regex.test(path.basename(f)));
      }

      return files;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }
      log.warning(`[FileStorage] Failed to list directory ${dirPath}: ${error}`);
      return [];
    }
  }

  async copyFile(source: string, destination: string): Promise<boolean> {
    try {
      // Create destination directory if needed
      const dir = path.dirname(destination);
      await fs.mkdir(dir, { recursive: true });

      await fs.copyFile(source, destination);
      return true;
    } catch (error) {
      log.warning(`[FileStorage] Failed to copy ${source} to ${destination}: ${error}`);
      return false;
    }
  }

  async moveFile(source: string, destination: string): Promise<boolean> {
    try {
      // Create destination directory if needed
      const dir = path.dirname(destination);
      await fs.mkdir(dir, { recursive: true });

      await fs.rename(source, destination);
      return true;
    } catch (error) {
      // rename might fail across filesystems, try copy+delete
      try {
        await fs.copyFile(source, destination);
        await fs.unlink(source);
        return true;
      } catch (copyError) {
        log.warning(`[FileStorage] Failed to move ${source} to ${destination}: ${copyError}`);
        return false;
      }
    }
  }

  async getDirectorySize(dirPath: string): Promise<number> {
    try {
      let totalSize = 0;

      const processDir = async (dir: string): Promise<void> => {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            await processDir(fullPath);
          } else if (entry.isFile()) {
            const stats = await fs.stat(fullPath);
            totalSize += stats.size;
          }
        }
      };

      await processDir(dirPath);
      return totalSize;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return 0;
      }
      log.warning(`[FileStorage] Failed to get directory size ${dirPath}: ${error}`);
      return 0;
    }
  }
}

/**
 * Create a new FileStorageAdapter instance
 */
export function createFileStorageAdapter(): FileStorageAdapter {
  return new FileStorageAdapter();
}
