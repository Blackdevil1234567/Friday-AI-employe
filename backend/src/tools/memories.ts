import { getDb } from '../db';

export interface Memory {
  id: string;
  category: string;
  key: string;
  content: string;
  created_at?: string;
}

export async function addMemory(category: string, key: string, content: string): Promise<Memory> {
  const db = await getDb();
  const id = Math.random().toString(36).substring(7);
  
  await db.run(
    `INSERT INTO memories (id, category, key, content) VALUES (?, ?, ?, ?)`,
    [id, category, key, content]
  );
  
  // Log memory creation
  await db.run(
    `INSERT INTO activity_logs (id, type, category, message, details) VALUES (?, 'info', 'ai', ?, ?)`,
    [
      Math.random().toString(36).substring(7),
      `Stored new memory fact: "${key}"`,
      `Category: ${category}. Content: ${content}`
    ]
  );

  return { id, category, key, content };
}

export async function getMemories(category?: string): Promise<Memory[]> {
  const db = await getDb();
  if (category) {
    return await db.all(`SELECT * FROM memories WHERE category = ? ORDER BY created_at DESC`, [category]);
  }
  return await db.all(`SELECT * FROM memories ORDER BY created_at DESC`);
}

export async function deleteMemory(id: string): Promise<void> {
  const db = await getDb();
  const memory = await db.get(`SELECT key FROM memories WHERE id = ?`, [id]);
  if (!memory) return;
  
  await db.run(`DELETE FROM memories WHERE id = ?`, [id]);

  await db.run(
    `INSERT INTO activity_logs (id, type, category, message, details) VALUES (?, 'info', 'ai', ?, ?)`,
    [
      Math.random().toString(36).substring(7),
      `Deleted memory fact: "${memory.key}"`,
      `Memory ID: ${id}`
    ]
  );
}

export async function updateMemory(id: string, content: string): Promise<void> {
  const db = await getDb();
  const memory = await db.get(`SELECT key FROM memories WHERE id = ?`, [id]);
  if (!memory) return;

  await db.run(`UPDATE memories SET content = ? WHERE id = ?`, [content, id]);

  await db.run(
    `INSERT INTO activity_logs (id, type, category, message, details) VALUES (?, 'info', 'ai', ?, ?)`,
    [
      Math.random().toString(36).substring(7),
      `Updated memory fact: "${memory.key}"`,
      `New content: ${content}`
    ]
  );
}

export async function getMemoryContext(): Promise<string> {
  try {
    const db = await getDb();
    
    // Check if memory is disabled in settings
    const memoryEnabledRow = await db.get(`SELECT value FROM settings WHERE key = 'memory_enabled'`);
    if (memoryEnabledRow && memoryEnabledRow.value === 'false') {
      return '';
    }

    const memories = await getMemories();
    if (memories.length === 0) {
      return 'No long-term memories or user preferences stored yet.';
    }

    // Group by category
    const categories: Record<string, string[]> = {
      preferences: [],
      projects: [],
      facts: [],
      important: []
    };

    for (const mem of memories) {
      const cat = mem.category.toLowerCase();
      const list = categories[cat] || categories.facts;
      list.push(`• [${mem.key}]: ${mem.content}`);
    }

    let context = '### FRIDAY LONG-TERM MEMORIES & USER CONTEXT\n';
    if (categories.preferences.length > 0) {
      context += '\nUser Preferences:\n' + categories.preferences.join('\n') + '\n';
    }
    if (categories.projects.length > 0) {
      context += '\nActive User Projects:\n' + categories.projects.join('\n') + '\n';
    }
    if (categories.facts.length > 0) {
      context += '\nGeneral Knowledge Facts:\n' + categories.facts.join('\n') + '\n';
    }
    if (categories.important.length > 0) {
      context += '\nCritical Notes:\n' + categories.important.join('\n') + '\n';
    }

    return context;
  } catch (error) {
    console.error("Failed to build memory context:", error);
    return '';
  }
}
