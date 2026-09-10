import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { getDb } from './db';
import { routeAgentRequest } from './agents';
import { GeminiProvider } from './providers/gemini';
import { listFiles, readFileContent, writeFileContent, deleteFileOrDir } from './tools/fileManager';
import { searchWeb } from './tools/webSearch';
import { runTaskPlan } from './tools/taskPlanner';
import { addMemory, getMemories, deleteMemory, updateMemory } from './tools/memories';
import { launchSystemApp, SUPPORTED_APPS } from './tools/systemApps';
import { createNote, getNotes, updateNote, deleteNote } from './tools/notes';

dotenv.config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'friday_super_secret_jwt_auth_key_13579';

app.use(cors());
app.use(express.json());

// Setup WebSocket upgrade connection
server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

// Broadcast Helper
function broadcast(message: any) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}

// REST API Routes

// Authentication
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const db = await getDb();
    const user = await db.get(`SELECT * FROM users WHERE username = ?`, [username]);
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, username: user.username });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Settings Endpoints
app.get('/api/settings', async (req, res) => {
  try {
    const db = await getDb();
    const rows = await db.all(`SELECT * FROM settings`);
    const settings: Record<string, string> = {};
    rows.forEach(r => { settings[r.key] = r.value; });
    res.json(settings);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/settings', async (req, res) => {
  const settings = req.body;
  try {
    const db = await getDb();
    for (const [key, value] of Object.entries(settings)) {
      await db.run(
        `INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [key, String(value)]
      );
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Memories Endpoints
app.get('/api/memories', async (req, res) => {
  try {
    const memories = await getMemories();
    res.json(memories);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/memories', async (req, res) => {
  const { category, key, content } = req.body;
  try {
    const newMemory = await addMemory(category, key, content);
    res.json(newMemory);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/memories/:id', async (req, res) => {
  try {
    await deleteMemory(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/memories/:id', async (req, res) => {
  try {
    await updateMemory(req.params.id, req.body.content);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Tasks Endpoints
app.get('/api/tasks', async (req, res) => {
  try {
    const db = await getDb();
    const tasks = await db.all(`SELECT * FROM tasks ORDER BY created_at DESC`);
    const parsedTasks = tasks.map(t => ({
      ...t,
      steps: JSON.parse(t.steps)
    }));
    res.json(parsedTasks);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/tasks', async (req, res) => {
  const { title, description, priority, steps } = req.body;
  try {
    const db = await getDb();
    const id = Math.random().toString(36).substring(7);
    await db.run(
      `INSERT INTO tasks (id, title, description, priority, steps) VALUES (?, ?, ?, ?, ?)`,
      [id, title, description, priority || 'medium', JSON.stringify(steps || [])]
    );
    res.json({ id, title, description, priority, steps });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/tasks/:id/execute', async (req, res) => {
  const { id } = req.params;
  try {
    // Run task runner asynchronously
    runTaskPlan(id, broadcast);
    res.json({ success: true, message: 'Workflow task launched successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/tasks/:id', async (req, res) => {
  try {
    const db = await getDb();
    await db.run(`DELETE FROM tasks WHERE id = ?`, [req.params.id]);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Automations Endpoints
app.get('/api/automations', async (req, res) => {
  try {
    const db = await getDb();
    const automations = await db.all(`SELECT * FROM automations ORDER BY created_at DESC`);
    res.json(automations);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/automations', async (req, res) => {
  const { name, trigger_type, trigger_val, action_type, action_val } = req.body;
  try {
    const db = await getDb();
    const id = Math.random().toString(36).substring(7);
    await db.run(
      `INSERT INTO automations (id, name, trigger_type, trigger_val, action_type, action_val) VALUES (?, ?, ?, ?, ?, ?)`,
      [id, name, trigger_type, trigger_val, action_type, action_val]
    );
    res.json({ id, name, trigger_type, trigger_val, action_type, action_val, active: 1 });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/automations/:id', async (req, res) => {
  try {
    const db = await getDb();
    await db.run(`DELETE FROM automations WHERE id = ?`, [req.params.id]);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/automations/:id', async (req, res) => {
  const { active } = req.body;
  try {
    const db = await getDb();
    await db.run(`UPDATE automations SET active = ? WHERE id = ?`, [active ? 1 : 0, req.params.id]);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Notes Endpoints
app.get('/api/notes', async (req, res) => {
  const { category, q } = req.query;
  try {
    const notesList = await getNotes(category as string, q as string);
    res.json(notesList);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/notes', async (req, res) => {
  const { title, content, category, tags } = req.body;
  try {
    const note = await createNote(title, content, category, tags);

    const db = await getDb();
    await db.run(
      `INSERT INTO activity_logs (id, type, category, message, details) VALUES (?, 'success', 'notes', ?, ?)`,
      [Math.random().toString(36).substring(7), `Created note: "${note.title}"`, `Category: ${note.category}`]
    );
    broadcast({ type: 'activity_logged' });

    res.json(note);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/notes/:id', async (req, res) => {
  const { title, content, category, tags } = req.body;
  try {
    await updateNote(req.params.id, title, content, category, tags);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/notes/:id', async (req, res) => {
  try {
    await deleteNote(req.params.id);

    const db = await getDb();
    await db.run(
      `INSERT INTO activity_logs (id, type, category, message, details) VALUES (?, 'warning', 'notes', ?, ?)`,
      [Math.random().toString(36).substring(7), `Deleted note ID: ${req.params.id}`, `Removed from notes database.`]
    );
    broadcast({ type: 'activity_logged' });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// System App Launcher Endpoints
app.get('/api/system/apps/list', async (req, res) => {
  res.json(SUPPORTED_APPS);
});

app.post('/api/system/apps/launch', async (req, res) => {
  const { app } = req.body;
  try {
    const result = await launchSystemApp(app || '');
    
    const db = await getDb();
    await db.run(
      `INSERT INTO activity_logs (id, type, category, message, details) VALUES (?, ?, 'system', ?, ?)`,
      [
        Math.random().toString(36).substring(7),
        result.success ? 'success' : 'error',
        `Launched Desktop App: ${result.appName}`,
        result.message
      ]
    );
    broadcast({ type: 'activity_logged' });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// File Manager Endpoints
app.get('/api/files', async (req, res) => {
  const { path: dirPath } = req.query;
  try {
    const entries = await listFiles(dirPath as string || '');
    res.json(entries);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/files/content', async (req, res) => {
  const { path: filePath } = req.query;
  try {
    const content = await readFileContent(filePath as string);
    res.json({ content });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/files', async (req, res) => {
  const { path: filePath, content } = req.body;
  try {
    await writeFileContent(filePath, content);
    
    // Log file writing activity
    const db = await getDb();
    await db.run(
      `INSERT INTO activity_logs (id, type, category, message, details) VALUES (?, 'success', 'files', ?, ?)`,
      [Math.random().toString(36).substring(7), `Created file: ${filePath}`, `Size: ${content.length} characters.`]
    );
    broadcast({ type: 'activity_logged' });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/files', async (req, res) => {
  const { path: filePath } = req.body;
  try {
    await deleteFileOrDir(filePath);

    // Log file deletion activity
    const db = await getDb();
    await db.run(
      `INSERT INTO activity_logs (id, type, category, message, details) VALUES (?, 'warning', 'files', ?, ?)`,
      [Math.random().toString(36).substring(7), `Deleted file: ${filePath}`, `Deleted from workspace sandbox.`]
    );
    broadcast({ type: 'activity_logged' });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Activity Log Endpoints
app.get('/api/activity', async (req, res) => {
  const { category } = req.query;
  try {
    const db = await getDb();
    let query = `SELECT * FROM activity_logs`;
    const params = [];
    
    if (category) {
      query += ` WHERE category = ?`;
      params.push(category);
    }
    
    query += ` ORDER BY timestamp DESC LIMIT 100`;
    const logs = await db.all(query, params);
    res.json(logs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// WebSocket Connection Management
wss.on('connection', (ws) => {
  console.log('Client connected to WebSocket.');

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());
      
      if (message.type === 'chat_message') {
        const { prompt, history } = message.payload;
        
        // Log user query in message log
        const db = await getDb();
        const userMsgId = Math.random().toString(36).substring(7);
        await db.run(`INSERT INTO messages (id, role, content, type) VALUES (?, 'user', ?, 'text')`, [userMsgId, prompt]);
        
        // Log activity log entry
        await db.run(
          `INSERT INTO activity_logs (id, type, category, message, details) VALUES (?, 'info', 'ai', ?, ?)`,
          [Math.random().toString(36).substring(7), `Received message from user`, `Prompt: "${prompt}"`]
        );
        broadcast({ type: 'activity_logged' });

        // Stream response back
        ws.send(JSON.stringify({ type: 'stream_start' }));

        const responseObj = await routeAgentRequest(prompt, history, broadcast);
        
        if (responseObj.requiresConfirmation) {
          // Send confirmation request to client rather than running immediately
          ws.send(JSON.stringify({
            type: 'confirmation_required',
            payload: {
              recipient: responseObj.recipient,
              message: responseObj.message,
              plan: responseObj.plan,
              actionDetails: responseObj.actionDetails
            }
          }));
        } else {
          // Safe action - execute immediately or stream reply
          let responseText = responseObj.message;
          if (typeof responseText !== 'string') {
            responseText = responseObj.message || JSON.stringify(responseObj) || 'No message content returned from LLM agent classification.';
          }
          
          if (responseObj.recipient === 'SystemAgent' && responseObj.actionDetails?.app) {
            const launchRes = await launchSystemApp(responseObj.actionDetails.app);
            responseText = launchRes.message;
          } else if (responseObj.recipient === 'NotesAgent' && responseObj.actionDetails) {
            const { title, content, category, tags } = responseObj.actionDetails;
            const note = await createNote(title, content, category, tags);
            responseText = `Recorded note: **${note.title}** in Smart Notes.`;
          } else if (responseObj.recipient === 'ResearchAgent' && responseObj.actionDetails?.query) {
            // Live/Mock search execution
            ws.send(JSON.stringify({ type: 'stream_chunk', payload: '\n\n*Gathering search queries and comparing sources...*\n\n' }));
            const searchRes = await searchWeb(responseObj.actionDetails.query);
            responseText += `\n\n### Research Summary\n${searchRes.summary}\n\n#### Sources Cited:\n` + 
              searchRes.results.map((r, i) => `${i + 1}. [${r.title}](${r.url}) (Score: ${r.score})`).join('\n');
          } else if (responseObj.plan && responseObj.plan.length > 0) {
            // Productivity planner task creation
            const taskId = Math.random().toString(36).substring(7);
            await db.run(
              `INSERT INTO tasks (id, title, description, priority, steps) VALUES (?, ?, ?, 'medium', ?)`,
              [taskId, prompt, 'Autonomous plan generated by FRIDAY', JSON.stringify(responseObj.plan)]
            );
            responseText += `\n\nI have organized this into an autonomous workflow. You can track progress in the Tasks panel. [Task ID: ${taskId}]`;
            broadcast({ type: 'task_created', taskId });
          }

          // Send chunks to simulate real streaming or stream directly
          const words = responseText.split(' ');
          for (const word of words) {
            ws.send(JSON.stringify({ type: 'stream_chunk', payload: word + ' ' }));
            await new Promise(r => setTimeout(r, 40));
          }

          const assistantMsgId = Math.random().toString(36).substring(7);
          await db.run(`INSERT INTO messages (id, role, content, type) VALUES (?, 'assistant', ?, 'text')`, [assistantMsgId, responseText]);

          ws.send(JSON.stringify({ type: 'stream_end' }));
        }
      }

      if (message.type === 'approve_action') {
        const { recipient, actionDetails, plan, messagePrompt } = message.payload;
        const db = await getDb();
        
        ws.send(JSON.stringify({ type: 'stream_start' }));
        ws.send(JSON.stringify({ type: 'stream_chunk', payload: `*Action approved. Executing tool suite...*\n\n` }));

        let executionResult = '';

        if (recipient === 'SystemAgent') {
          const { app } = actionDetails;
          const launchRes = await launchSystemApp(app);
          executionResult = launchRes.message;
        } else if (recipient === 'NotesAgent') {
          const { title, content, category, tags } = actionDetails;
          const note = await createNote(title, content, category, tags);
          executionResult = `Successfully created note: **${note.title}** under category **${note.category}**.`;
        } else if (recipient === 'CodingAgent') {
          const { filename, code } = actionDetails;
          await writeFileContent(filename, code);
          executionResult = `Successfully generated source code file in your workspace: **${filename}**.`;
        } else if (recipient === 'AutomationAgent') {
          const { name, trigger, action } = actionDetails;
          const id = Math.random().toString(36).substring(7);
          await db.run(
            `INSERT INTO automations (id, name, trigger_type, trigger_val, action_type, action_val) VALUES (?, ?, 'cron', ?, 'ai_report', ?)`,
            [id, name, trigger, action]
          );
          executionResult = `Successfully registered background automation rule: **${name}** (Trigger: \`${trigger}\`).`;
        } else if (plan && plan.length > 0) {
          // Create and launch task planner
          const taskId = Math.random().toString(36).substring(7);
          await db.run(
            `INSERT INTO tasks (id, title, description, priority, steps) VALUES (?, ?, ?, 'medium', ?)`,
            [taskId, messagePrompt || 'Task execution', 'Autonomous workflow', JSON.stringify(plan)]
          );
          broadcast({ type: 'task_created', taskId });
          runTaskPlan(taskId, broadcast);
          executionResult = `Autonomous workflow has been scheduled and launched. Check the Tasks tab. [Task ID: ${taskId}]`;
        } else {
          executionResult = `Completed approved action successfully.`;
        }

        const words = executionResult.split(' ');
        for (const word of words) {
          ws.send(JSON.stringify({ type: 'stream_chunk', payload: word + ' ' }));
          await new Promise(r => setTimeout(r, 45));
        }

        const assistantMsgId = Math.random().toString(36).substring(7);
        await db.run(`INSERT INTO messages (id, role, content, type) VALUES (?, 'assistant', ?, 'text')`, [assistantMsgId, executionResult]);
        
        ws.send(JSON.stringify({ type: 'stream_end' }));
      }

      if (message.type === 'simulate_receiver') {
        const { targetName, objective, transcript } = message.payload;
        const db = await getDb();
        const apiKeyRow = await db.get(`SELECT value FROM settings WHERE key = 'gemini_api_key'`);
        const apiKey = apiKeyRow?.value || process.env.GEMINI_API_KEY || '';
        
        const systemInstruction = `
You are the receiver of a phone call.
Your name / role is: ${targetName}.
An AI assistant named FRIDAY is calling you on behalf of their operator to: ${objective}.
Act naturally as the receiver (e.g. if Pizza Hut, you are a busy employee taking a reservation).
Keep your responses short, conversational, and under 25 words. Do NOT include any prefixes like "Pizza Hut:" or "John:". Just output the speech itself.
`;
        
        ws.send(JSON.stringify({ type: 'stream_start' }));
        
        if (apiKey) {
          try {
            const provider = new GeminiProvider(apiKey, 'gemini-1.5-flash', 0.8);
            const prompt = `Here is the current call transcript:\n${transcript.join('\n')}\n\nWhat is your next response?`;
            let hasError = false;
            let outputText = '';
            
            await provider.generateStream(
              prompt,
              [],
              systemInstruction,
              {
                onChunk: (text) => {
                  if (text.includes('Error communicating') || text.includes('fetch failed') || text.includes('[Error:')) {
                    hasError = true;
                  } else {
                    outputText += text;
                    ws.send(JSON.stringify({ type: 'stream_chunk', payload: text }));
                  }
                }
              }
            );
            if (hasError || !outputText.trim()) {
              ws.send(JSON.stringify({ type: 'stream_chunk', payload: "Hello! Yes, I am here. How can I help you today?" }));
            }
            ws.send(JSON.stringify({ type: 'stream_end_receiver' }));
          } catch (e: any) {
            console.error("Failed to simulate receiver:", e);
            ws.send(JSON.stringify({ type: 'stream_chunk', payload: "Hello? I can hear you. How can I help?" }));
            ws.send(JSON.stringify({ type: 'stream_end_receiver' }));
          }
        } else {
          // Retrieve admin name
          const userRow = await db.get(`SELECT username FROM users ORDER BY created_at LIMIT 1`);
          const adminName = userRow?.username || 'admin';

          // Mock response if no API key
          const mockAnswers = [
            "Hello, yes! This is Pizza Hut. How can I help you today?",
            "Sure, we can do that. For what time and how many people?",
            `Okay, I have reserved a table for 4 at 8 PM under the name ${adminName}. Anything else?`,
            "Great! We are all set. See you tonight!",
            `Hello, this is ${targetName}. Yes, I'm working on the project right now. I should finish it by tomorrow.`
          ];
          
          const count = Math.floor(transcript.length / 2);
          const reply = mockAnswers[count % mockAnswers.length];
          const words = reply.split(' ');
          for (const word of words) {
            ws.send(JSON.stringify({ type: 'stream_chunk', payload: word + ' ' }));
            await new Promise(r => setTimeout(r, 60));
          }
          ws.send(JSON.stringify({ type: 'stream_end_receiver' }));
        }
      }

      if (message.type === 'simulate_friday') {
        const { targetName, objective, transcript } = message.payload;
        const db = await getDb();
        const apiKeyRow = await db.get(`SELECT value FROM settings WHERE key = 'gemini_api_key'`);
        const apiKey = apiKeyRow?.value || process.env.GEMINI_API_KEY || '';
        
        // Retrieve admin name
        const userRow = await db.get(`SELECT username FROM users ORDER BY created_at LIMIT 1`);
        const adminName = userRow?.username || 'admin';

        const systemInstruction = `
You are FRIDAY, an advanced AI employee.
You are calling ${targetName} on behalf of your operator to: ${objective}.
Respond naturally to the receiver. Keep the conversation moving towards achieving the objective.
Once the objective is fully achieved (e.g. the reservation is confirmed or the question is answered), politely say goodbye and state that you are hanging up (use the word "goodbye" or "hang up" in your final response).
Keep your responses short, professional, and under 25 words. Do NOT include any prefixes like "FRIDAY:". Just output the speech itself.
`;
        
        ws.send(JSON.stringify({ type: 'stream_start' }));
        
        if (apiKey) {
          try {
            const provider = new GeminiProvider(apiKey, 'gemini-1.5-flash', 0.6);
            let hasError = false;
            let outputText = '';
            await provider.generateStream(
              `Here is the current call transcript:\n${transcript.join('\n')}\n\nWhat is your next response?`,
              [],
              systemInstruction,
              {
                onChunk: (text) => {
                  if (text.includes('Error communicating') || text.includes('fetch failed') || text.includes('[Error:')) {
                    hasError = true;
                  } else {
                    outputText += text;
                    ws.send(JSON.stringify({ type: 'stream_chunk', payload: text }));
                  }
                }
              }
            );
            if (hasError || !outputText.trim()) {
              ws.send(JSON.stringify({ type: 'stream_chunk', payload: "Thank you for confirming. Goodbye." }));
            }
            ws.send(JSON.stringify({ type: 'stream_end' }));
          } catch (e: any) {
            console.error("Failed to simulate Friday:", e);
            ws.send(JSON.stringify({ type: 'stream_chunk', payload: "Thank you for confirming. Goodbye." }));
            ws.send(JSON.stringify({ type: 'stream_end' }));
          }
        } else {
          // Mock response if no API key
          const mockAnswers = [
            "Hi, I'm calling to book a table for 4 at 8 PM today please.",
            `That will be under the name ${adminName}. Could you confirm that for me?`,
            "Perfect. Thank you so much for your help. Goodbye.",
            `Hi ${targetName}, I am calling to check on the project status.`
          ];
          
          let reply = "Perfect. Thank you for your help. Goodbye.";
          if (objective.toLowerCase().includes('status')) {
            reply = `Thank you ${targetName}, that's what I needed. Goodbye.`;
          } else {
            const count = Math.floor(transcript.length / 2);
            if (count === 0) reply = "Hi, I'm calling to book a table for 4 at 8 PM today please.";
            else if (count === 1) reply = `That will be under the name ${adminName}. Could you confirm that for me?`;
          }
          
          const words = reply.split(' ');
          for (const word of words) {
            ws.send(JSON.stringify({ type: 'stream_chunk', payload: word + ' ' }));
            await new Promise(r => setTimeout(r, 60));
          }
          ws.send(JSON.stringify({ type: 'stream_end' }));
        }
      }
    } catch (e: any) {
      console.error("WS message error:", e);
      ws.send(JSON.stringify({ type: 'error', payload: e.message || 'Unknown processing error' }));
    }
  });

  ws.on('close', () => {
    console.log('Client closed WebSocket connection.');
  });
});

// Boot Server
server.listen(PORT, async () => {
  console.log(`[FRIDAY ENGINE] Running on http://localhost:${PORT}`);
  try {
    // Initialise SQLite db immediately to seed schemas
    await getDb();
    console.log(`[FRIDAY ENGINE] SQLite Database initialized.`);
  } catch (error) {
    console.error("Failed to connect to database during startup:", error);
  }
});
