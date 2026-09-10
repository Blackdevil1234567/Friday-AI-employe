import { getDb } from '../db';

export interface NoteItem {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string;
  created_at: string;
  updated_at: string;
}

export async function createNote(
  title: string,
  content: string,
  category: string = 'Quick Notes',
  tags: string = ''
): Promise<NoteItem> {
  const db = await getDb();
  const id = Math.random().toString(36).substring(7);
  const now = new Date().toISOString();
  
  const cleanTitle = title.trim() || 'Untitled Note';
  const cleanCategory = category.trim() || 'Quick Notes';

  await db.run(
    `INSERT INTO notes (id, title, content, category, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, cleanTitle, content, cleanCategory, tags, now, now]
  );

  return {
    id,
    title: cleanTitle,
    content,
    category: cleanCategory,
    tags,
    created_at: now,
    updated_at: now
  };
}

export async function getNotes(category?: string, searchQuery?: string): Promise<NoteItem[]> {
  const db = await getDb();
  let sql = `SELECT * FROM notes`;
  const params: any[] = [];

  const conditions: string[] = [];

  if (category && category.toLowerCase() !== 'all') {
    conditions.push(`category = ?`);
    params.push(category);
  }

  if (searchQuery && searchQuery.trim()) {
    conditions.push(`(title LIKE ? OR content LIKE ? OR tags LIKE ?)`);
    const q = `%${searchQuery.trim()}%`;
    params.push(q, q, q);
  }

  if (conditions.length > 0) {
    sql += ` WHERE ` + conditions.join(' AND ');
  }

  sql += ` ORDER BY updated_at DESC`;

  const rows = await db.all(sql, params);
  return rows;
}

export async function updateNote(
  id: string,
  title: string,
  content: string,
  category?: string,
  tags?: string
): Promise<boolean> {
  const db = await getDb();
  const now = new Date().toISOString();

  await db.run(
    `UPDATE notes SET title = ?, content = ?, category = COALESCE(?, category), tags = COALESCE(?, tags), updated_at = ? WHERE id = ?`,
    [title, content, category, tags, now, id]
  );

  return true;
}

export async function deleteNote(id: string): Promise<boolean> {
  const db = await getDb();
  await db.run(`DELETE FROM notes WHERE id = ?`, [id]);
  return true;
}
