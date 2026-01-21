/**
 * Storage Port Interface
 *
 * Defines the contract for storage operations.
 * Adapters (e.g., FileStorageAdapter) implement this interface.
 *
 * This allows the domain/application layer to be independent of
 * the specific storage implementation (filesystem, cloud, database, etc.)
 */

/**
 * Storage options
 */
export interface StorageOptions {
  readonly encoding?: BufferEncoding;
  readonly createDirs?: boolean;
}

/**
 * File info
 */
export interface FileInfo {
  readonly path: string;
  readonly exists: boolean;
  readonly size?: number;
  readonly modifiedAt?: Date;
  readonly createdAt?: Date;
}

/**
 * Storage Port Interface
 *
 * Main interface for storage operations.
 */
export interface IStoragePort {
  /**
   * Read a file as string
   */
  readFile(path: string, options?: StorageOptions): Promise<string | null>;

  /**
   * Read a file as JSON
   */
  readJson<T = unknown>(path: string): Promise<T | null>;

  /**
   * Write a string to file
   */
  writeFile(path: string, content: string, options?: StorageOptions): Promise<boolean>;

  /**
   * Write JSON to file
   */
  writeJson<T = unknown>(path: string, data: T, pretty?: boolean): Promise<boolean>;

  /**
   * Check if a file exists
   */
  exists(path: string): Promise<boolean>;

  /**
   * Delete a file
   */
  deleteFile(path: string): Promise<boolean>;

  /**
   * Get file info
   */
  getFileInfo(path: string): Promise<FileInfo>;

  /**
   * Create a directory (recursively)
   */
  createDirectory(path: string): Promise<boolean>;

  /**
   * Delete a directory (recursively)
   */
  deleteDirectory(path: string): Promise<boolean>;

  /**
   * List files in a directory
   */
  listDirectory(path: string, pattern?: string): Promise<string[]>;

  /**
   * Copy a file
   */
  copyFile(source: string, destination: string): Promise<boolean>;

  /**
   * Move/rename a file
   */
  moveFile(source: string, destination: string): Promise<boolean>;

  /**
   * Get total size of files in a directory
   */
  getDirectorySize(path: string): Promise<number>;
}
