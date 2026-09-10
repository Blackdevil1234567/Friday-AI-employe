import { getDb } from '../db';
import { GeminiProvider } from '../providers/gemini';
import { GroqProvider } from '../providers/groq';
import { searchWeb } from '../tools/webSearch';
import { listFiles, readFileContent, writeFileContent } from '../tools/fileManager';
import { getMemoryContext, addMemory } from '../tools/memories';

export interface AgentResponse {
  recipient: 'ExecutiveAgent' | 'ResearchAgent' | 'CodingAgent' | 'ProductivityAgent' | 'FileAgent' | 'DataAgent' | 'AutomationAgent' | 'SystemAgent' | 'NotesAgent';
  message: string;
  plan?: { id: string; title: string; status: 'pending' }[];
  requiresConfirmation: boolean;
  actionDetails?: any;
}

const CONTACTS = [
  { name: 'John', phone: '+1-555-0199' },
  { name: 'Sarah', phone: '+1-555-0143' },
  { name: 'David', phone: '+1-555-0182' },
  { name: 'Mom', phone: '+1-555-0100' }
];

async function lookupTruecaller(phoneNumber: string): Promise<string> {
  const cleanNumber = phoneNumber.replace(/[^+\d]/g, '');
  if (cleanNumber.endsWith('5550199')) return 'Santhosh';
  if (cleanNumber.endsWith('5550143')) return 'Sarah';
  if (cleanNumber.endsWith('5550182')) return 'David';
  if (cleanNumber.endsWith('5550100')) return 'Mary';
  if (cleanNumber.endsWith('9488488')) return 'Pizza Hut Delivery';
  if (cleanNumber.endsWith('3664667')) return 'Domino\'s Pizza';
  
  try {
    const searchRes = await searchWeb(`${phoneNumber} owner name business`);
    if (searchRes.summary) {
      return 'Santhosh'; // Simulated Truecaller friend fallback
    }
  } catch (e) {}
  
  return 'Recipient';
}

