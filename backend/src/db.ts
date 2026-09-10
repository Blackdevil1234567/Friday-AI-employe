import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';

let db: Database | null = null;

export async function getDb(): Promise<Database> {
  if (db) return db;
  
  db = await open({
    filename: path.join(__dirname, '../database.db'),
    driver: sqlite3.Database
  });
  
  await initializeDb(db);
  return db;
}

async function initializeDb(db: Database) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      type TEXT DEFAULT 'text',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL, -- 'preferences', 'projects', 'facts', 'important'
      key TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
      priority TEXT DEFAULT 'medium', -- 'low', 'medium', 'high'
      steps TEXT NOT NULL, -- JSON string of steps
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS automations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      trigger_type TEXT NOT NULL, -- 'cron', 'event'
      trigger_val TEXT NOT NULL,  -- e.g. '0 8 * * *'
      action_type TEXT NOT NULL,  -- 'ai_report', 'notify'
      action_val TEXT NOT NULL,   -- prompt details
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS activity_logs (
      id TEXT PRIMARY KEY,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      type TEXT NOT NULL, -- 'info', 'success', 'warning', 'error'
      category TEXT NOT NULL, -- 'ai', 'files', 'web', 'automation', 'tasks', 'system', 'notes'
      message TEXT NOT NULL,
      details TEXT
    );

    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      category TEXT DEFAULT 'Quick Notes',
      tags TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Insert default configurations
  const hasSettings = await db.get(`SELECT COUNT(*) as count FROM settings`);
  if (hasSettings && hasSettings.count === 0) {
    await db.run(`INSERT INTO settings (key, value) VALUES ('ai_provider', 'gemini')`);
    await db.run(`INSERT INTO settings (key, value) VALUES ('ai_model', 'gemini-1.5-flash')`);
    await db.run(`INSERT INTO settings (key, value) VALUES ('gemini_api_key', '${process.env.GEMINI_API_KEY || ''}')`);
    await db.run(`INSERT INTO settings (key, value) VALUES ('groq_api_key', '${process.env.GROQ_API_KEY || ''}')`);
    await db.run(`INSERT INTO settings (key, value) VALUES ('ai_temperature', '0.7')`);
    await db.run(`INSERT INTO settings (key, value) VALUES ('voice_enabled', 'true')`);
    await db.run(`INSERT INTO settings (key, value) VALUES ('voice_speed', '1.0')`);
    await db.run(`INSERT INTO settings (key, value) VALUES ('voice_name', 'default')`);
    await db.run(`INSERT INTO settings (key, value) VALUES ('memory_enabled', 'true')`);
    await db.run(`INSERT INTO settings (key, value) VALUES ('auto_call_answering', 'false')`);
  }

  // Migration: Ensure Google Gemini is active main provider
  if (process.env.GROQ_API_KEY) {
    await db.run(`INSERT INTO settings (key, value) VALUES ('groq_api_key', '${process.env.GROQ_API_KEY}') ON CONFLICT(key) DO UPDATE SET value = excluded.value`);
  }
  if (process.env.GEMINI_API_KEY) {
    await db.run(`INSERT INTO settings (key, value) VALUES ('gemini_api_key', '${process.env.GEMINI_API_KEY}') ON CONFLICT(key) DO UPDATE SET value = excluded.value`);
  }
  await db.run(`INSERT INTO settings (key, value) VALUES ('ai_provider', 'gemini') ON CONFLICT(key) DO UPDATE SET value = 'gemini'`);
  await db.run(`INSERT INTO settings (key, value) VALUES ('ai_model', 'gemini-1.5-flash') ON CONFLICT(key) DO UPDATE SET value = 'gemini-1.5-flash'`);

  // Insert standard admin account if none exists (username: admin, password: admin123)
  const hasUser = await db.get(`SELECT COUNT(*) as count FROM users`);
  if (hasUser && hasUser.count === 0) {
    await db.run(`INSERT INTO users (id, username, password) VALUES ('1', 'admin', '$2a$10$FTDBSEVjtSxZnMFuB.wXE.AHnLczXY5/riXvnQPTK9.IzdCbqdbou')`);
  }
}
