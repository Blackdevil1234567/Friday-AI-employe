const API_BASE = 'http://localhost:5000/api';
const WS_BASE = 'ws://localhost:5000';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  type: string;
  created_at?: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  priority: 'low' | 'medium' | 'high';
  steps: { id: string; title: string; status: 'pending' | 'running' | 'completed' | 'failed'; result?: string }[];
  created_at?: string;
}

export interface Memory {
  id: string;
  category: string;
  key: string;
  content: string;
  created_at?: string;
}

export interface Automation {
  id: string;
  name: string;
  trigger_type: string;
  trigger_val: string;
  action_type: string;
  action_val: string;
  active: number;
  created_at?: string;
}

export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  updatedAt: string;
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  type: 'info' | 'success' | 'warning' | 'error';
  category: 'ai' | 'files' | 'web' | 'automation' | 'tasks' | 'system' | 'notes';
  message: string;
  details?: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string;
  created_at: string;
  updated_at: string;
}

export interface AppShortcut {
  id: string;
  name: string;
  command: string;
  category: 'system' | 'browser' | 'editor' | 'utility' | 'office';
  icon: string;
  description: string;
}

// REST Client requests
export const api = {
  // Settings
  getSettings: async () => {
    const res = await fetch(`${API_BASE}/settings`);
    return res.json();
  },
  saveSettings: async (settings: Record<string, string>) => {
    const res = await fetch(`${API_BASE}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    return res.json();
  },

  // Memories
  getMemories: async (): Promise<Memory[]> => {
    const res = await fetch(`${API_BASE}/memories`);
    return res.json();
  },
  addMemory: async (category: string, key: string, content: string): Promise<Memory> => {
    const res = await fetch(`${API_BASE}/memories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, key, content }),
    });
    return res.json();
  },
  deleteMemory: async (id: string) => {
    const res = await fetch(`${API_BASE}/memories/${id}`, { method: 'DELETE' });
    return res.json();
  },
  updateMemory: async (id: string, content: string) => {
    const res = await fetch(`${API_BASE}/memories/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    return res.json();
  },

  // Tasks
  getTasks: async (): Promise<Task[]> => {
    const res = await fetch(`${API_BASE}/tasks`);
    return res.json();
  },
  createTask: async (task: Partial<Task>): Promise<Task> => {
    const res = await fetch(`${API_BASE}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(task),
    });
    return res.json();
  },
  executeTask: async (id: string) => {
    const res = await fetch(`${API_BASE}/tasks/${id}/execute`, { method: 'POST' });
    return res.json();
  },
  deleteTask: async (id: string) => {
    const res = await fetch(`${API_BASE}/tasks/${id}`, { method: 'DELETE' });
    return res.json();
  },

  // Automations
  getAutomations: async (): Promise<Automation[]> => {
    const res = await fetch(`${API_BASE}/automations`);
    return res.json();
  },
  createAutomation: async (auto: Partial<Automation>): Promise<Automation> => {
    const res = await fetch(`${API_BASE}/automations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(auto),
    });
    return res.json();
  },
  deleteAutomation: async (id: string) => {
    const res = await fetch(`${API_BASE}/automations/${id}`, { method: 'DELETE' });
    return res.json();
  },
  toggleAutomation: async (id: string, active: boolean) => {
    const res = await fetch(`${API_BASE}/automations/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active }),
    });
    return res.json();
  },

  // Files
  listFiles: async (dirPath = ''): Promise<FileEntry[]> => {
    const res = await fetch(`${API_BASE}/files?path=${encodeURIComponent(dirPath)}`);
    return res.json();
  },
  readFile: async (filePath: string): Promise<string> => {
    const res = await fetch(`${API_BASE}/files/content?path=${encodeURIComponent(filePath)}`);
    const data = await res.json();
    return data.content || '';
  },
  writeFile: async (filePath: string, content: string) => {
    const res = await fetch(`${API_BASE}/files`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: filePath, content }),
    });
    return res.json();
  },
  deleteFile: async (filePath: string) => {
    const res = await fetch(`${API_BASE}/files`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: filePath }),
    });
    return res.json();
  },

  // Activity Log
  getActivityLogs: async (category = ''): Promise<ActivityLog[]> => {
    const res = await fetch(`${API_BASE}/activity?category=${category}`);
    return res.json();
  },

  // Notes
  getNotes: async (category = 'all', searchQuery = ''): Promise<Note[]> => {
    const res = await fetch(`${API_BASE}/notes?category=${encodeURIComponent(category)}&q=${encodeURIComponent(searchQuery)}`);
    return res.json();
  },
  createNote: async (note: { title: string; content: string; category?: string; tags?: string }): Promise<Note> => {
    const res = await fetch(`${API_BASE}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(note),
    });
    return res.json();
  },
  updateNote: async (id: string, note: { title: string; content: string; category?: string; tags?: string }) => {
    const res = await fetch(`${API_BASE}/notes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(note),
    });
    return res.json();
  },
  deleteNote: async (id: string) => {
    const res = await fetch(`${API_BASE}/notes/${id}`, { method: 'DELETE' });
    return res.json();
  },

  // System Apps Launcher
  getSystemApps: async (): Promise<AppShortcut[]> => {
    const res = await fetch(`${API_BASE}/system/apps/list`);
    return res.json();
  },
  launchApp: async (app: string): Promise<{ success: boolean; appName: string; message: string }> => {
    const res = await fetch(`${API_BASE}/system/apps/launch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app }),
    });
    return res.json();
  },
};

// WebSocket Client connection
export function createWebSocketConnection(onMessage: (msg: any) => void): WebSocket {
  const ws = new WebSocket(WS_BASE);
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onMessage(data);
    } catch (e) {
      console.error("Failed to parse websocket message", e);
    }
  };
  ws.onerror = (e) => console.error("WS error:", e);
  return ws;
}