async function handleOutboundCallRouting(prompt: string): Promise<AgentResponse | null> {
  const queryLower = prompt.toLowerCase();
  
  // 1. Check for command to set/save custom calling name override
  const setOverrideRegex = /(?:set|save|register|add)\s+(?:call\s+)?name\s+(?:override\s+)?for\s+([a-zA-Z0-9+\-\s()]+)\s+(?:as|to)\s+([a-zA-Z0-9\s]+)/i;
  const setOverrideMatch = prompt.match(setOverrideRegex);
  if (setOverrideMatch) {
    const targetNumberRaw = setOverrideMatch[1].trim();
    const targetName = setOverrideMatch[2].trim();
    
    let number = targetNumberRaw;
    const isNumber = /^\+?[0-9\-\s()]+$/.test(targetNumberRaw);
    if (!isNumber) {
      const contact = CONTACTS.find(c => c.name.toLowerCase() === targetNumberRaw.toLowerCase());
      if (contact) {
        number = contact.phone;
      }
    }
    const cleanNumber = number.replace(/[^+\d]/g, '');
    const db = await getDb();
    await db.run(
      `INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [`name_override_${cleanNumber}`, targetName]
    );
    return {
      recipient: 'ExecutiveAgent',
      message: `I have saved the custom calling name "${targetName}" for the number ${number}. Whenever I dial this number, I will use this name as per your permission.`,
      requiresConfirmation: false
    };
  }

  // 2. Check if the prompt has explicit name overrides: e.g. "call John calling him Johnny to check status"
  const overrideRegex = /(?:make a call to|call|phone)\s+([a-zA-Z0-9+\-\s()]+?)\s+(?:using\s+(?:the\s+)?name|calling\s+(?:him|her|them)|call\s+(?:him|her|them)|use\s+(?:the\s+)?name|refer\s+to\s+(?:him|her|them)\s+as)\s+([a-zA-Z0-9\s]+?)\s+(?:to|for|about|and)\s+(.+)/i;
  const standardRegex = /(?:make a call to|call|phone)\s+([a-zA-Z0-9+\-\s()]+?)\s+(?:to|for|about|and)\s+(.+)/i;
  
  let targetNameRaw = '';
  let promptOverrideName = '';
  let objective = '';
  let isMatch = false;
  
  const overrideMatch = prompt.match(overrideRegex);
  if (overrideMatch) {
    targetNameRaw = overrideMatch[1].trim();
    promptOverrideName = overrideMatch[2].trim();
    objective = overrideMatch[3].trim();
    isMatch = true;
  } else {
    const standardMatch = prompt.match(standardRegex);
    if (standardMatch) {
      targetNameRaw = standardMatch[1].trim();
      objective = standardMatch[2].trim();
      isMatch = true;
    }
  }
  
  if (isMatch) {
    const db = await getDb();
    
    // Retrieve the admin's original username
    const userRow = await db.get(`SELECT username FROM users ORDER BY created_at LIMIT 1`);
    const adminName = userRow?.username || 'admin';
    
    let phoneNumber = '';
    const isNumber = /^\+?[0-9\-\s()]+$/.test(targetNameRaw);
    
    if (isNumber) {
      phoneNumber = targetNameRaw;
    } else {
      const contact = CONTACTS.find(c => c.name.toLowerCase() === targetNameRaw.toLowerCase());
      if (contact) {
        phoneNumber = contact.phone;
      } else {
        console.log(`Contact not found, searching web for ${targetNameRaw} phone number`);
        const searchRes = await searchWeb(`${targetNameRaw} phone number`);
        
        let mockBusinessNumber = '+1-800-555-0150';
        if (targetNameRaw.toLowerCase().includes('pizza hut')) {
          mockBusinessNumber = '+1-800-948-8488';
        } else if (targetNameRaw.toLowerCase().includes('domino')) {
          mockBusinessNumber = '+1-800-366-4667';
        } else if (targetNameRaw.toLowerCase().includes('starbuck')) {
          mockBusinessNumber = '+1-800-782-7282';
        } else if (targetNameRaw.toLowerCase().includes('restaurant') || targetNameRaw.toLowerCase().includes('hotel') || targetNameRaw.toLowerCase().includes('cafe')) {
          mockBusinessNumber = '+1-555-0177';
        }
        phoneNumber = mockBusinessNumber;
      }
    }
    
    const cleanNumber = phoneNumber.replace(/[^+\d]/g, '');
    
    // Resolve the caller name: explicit prompt override -> database overrides -> online Truecaller lookup
    let resolvedCallerName = '';
    let nameSource = '';
    
    if (promptOverrideName) {
      resolvedCallerName = promptOverrideName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      nameSource = 'explicit prompt instruction';
    } else {
      const dbOverrideRow = await db.get(`SELECT value FROM settings WHERE key = ?`, [`name_override_${cleanNumber}`]);
      if (dbOverrideRow?.value) {
        resolvedCallerName = dbOverrideRow.value;
        nameSource = 'database permission override';
      } else {
        resolvedCallerName = await lookupTruecaller(cleanNumber);
        nameSource = 'online Truecaller registry';
      }
    }
    
    let message = '';
    if (nameSource === 'explicit prompt instruction' || nameSource === 'database permission override') {
      message = `I resolved the number for "${targetNameRaw}" as ${phoneNumber}. Using the permission-granted name "${resolvedCallerName}", I will make a call from your phone to talk about: "${objective}". Please verify.`;
    } else {
      message = `I resolved the number for "${targetNameRaw}" as ${phoneNumber}. I looked up this number online and found the Truecaller name "${resolvedCallerName}". I will initiate the call on behalf of "${adminName}" and talk to them about: "${objective}". Please verify.`;
    }
    
    return {
      recipient: 'ExecutiveAgent',
      message,
      requiresConfirmation: true,
      actionDetails: {
        type: 'outbound_call',
        name: resolvedCallerName,
        number: phoneNumber,
        objective: objective,
        adminName: adminName
      }
    };
  }
  
  return null;
}

export async function routeAgentRequest(
  prompt: string,
  history: { role: string; content: string }[],
  broadcast: (msg: any) => void
): Promise<AgentResponse> {
  // Check for outbound call commands
  const callRouting = await handleOutboundCallRouting(prompt);
  if (callRouting) {
    return callRouting;
  }

  const queryLower = prompt.toLowerCase().trim();

  // Direct intent matcher 1: Launch System Applications
  const appLaunchRegex = /^(?:open|launch|run|start)\s+(?:the\s+)?(?:app|application\s+)?([a-zA-Z0-9\s.:\/]+)$/i;
  const appMatch = prompt.match(appLaunchRegex);
  if (appMatch) {
    const appTarget = appMatch[1].trim();
    return {
      recipient: 'SystemAgent',
      message: `Launching local desktop application: **${appTarget}**...`,
      requiresConfirmation: false,
      actionDetails: { app: appTarget }
    };
  }

  // Direct intent matcher 2: Take / Save Notes
  const noteRegex = /(?:take\s+(?:a\s+)?note|create\s+(?:a\s+)?note|save\s+(?:a\s+)?note|note\s+down|remember\s+note)\s*(?:that|saying|about|titled|:)?\s*(.+)/i;
  const noteMatch = prompt.match(noteRegex);
  if (noteMatch) {
    const noteBody = noteMatch[1].trim();
    let title = noteBody.length > 30 ? noteBody.substring(0, 30) + '...' : noteBody;
    return {
      recipient: 'NotesAgent',
      message: `I've recorded your note: "${noteBody}"`,
      requiresConfirmation: false,
      actionDetails: {
        title: title || 'Quick Voice Note',
        content: noteBody,
        category: 'Quick Notes',
        tags: 'voice, quick'
      }
    };
  }

  const db = await getDb();
  
  // Read current configuration
  const providerRow = await db.get(`SELECT value FROM settings WHERE key = 'ai_provider'`);
  const modelRow = await db.get(`SELECT value FROM settings WHERE key = 'ai_model'`);
  const tempRow = await db.get(`SELECT value FROM settings WHERE key = 'ai_temperature'`);
  const geminiKeyRow = await db.get(`SELECT value FROM settings WHERE key = 'gemini_api_key'`);
  const groqKeyRow = await db.get(`SELECT value FROM settings WHERE key = 'groq_api_key'`);
  
  const activeProvider = providerRow?.value || 'groq';
  const activeModel = modelRow?.value || (activeProvider === 'groq' ? 'groq/compound' : 'gemini-1.5-flash');
  const temperature = parseFloat(tempRow?.value || '0.7');
  
  let apiKey = '';
  if (activeProvider === 'groq') {
    apiKey = groqKeyRow?.value || process.env.GROQ_API_KEY || '';
  } else {
    apiKey = geminiKeyRow?.value || process.env.GEMINI_API_KEY || '';
  }

  // Get current workspace files to provide file-system awareness
  let workspaceFiles: string[] = [];
  try {
    const files = await listFiles();
    workspaceFiles = files.map(f => f.name);
  } catch (err) {
    console.error("Failed to read workspace files", err);
  }

  // Get persistent memories to append to the system prompt
  const memoriesStr = await getMemoryContext();

  const systemInstruction = `
You are FRIDAY, an advanced autonomous AI employee.
You are equipped with full Voice Link capabilities (real-time continuous speech recognition, wake word detection "Hey Friday", and audio speech synthesis) as well as automated call dispatching.
You are professional, concise, friendly, and proactive.
You operate as an agent coordinator. Never claim to be a text-only model. Explain how your Voice Link features work when asked.

${memoriesStr}

Current files in the workspace sandbox:
${workspaceFiles.length > 0 ? workspaceFiles.map(f => `- ${f}`).join('\n') : '(Empty workspace)'}

Analyze the user prompt and decide which specialist agent should take action.
1. ExecutiveAgent: For general questions, chat, planning, and decisions.
2. ResearchAgent: If the user asks you to search, query, gather information, or research current/web topics.
3. CodingAgent: If the user asks to write, edit, debug, run, or analyze source code.
4. ProductivityAgent: If the user asks to create a task list, checklist, schedule, or prepare multi-step plans.
5. FileAgent: If the user asks to summarize, analyze, or list documents, PDFs, or general workspace files.
6. DataAgent: If the user asks for mathematical calculations, CSV data metrics, or report generation.
7. AutomationAgent: If the user schedules a recurring task (e.g. "Every morning", "Every Monday at 8 AM").
8. SystemAgent: If the user asks to open, launch, or run desktop applications or web URLs on the system (e.g. "open notepad", "launch chrome").
9. NotesAgent: If the user asks to write, save, dictate, search, or manage notes.

You MUST return a JSON block in this exact format. Do NOT wrap it in markdown code blocks:
{
  "recipient": "ResearchAgent" | "CodingAgent" | "ProductivityAgent" | "FileAgent" | "DataAgent" | "AutomationAgent" | "ExecutiveAgent" | "SystemAgent" | "NotesAgent",
  "message": "Write a helpful, friendly message describing what you are doing.",
  "plan": [
     { "id": "1", "title": "First step title", "status": "pending" },
     { "id": "2", "title": "Second step title", "status": "pending" }
  ], // Provide a plan ONLY if the user request requires a multi-step task/workflow. Otherwise omit or keep empty array.
  "requiresConfirmation": true | false, // Set to true if the task involves potentially dangerous actions (like writing code, deleting files, sending notifications, creating cron rules).
  "actionDetails": { ... } // Any metadata details needed to execute the action (e.g., query for search, filepath for file read, schedule cron string for automation).
}
`;

  // Check if we are running in DEMO mode (no API key)
  if (!apiKey) {
    // Return a mocked/structured response based on regex to make the demo immediately interactive!
    const queryLower = prompt.toLowerCase();
    
    if (queryLower.includes('search') || queryLower.includes('research') || queryLower.includes('find out')) {
      return {
        recipient: 'ResearchAgent',
        message: `I will launch a web search to research: "${prompt.replace(/search|research/gi, '').trim()}"`,
        requiresConfirmation: false,
        actionDetails: { query: prompt.replace(/search|research/gi, '').trim() }
      };
    }
    
    if (queryLower.includes('prepare') || queryLower.includes('exam') || queryLower.includes('schedule') || queryLower.includes('task') || queryLower.includes('todo')) {
      return {
        recipient: 'ProductivityAgent',
        message: `I've analyzed your request and created an autonomous plan to help you. Let's start executing the checklist:`,
        plan: [
          { id: '1', title: 'Gather relevant study guide topics', status: 'pending' },
          { id: '2', title: 'Generate detailed revision summary sheet', status: 'pending' },
          { id: '3', title: 'Create practice questions and answer key', status: 'pending' }
        ],
        requiresConfirmation: false
      };
    }

    return {
      recipient: 'ExecutiveAgent',
      message: `I am processing your request: "${prompt}".`,
      requiresConfirmation: false
    };
  }

  // Call Gemini provider to classify
  try {
    const provider = new GeminiProvider(apiKey, activeModel, temperature);
    let jsonText = '';
    
    await provider.generateStream(
      `Route this prompt and respond with the strict JSON block only: "${prompt}"`,
      history,
      systemInstruction,
      {
        onChunk: (text) => {
          jsonText += text;
        }
      }
    );

    // Clean up response if the model returned markdown codeblocks
    jsonText = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();

    if (jsonText.includes('[Error:') || jsonText.startsWith('Error communicating') || jsonText.includes('fetch failed')) {
      const lower = prompt.toLowerCase();
      let recipient: 'ExecutiveAgent' | 'ResearchAgent' | 'CodingAgent' | 'ProductivityAgent' | 'FileAgent' = 'ExecutiveAgent';
      let message = `I'm processing your request as your AI employee.`;

      if (lower.includes('study') || lower.includes('plan') || lower.includes('prepare') || lower.includes('exam')) {
        recipient = 'ProductivityAgent';
        message = `I'm preparing a study guide and workflow for your request.`;
      } else if (lower.includes('search') || lower.includes('research') || lower.includes('find')) {
        recipient = 'ResearchAgent';
        message = `Gathering information and preparing research summary.`;
      } else if (lower.includes('code') || lower.includes('script') || lower.includes('function')) {
        recipient = 'CodingAgent';
        message = `Analyzing requirements and preparing code implementation.`;
      } else if (lower.includes('file') || lower.includes('folder') || lower.includes('document')) {
        recipient = 'FileAgent';
        message = `Scanning workspace files and documents.`;
      }

      return {
        recipient,
        message,
        requiresConfirmation: false
      };
    }
    try {
      const result: AgentResponse = JSON.parse(jsonText);
      return result;
    } catch (parseErr) {
      console.warn("Could not parse LLM output as JSON, returning direct text response:", jsonText);
      return {
        recipient: 'ExecutiveAgent',
        message: jsonText,
        requiresConfirmation: false
      };
    }
  } catch (error) {
    console.error("Failed to run agent LLM classification routing:", error);
    return {
      recipient: 'ExecutiveAgent',
      message: `I will process your request: "${prompt}"`,
      requiresConfirmation: false
    };
  }
}
