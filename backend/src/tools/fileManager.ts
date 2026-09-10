import fs from 'fs/promises';
import path from 'path';

const WORKSPACE_DIR = path.join(__dirname, '../../workspace');

export async function ensureWorkspaceDir(): Promise<string> {
  try {
    await fs.mkdir(WORKSPACE_DIR, { recursive: true });
  } catch (error) {
    console.error("Failed to create workspace directory:", error);
  }
  return WORKSPACE_DIR;
}

export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  updatedAt: Date;
}

export async function listFiles(dirPath = ''): Promise<FileEntry[]> {
  await ensureWorkspaceDir();
  const targetDir = path.resolve(WORKSPACE_DIR, dirPath);
  
  // Security check: ensure path does not escape workspace directory
  if (!targetDir.startsWith(WORKSPACE_DIR)) {
    throw new Error("Access denied: target path escapes the workspace sandbox.");
  }

  try {
    const entries = await fs.readdir(targetDir, { withFileTypes: true });
    const results: FileEntry[] = [];
    
    for (const entry of entries) {
      const relativePath = path.join(dirPath, entry.name).replace(/\\/g, '/');
      const fullPath = path.join(targetDir, entry.name);
      const stats = await fs.stat(fullPath);
      
      results.push({
        name: entry.name,
        path: relativePath,
        isDirectory: entry.isDirectory(),
        size: stats.size,
        updatedAt: stats.mtime
      });
    }
    
    // Sort directories first, then files alphabetically
    return results.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

export async function readFileContent(filePath: string): Promise<string> {
  await ensureWorkspaceDir();
  const fullPath = path.resolve(WORKSPACE_DIR, filePath);
  
  if (!fullPath.startsWith(WORKSPACE_DIR)) {
    throw new Error("Access denied: target path escapes the workspace sandbox.");
  }
  
  return await fs.readFile(fullPath, 'utf8');
}

export async function writeFileContent(filePath: string, content: string): Promise<void> {
  await ensureWorkspaceDir();
  const fullPath = path.resolve(WORKSPACE_DIR, filePath);
  
  if (!fullPath.startsWith(WORKSPACE_DIR)) {
    throw new Error("Access denied: target path escapes the workspace sandbox.");
  }
  
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, content, 'utf8');
}

export async function deleteFileOrDir(filePath: string): Promise<void> {
  await ensureWorkspaceDir();
  const fullPath = path.resolve(WORKSPACE_DIR, filePath);
  
  if (!fullPath.startsWith(WORKSPACE_DIR)) {
    throw new Error("Access denied: target path escapes the workspace sandbox.");
  }
  
  const stats = await fs.stat(fullPath);
  if (stats.isDirectory()) {
    await fs.rm(fullPath, { recursive: true, force: true });
  } else {
    await fs.unlink(fullPath);
  }
}
