import { useState, useEffect, useRef } from 'react';
import { 
  Mic, MicOff, Play, CheckCircle, AlertCircle, Cpu, 
  RefreshCw, Layers, MessageSquare, CheckSquare, FolderOpen, Brain, 
  Zap, Settings, LogOut, Send, Trash2, Plus, X, Lock, Save, FileCode, Check,
  Phone, PhoneCall, PhoneOff, StickyNote
} from 'lucide-react';
import { api, createWebSocketConnection } from './services/api';
import type { Task, ActivityLog, Memory, Automation, FileEntry } from './services/api';
import { DashboardPage } from './pages/DashboardPage';
import { NotesPage } from './pages/NotesPage';
import './App.css';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
}

function App() {
  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!!localStorage.getItem('friday_token'));
  const [username, setUsername] = useState<string>(localStorage.getItem('friday_username') || '');
  const [loginUsername, setLoginUsername] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [loginError, setLoginError] = useState<string>('');

  // UI State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'chat' | 'notes' | 'tasks' | 'files' | 'memories' | 'automations' | 'settings'>('dashboard');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Data State
  const [tasks, setTasks] = useState<Task[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});

  // Chat State
  const [chatInput, setChatInput] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 'welcome', role: 'assistant', content: 'Hello! I am FRIDAY, your autonomous AI employee. How can I help you manage your projects today?' }
  ]);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [currentStreamText, setCurrentStreamText] = useState<string>('');
  const [pendingConfirmation, setPendingConfirmation] = useState<any | null>(null);
  
  // Voice State
  const [isVoiceLinkActive, setIsVoiceLinkActive] = useState<boolean>(localStorage.getItem('friday_voice_link') !== 'false');
  const [isAwake, setIsAwake] = useState<boolean>(false);

  // Call Service States
  const [callStatus, setCallStatus] = useState<'idle' | 'ringing' | 'connected'>('idle');
  const [isCallActive, setIsCallActive] = useState<boolean>(false);
  const [callTimer, setCallTimer] = useState<number>(0);
  const [callTranscript, setCallTranscript] = useState<string[]>([]);

  // Voice State Refs to prevent stale closures in event listeners
  const isAwakeRef = useRef<boolean>(false);
  const isVoiceLinkActiveRef = useRef<boolean>(localStorage.getItem('friday_voice_link') !== 'false');
  const pendingConfirmationRef = useRef<any>(null);
  const isCallActiveRef = useRef<boolean>(false);
  const isLastPromptFromVoiceRef = useRef<boolean>(false);
  const isSpeakingRef = useRef<boolean>(false);
  const commandSilenceTimerRef = useRef<any>(null);

  useEffect(() => {
    isVoiceLinkActiveRef.current = isVoiceLinkActive;
  }, [isVoiceLinkActive]);

  useEffect(() => {
    isAwakeRef.current = isAwake;
  }, [isAwake]);

  useEffect(() => {
    pendingConfirmationRef.current = pendingConfirmation;
  }, [pendingConfirmation]);

  useEffect(() => {
    isCallActiveRef.current = isCallActive;
  }, [isCallActive]);

  // Call timer effect
  useEffect(() => {
    let interval: any = null;
    if (callStatus === 'connected') {
      interval = setInterval(() => {
        setCallTimer((prev) => prev + 1);
      }, 1000);
    } else {
      setCallTimer(0);
    }
    return () => clearInterval(interval);
  }, [callStatus]);

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remaining = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remaining.toString().padStart(2, '0')}`;
  };

  // Modals & Forms State
  const [editingFile, setEditingFile] = useState<FileEntry | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [isSavingFile, setIsSavingFile] = useState<boolean>(false);
  const [newFileName, setNewFileName] = useState<string>('');
  const [showNewFileModal, setShowNewFileModal] = useState<boolean>(false);

  // Task Form State
  const [taskTitle, setTaskTitle] = useState<string>('');
  const [taskDesc, setTaskDesc] = useState<string>('');
  const [taskPriority, setTaskPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [taskSteps, setTaskSteps] = useState<string[]>(['']);

  // Memory Form State
  const [memCategory, setMemCategory] = useState<string>('facts');
  const [memKey, setMemKey] = useState<string>('');
  const [memContent, setMemContent] = useState<string>('');

  // Automation Form State
  const [autoName, setAutoName] = useState<string>('');
  const [autoTrigger, setAutoTrigger] = useState<string>('0 9 * * *');
  const [autoAction, setAutoAction] = useState<string>('');

  // WebSocket Ref
  const wsRef = useRef<WebSocket | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<any>(null);

  // Text-to-Speech Output feedback
  const speakText = (text: string, onEndCallback?: () => void) => {
    if (!window.speechSynthesis) return;
    
    // Stop any ongoing speech
    window.speechSynthesis.cancel();
    
    // Clean text of markdown, asterisks, brackets, links, headers for speech synthesis
    const cleanText = text
      .replace(/\*+/g, '') 
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') 
      .replace(/`+/g, '') 
      .replace(/#[#\s\w]+/g, '') 
      .trim();

    if (!cleanText) {
      if (onEndCallback) onEndCallback();
      return;
    }
    
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = parseFloat(settings.voice_speed || '1.0');
    
    utterance.onstart = () => {
      isSpeakingRef.current = true;
      try {
        if (recognitionRef.current) {
          recognitionRef.current.abort();
        }
      } catch (e) {}
    };

    utterance.onend = () => {
      isSpeakingRef.current = false;
      if (onEndCallback) {
        onEndCallback();
      }
      if (isVoiceLinkActiveRef.current || isCallActiveRef.current) {
        setTimeout(() => {
          try {
            if (recognitionRef.current) {
              recognitionRef.current.start();
            }
          } catch (e) {}
        }, 200);
      }
    };

    utterance.onerror = () => {
      isSpeakingRef.current = false;
      if (onEndCallback) onEndCallback();
      if (isVoiceLinkActiveRef.current || isCallActiveRef.current) {
        setTimeout(() => {
          try {
            if (recognitionRef.current) {
              recognitionRef.current.start();
            }
          } catch (e) {}
        }, 200);
      }
    };

    window.speechSynthesis.speak(utterance);
  };

  // Voice Command Router to make every process voice-accessible
  const handleVoiceCommand = (command: string) => {
    const lower = command.toLowerCase();
    
    // Navigation routing
    if (lower.includes('go to dashboard') || lower.includes('open dashboard') || lower.includes('show dashboard')) {
      setActiveTab('dashboard');
      speakText("Opening Dashboard.");
      return;
    }
    if (lower.includes('go to chat') || lower.includes('open chat') || lower.includes('go to console') || lower.includes('open console') || lower.includes('show chat')) {
      setActiveTab('chat');
      speakText("Opening Chat Console.");
      return;
    }
    if (lower.includes('go to note') || lower.includes('open note') || lower.includes('show note') || lower.includes('show my notes')) {
      setActiveTab('notes');
      speakText("Opening Smart Notes workspace.");
      return;
    }
    if (lower.includes('go to task') || lower.includes('open task') || lower.includes('go to planner') || lower.includes('open planner') || lower.includes('show tasks')) {
      setActiveTab('tasks');
      speakText("Opening Task Planner.");
      return;
    }
    if (lower.includes('go to file') || lower.includes('open file') || lower.includes('go to manager') || lower.includes('open manager') || lower.includes('show files')) {
      setActiveTab('files');
      speakText("Opening File Manager.");
      return;
    }
    if (lower.includes('go to memory') || lower.includes('open memory') || lower.includes('go to bank') || lower.includes('open bank') || lower.includes('show memories')) {
      setActiveTab('memories');
      speakText("Opening Memory Bank.");
      return;
    }
    if (lower.includes('go to automation') || lower.includes('open automation') || lower.includes('show automations')) {
      setActiveTab('automations');
      speakText("Opening Automations.");
      return;
    }
    if (lower.includes('go to setting') || lower.includes('open setting') || lower.includes('show settings')) {
      setActiveTab('settings');
      speakText("Opening System Settings.");
      return;
    }
    if (lower.includes('log out') || lower.includes('logout')) {
      handleLogout();
      speakText("Logging out.");
      return;
    }

    // Direct Voice Launcher for Desktop Applications
    const appMatch = command.match(/^(?:open|launch|run|start)\s+(?:the\s+)?(?:app|application\s+)?(notepad|calculator|calc|chrome|edge|vs code|vscode|code|file explorer|explorer|cmd|command prompt|powershell|paint|mspaint|spotify|word|excel)\b/i);
    if (appMatch) {
      const appName = appMatch[1].trim();
      api.launchApp(appName).then((res) => {
        speakText(res.message);
      });
      return;
    }

    // Confirmation actions
    const pending = pendingConfirmationRef.current;
    if (pending && (lower.includes('approve') || lower.includes('run') || lower.includes('accept'))) {
      handleApproveAction();
      speakText("Action approved.");
      return;
    }
    if (pending && (lower.includes('reject') || lower.includes('cancel') || lower.includes('deny'))) {
      handleRejectAction();
      speakText("Action rejected.");
      return;
    }
    
    // Otherwise, submit prompt directly
    isLastPromptFromVoiceRef.current = true;
    submitUserPrompt(command);
  };

  // Call Service Refs and Helpers
  const callTargetNameRef = useRef<string>('');
  const callObjectiveRef = useRef<string>('');
  const callTranscriptRef = useRef<string[]>([]);

  const addToTranscript = (line: string) => {
    callTranscriptRef.current = [...callTranscriptRef.current, line];
    setCallTranscript(callTranscriptRef.current);
  };

  const requestReceiverCallResponse = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({
      type: 'simulate_receiver',
      payload: {
        targetName: callTargetNameRef.current,
        objective: callObjectiveRef.current,
        transcript: callTranscriptRef.current
      }
    }));
  };

  const requestFridayCallResponse = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({
      type: 'simulate_friday',
      payload: {
        targetName: callTargetNameRef.current,
        objective: callObjectiveRef.current,
        transcript: callTranscriptRef.current
      }
    }));
  };

  const startOutboundCall = (details: any) => {
    callTargetNameRef.current = details.name;
    callObjectiveRef.current = details.objective;
    callTranscriptRef.current = [
      `[System] Dialing ${details.name} (${details.number})...`,
      `[System] Call connected via operator's mobile phone.`
    ];
    setCallTranscript(callTranscriptRef.current);
    setCallStatus('connected');
    setIsCallActive(true);
    setCallTimer(0);
    
    const greetingText = `Hello ${details.name}, this is FRIDAY calling on behalf of the admin ${details.adminName || 'admin'}. I am calling to: ${details.objective}.`;
    addToTranscript(`FRIDAY: ${greetingText}`);
    
    speakText(greetingText, () => {
      if (isCallActiveRef.current) {
        requestReceiverCallResponse();
      }
    });
  };

  // Call Answering Service Helpers
  const simulateIncomingCall = () => {
    if (callStatus !== 'idle') return;
    setCallStatus('ringing');
    callTranscriptRef.current = [`[System] Incoming call from Operator...`];
    setCallTranscript(callTranscriptRef.current);
    
    // Automatic Answering Check
    if (settings.auto_call_answering === 'true') {
      setTimeout(() => {
        handleAcceptCall();
      }, 2200);
    }
  };

  const handleAcceptCall = () => {
    setCallStatus('connected');
    setIsCallActive(true);
    setCallTimer(0);
    callTargetNameRef.current = 'Operator';
    callObjectiveRef.current = 'incoming answering';
    callTranscriptRef.current = [`[System] Call connected.`];
    setCallTranscript(callTranscriptRef.current);
    speakText("Hello, this is FRIDAY. How can I assist you today?");
  };

  const handleDeclineCall = () => {
    setCallStatus('idle');
    setIsCallActive(false);
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  };

  const handleHangUp = () => {
    setCallStatus('idle');
    setIsCallActive(false);
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    speakText("Goodbye.");
  };

  // Bootstrapping continuous speech recognition with wakeword detection
  useEffect(() => {
    if (!isAuthenticated) return;
    
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Speech recognition is not supported in this browser.");
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';

    let restartTimer: any = null;

    rec.onresult = (event: any) => {
      if (isSpeakingRef.current) return;

      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      const text = (finalTranscript || interimTranscript).toLowerCase().trim();
      if (!text) return;

      console.log("[STT] Text detected:", text, "| Awake status:", isAwakeRef.current, "| Call status:", isCallActiveRef.current);

      if (isCallActiveRef.current) {
        if (finalTranscript) {
          const command = finalTranscript.trim();
          if (command) {
            // Check for hang up / goodbye keywords
            const lowerCommand = command.toLowerCase();
            if (lowerCommand.includes('hang up') || lowerCommand.includes('goodbye') || lowerCommand.includes('end call')) {
              handleHangUp();
              return;
            }

            setCallTranscript((prev) => [...prev, `Caller: ${command}`]);
            isLastPromptFromVoiceRef.current = true;
            submitUserPrompt(command);

            try {
              rec.stop();
            } catch (e) {}
          }
        }
        return;
      }

      const wakewordRegex = /\b(hey friday|hi friday|hello friday|ok friday|okay friday|friday)\b/i;
      const hasWakeword = wakewordRegex.test(text);

      if (!isAwakeRef.current) {
        if (hasWakeword) {
          const commandAfterWakeword = text.replace(wakewordRegex, '').trim().replace(/^[.,\s!?]+|[.,\s!?]+$/g, '');
          if (commandAfterWakeword.length > 3) {
            // User spoke "Hey Friday [command]" in one breath -> Wait 1.2s silence to ensure full command
            if (commandSilenceTimerRef.current) clearTimeout(commandSilenceTimerRef.current);
            commandSilenceTimerRef.current = setTimeout(() => {
              setIsAwake(false);
              handleVoiceCommand(commandAfterWakeword);
              try { rec.stop(); } catch (e) {}
            }, 2500);
          } else {
            // User said "Hey Friday" alone -> Wake up and ask
            setIsAwake(true);
            speakText("Yes, Operator?");
            try { rec.stop(); } catch (e) {}
          }
        }
      } else {
        // Awake! Listening for incoming command (e.g. "open...", "open task planner", "prepare study guide")
        let command = text.replace(wakewordRegex, '').trim().replace(/^[.,\s!?]+|[.,\s!?]+$/g, '');
        if (command.length > 1) {
          // Clear any pending timer to reset countdown while user is still speaking
          if (commandSilenceTimerRef.current) clearTimeout(commandSilenceTimerRef.current);
          
          // Wait for 2.5 seconds of silence before finalizing and executing the command
          commandSilenceTimerRef.current = setTimeout(() => {
            if (command.trim().length > 1) {
              setIsAwake(false);
              handleVoiceCommand(command.trim());
              try { rec.stop(); } catch (e) {}
            }
          }, 2500);
        }
      }
    };

    rec.onerror = (e: any) => {
      console.error("Speech Recognition Error:", e);
      if (e.error === 'not-allowed') {
        alert("Microphone access was denied. Please update browser permissions to use Voice Link.");
        setIsVoiceLinkActive(false);
      }
    };

    rec.onend = () => {
      if (isVoiceLinkActiveRef.current || isCallActiveRef.current) {
        restartTimer = setTimeout(() => {
          try {
            rec.start();
          } catch (err) {
            // Re-instantiate fresh recognizer if previous instance was locked by Chrome
            try {
              const freshRec = new SpeechRecognition();
              freshRec.continuous = true;
              freshRec.interimResults = true;
              freshRec.lang = 'en-US';
              freshRec.onresult = rec.onresult;
              freshRec.onerror = rec.onerror;
              freshRec.onend = rec.onend;
              recognitionRef.current = freshRec;
              freshRec.start();
            } catch (e2) {}
          }
        }, 150);
      }
    };

    recognitionRef.current = rec;

    if (isVoiceLinkActive || isCallActive) {
      try {
        rec.start();
      } catch (err) {
        console.error("Error starting speech recognizer on mount:", err);
      }
    }

    return () => {
      clearTimeout(restartTimer);
      rec.onend = null;
      try {
        rec.stop();
      } catch (err) {}
    };
  }, [isAuthenticated, isVoiceLinkActive, isCallActive]);

  // WebSocket Setup
  useEffect(() => {
    if (!isAuthenticated) return;

    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch (e) {}
    }

    // Connect to WebSocket server
    const ws = createWebSocketConnection((msg) => {
      if (msg.type === 'stream_start') {
        setIsStreaming(true);
        setCurrentStreamText('');
        setPendingConfirmation(null);
      } else if (msg.type === 'stream_chunk') {
        setCurrentStreamText((prev) => prev + msg.payload);
      } else if (msg.type === 'stream_end') {
        setIsStreaming(false);
        setCurrentStreamText((prev) => {
          if (prev) {
            setMessages((old) => {
              // Deduplicate identical consecutive assistant responses
              if (old.length > 0 && old[old.length - 1].role === 'assistant' && old[old.length - 1].content === prev) {
                return old;
              }
              return [...old, { id: Math.random().toString(36).substring(7), role: 'assistant', content: prev }];
            });
            
            if (isCallActiveRef.current) {
              addToTranscript(`FRIDAY: ${prev}`);
              speakText(prev, () => {
                const lower = prev.toLowerCase();
                if (lower.includes('goodbye') || lower.includes('hang up') || lower.includes('talk later')) {
                  handleHangUp();
                } else if (isCallActiveRef.current) {
                  requestReceiverCallResponse();
                }
              });
            } else {
              const shouldSpeak = isLastPromptFromVoiceRef.current;
              if (shouldSpeak) {
                speakText(prev);
              }
            }
          }
          return '';
        });
        loadTasks();
        loadActivityLogs();
        loadFiles();
      } else if (msg.type === 'stream_end_receiver') {
        setIsStreaming(false);
        setCurrentStreamText((prev) => {
          if (prev) {
            addToTranscript(`${callTargetNameRef.current}: ${prev}`);
            speakText(prev, () => {
              if (isCallActiveRef.current) {
                requestFridayCallResponse();
              }
            });
          }
          return '';
        });
      } else if (msg.type === 'confirmation_required') {
        setIsStreaming(false);
        setPendingConfirmation(msg.payload);
      } else if (msg.type === 'task_created' || msg.type === 'task_updated') {
        loadTasks();
        loadActivityLogs();
      } else if (msg.type === 'activity_logged') {
        loadActivityLogs();
      } else if (msg.type === 'error') {
        setIsStreaming(false);
        setMessages((old) => [...old, { id: Math.random().toString(36).substring(7), role: 'system', content: `[Error] ${msg.payload}` }]);
      }
    });

    wsRef.current = ws;

    return () => {
      try {
        ws.close();
      } catch (e) {}
      wsRef.current = null;
    };
  }, [isAuthenticated]);

  // Load Data on Auth
  useEffect(() => {
    if (isAuthenticated) {
      loadAllData();
    }
  }, [isAuthenticated]);

  // Scroll Chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentStreamText, pendingConfirmation]);

  const loadAllData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        loadTasks(),
        loadActivityLogs(),
        loadMemories(),
        loadAutomations(),
        loadFiles(),
        loadSettings()
      ]);
    } catch (err) {
      console.error("Failed to load initial workspace data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadTasks = async () => {
    const list = await api.getTasks();
    setTasks(list);
  };

  const loadActivityLogs = async () => {
    const list = await api.getActivityLogs();
    setLogs(list);
  };

  const loadMemories = async () => {
    const list = await api.getMemories();
    setMemories(list);
  };

  const loadAutomations = async () => {
    const list = await api.getAutomations();
    setAutomations(list);
  };

  const loadFiles = async () => {
    const list = await api.listFiles();
    setFiles(list);
  };

  const loadSettings = async () => {
    const list = await api.getSettings();
    setSettings(list);
  };

  // Auth Handlers
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password: loginPassword })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }
      localStorage.setItem('friday_token', data.token);
      localStorage.setItem('friday_username', data.username);
      setUsername(data.username);
      setIsAuthenticated(true);
    } catch (err: any) {
      setLoginError(err.message || 'Server connection error');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('friday_token');
    localStorage.removeItem('friday_username');
    setIsAuthenticated(false);
    wsRef.current?.close();
  };

  // Voice Link Toggle
  const handleToggleVoice = () => {
    setIsVoiceLinkActive((prev) => {
      const next = !prev;
      localStorage.setItem('friday_voice_link', String(next));
      if (!next) {
        setIsAwake(false);
        if (window.speechSynthesis) window.speechSynthesis.cancel();
      } else {
        speakText("Voice link initialized.");
      }
      return next;
    });
  };

  // Quick Action triggers
  const handleQuickAction = (actionText: string) => {
    setActiveTab('chat');
    isLastPromptFromVoiceRef.current = false;
    submitUserPrompt(actionText);
  };

  // Typed prompt submit helper
  const handleTypedPromptSubmit = () => {
    isLastPromptFromVoiceRef.current = false;
    submitUserPrompt(chatInput);
  };

  // Chat Execution Prompt Submission
  const submitUserPrompt = (promptText: string) => {
    if (!promptText.trim()) return;

    // Add user message
    const userMsg: ChatMessage = {
      id: Math.random().toString(36).substring(7),
      role: 'user',
      content: promptText
    };

    setMessages((old) => [...old, userMsg]);
    setChatInput('');

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'chat_message',
        payload: {
          prompt: promptText,
          history: messages
            .filter((m) => m.id !== 'welcome' && m.role !== 'system')
            .map((m) => ({ role: m.role, content: m.content }))
        }
      }));
    } else {
      setMessages((old) => [...old, {
        id: Math.random().toString(36).substring(7),
        role: 'system',
        content: 'System offline. WebSocket connection is inactive.'
      }]);
    }
  };

  const handleApproveAction = () => {
    if (!pendingConfirmation || !wsRef.current) return;

    if (pendingConfirmation.actionDetails?.type === 'outbound_call') {
      startOutboundCall(pendingConfirmation.actionDetails);
      setPendingConfirmation(null);
      return;
    }

    wsRef.current.send(JSON.stringify({
      type: 'approve_action',
      payload: {
        recipient: pendingConfirmation.recipient,
        actionDetails: pendingConfirmation.actionDetails,
        plan: pendingConfirmation.plan,
        messagePrompt: messages[messages.length - 1]?.content || 'Approved action'
      }
    }));

    setPendingConfirmation(null);
  };

  const handleRejectAction = () => {
    setMessages((old) => [...old, {
      id: Math.random().toString(36).substring(7),
      role: 'system',
      content: 'Action rejected by operator.'
    }]);
    setPendingConfirmation(null);
  };

  // Tasks operations
  const handleExecuteTask = async (id: string) => {
    await api.executeTask(id);
    loadTasks();
  };

  const handleDeleteTask = async (id: string) => {
    await api.deleteTask(id);
    loadTasks();
    loadActivityLogs();
  };

  const handleAddStep = () => {
    setTaskSteps([...taskSteps, '']);
  };

  const handleRemoveStep = (idx: number) => {
    setTaskSteps(taskSteps.filter((_, i) => i !== idx));
  };

  const handleStepChange = (idx: number, val: string) => {
    const updated = [...taskSteps];
    updated[idx] = val;
    setTaskSteps(updated);
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;

    const filteredSteps = taskSteps.filter(s => s.trim() !== '').map((s, idx) => ({
      id: String(idx + 1),
      title: s,
      status: 'pending' as const
    }));

    await api.createTask({
      title: taskTitle,
      description: taskDesc,
      priority: taskPriority,
      steps: filteredSteps
    });

    setTaskTitle('');
    setTaskDesc('');
    setTaskPriority('medium');
    setTaskSteps(['']);
    loadTasks();
    loadActivityLogs();
  };

  // Files operations
  const handleOpenFile = async (file: FileEntry) => {
    try {
      const content = await api.readFile(file.path);
      setEditingFile(file);
      setFileContent(content);
    } catch (err) {
      alert("Could not load file contents: " + err);
    }
  };

  const handleSaveFile = async () => {
    if (!editingFile) return;
    setIsSavingFile(true);
    try {
      await api.writeFile(editingFile.path, fileContent);
      // Refresh list
      loadFiles();
      loadActivityLogs();
      setEditingFile(null);
    } catch (err) {
      alert("Error saving file: " + err);
    } finally {
      setIsSavingFile(false);
    }
  };

  const handleCreateFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim()) return;

    try {
      await api.writeFile(newFileName, '// New file in sandbox');
      setNewFileName('');
      setShowNewFileModal(false);
      loadFiles();
      loadActivityLogs();
    } catch (err) {
      alert("Failed to create file: " + err);
    }
  };

  const handleDeleteFile = async (filePath: string) => {
    if (!confirm(`Are you sure you want to delete file "${filePath}"?`)) return;
    try {
      await api.deleteFile(filePath);
      loadFiles();
      loadActivityLogs();
    } catch (err) {
      alert("Error deleting file: " + err);
    }
  };

  // Memories operations
  const handleCreateMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memKey.trim() || !memContent.trim()) return;
    await api.addMemory(memCategory, memKey, memContent);
    setMemKey('');
    setMemContent('');
    loadMemories();
    loadActivityLogs();
  };

  const handleDeleteMemory = async (id: string) => {
    await api.deleteMemory(id);
    loadMemories();
    loadActivityLogs();
  };

  // Automations operations
  const handleCreateAutomation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!autoName.trim() || !autoAction.trim()) return;
    await api.createAutomation({
      name: autoName,
      trigger_type: 'cron',
      trigger_val: autoTrigger,
      action_type: 'ai_report',
      action_val: autoAction
    });
    setAutoName('');
    setAutoAction('');
    loadAutomations();
    loadActivityLogs();
  };

  const handleToggleAutomation = async (id: string, active: number) => {
    await api.toggleAutomation(id, active === 0);
    loadAutomations();
    loadActivityLogs();
  };

  const handleDeleteAutomation = async (id: string) => {
    await api.deleteAutomation(id);
    loadAutomations();
    loadActivityLogs();
  };

  // Settings operations
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.saveSettings(settings);
    alert("Settings updated successfully!");
    loadSettings();
    loadActivityLogs();
  };

  const handleSettingChange = (key: string, value: string) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Render Login overlay
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-grid-cyber flex items-center justify-center relative p-4">
        <div className="absolute inset-0 bg-gradient-to-tr from-cyan-950/20 via-slate-950 to-purple-950/20 pointer-events-none" />
        <div className="radial-glow absolute inset-0 pointer-events-none" />
        
        <div className="glass-panel w-full max-w-md p-8 rounded-2xl relative z-10 border border-cyan-500/20 shadow-2xl">
          <div className="text-center space-y-3 mb-8">
            <div className="mx-auto w-14 h-14 bg-cyan-500/10 border border-cyan-500/30 rounded-xl flex items-center justify-center text-cyan-400 float-animation shadow-lg">
              <Cpu size={28} />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white font-mono">
              FRIDAY <span className="text-cyan-400">ENGINE</span>
            </h1>
            <p className="text-sm text-slate-400">Provide authorization key for AI employee sandbox.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-mono text-cyan-400/80 uppercase tracking-widest mb-1.5 font-semibold">Username</label>
              <input
                type="text"
                placeholder="admin"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                className="w-full bg-slate-900/60 border border-white/10 rounded-xl p-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-400 transition font-mono text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-cyan-400/80 uppercase tracking-widest mb-1.5 font-semibold">Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full bg-slate-900/60 border border-white/10 rounded-xl p-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-400 transition font-mono text-sm"
                required
              />
            </div>

            {loginError && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-lg flex items-center gap-2">
                <AlertCircle size={14} />
                <span>{loginError}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold p-3.5 rounded-xl transition-all duration-300 shadow-lg cursor-pointer flex items-center justify-center gap-2 font-mono text-sm"
            >
              <Lock size={15} /> INITIALIZE SESSION
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col md:flex-row text-slate-200">
      
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 glass-panel border-r border-white/5 md:min-h-screen flex flex-col justify-between p-4 md:sticky md:top-0 h-auto md:h-screen z-20">
        <div className="space-y-6">
          {/* Logo Brand */}
          <div className="flex items-center justify-between px-2 py-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <Cpu size={18} />
              </div>
              <div>
                <h2 className="text-base font-bold text-white font-mono tracking-wider">FRIDAY AI</h2>
                <span className="text-[10px] text-cyan-500/80 font-mono tracking-widest uppercase">Operator Console</span>
              </div>
            </div>
            <button
              onClick={simulateIncomingCall}
              title="Simulate Incoming Call"
              className="p-1.5 bg-slate-900 border border-white/10 hover:border-cyan-400 text-cyan-400 hover:text-cyan-300 rounded-lg cursor-pointer transition flex items-center justify-center"
            >
              <PhoneCall size={14} />
            </button>
          </div>

          {/* Nav List */}
          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer ${
                activeTab === 'dashboard'
                  ? 'bg-cyan-500/10 text-cyan-400 border-l-2 border-cyan-400'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <Layers size={16} /> Dashboard
            </button>
            <button
              onClick={() => setActiveTab('chat')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer ${
                activeTab === 'chat'
                  ? 'bg-cyan-500/10 text-cyan-400 border-l-2 border-cyan-400'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <MessageSquare size={16} /> Chat Console
            </button>
            <button
              onClick={() => setActiveTab('notes')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer ${
                activeTab === 'notes'
                  ? 'bg-cyan-500/10 text-cyan-400 border-l-2 border-cyan-400'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <StickyNote size={16} /> Smart Notes
            </button>
            <button
              onClick={() => setActiveTab('tasks')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer ${
                activeTab === 'tasks'
                  ? 'bg-cyan-500/10 text-cyan-400 border-l-2 border-cyan-400'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <CheckSquare size={16} /> Task Planner
            </button>
            <button
              onClick={() => setActiveTab('files')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer ${
                activeTab === 'files'
                  ? 'bg-cyan-500/10 text-cyan-400 border-l-2 border-cyan-400'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <FolderOpen size={16} /> File Manager
            </button>
            <button
              onClick={() => setActiveTab('memories')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer ${
                activeTab === 'memories'
                  ? 'bg-cyan-500/10 text-cyan-400 border-l-2 border-cyan-400'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <Brain size={16} /> Memory Bank
            </button>
            <button
              onClick={() => setActiveTab('automations')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer ${
                activeTab === 'automations'
                  ? 'bg-cyan-500/10 text-cyan-400 border-l-2 border-cyan-400'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <Zap size={16} /> Automations
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer ${
                activeTab === 'settings'
                  ? 'bg-cyan-500/10 text-cyan-400 border-l-2 border-cyan-400'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <Settings size={16} /> System Settings
            </button>
          </nav>
        </div>

        {/* User Card */}
        <div className="border-t border-white/5 pt-4 mt-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center font-bold text-cyan-400">
              {username[0]?.toUpperCase()}
            </div>
            <div>
              <p className="text-xs font-semibold text-white font-mono">{username}</p>
              {isLoading ? (
                <span className="text-[10px] text-cyan-400 font-mono flex items-center gap-1">
                  <RefreshCw size={10} className="animate-spin text-cyan-500" />
                  SYNCING...
                </span>
              ) : (
                <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full status-pulse" />
                  ONLINE
                </span>
              )}
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Log Out Session"
            className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition cursor-pointer"
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* Main Workspace Frame */}
      <main className="flex-1 p-6 md:p-8 overflow-y-auto max-h-screen">
        
        {/* Render Active View Tab */}
        {activeTab === 'dashboard' && (
          <DashboardPage
            tasks={tasks}
            logs={logs}
            isVoiceActive={isVoiceLinkActive}
            isAwake={isAwake}
            isCallActive={isCallActive}
            onToggleVoice={handleToggleVoice}
            onQuickAction={handleQuickAction}
            onExecuteTask={handleExecuteTask}
            onSimulateCall={simulateIncomingCall}
          />
        )}

        {activeTab === 'notes' && (
          <NotesPage onSpeak={(txt) => speakText(txt)} />
        )}

        {activeTab === 'chat' && (
          <div className="glass-panel rounded-2xl border border-white/5 h-[calc(100vh-6rem)] flex flex-col">
            
            {/* Header */}
            <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-slate-900/40">
              <div className="flex items-center gap-2">
                <MessageSquare size={18} className="text-cyan-400" />
                <h2 className="font-semibold text-white">AI Assistant Console</h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2 py-0.5 rounded font-mono uppercase">
                  Workspace sandbox active
                </span>
              </div>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl p-4 border text-sm ${
                      m.role === 'user'
                        ? 'bg-cyan-500/10 border-cyan-500/20 text-slate-200 rounded-tr-none'
                        : m.role === 'system'
                        ? 'bg-red-950/20 border-red-900/30 text-red-300 font-mono text-xs'
                        : 'bg-slate-900/80 border-white/5 text-slate-300 rounded-tl-none'
                    }`}
                  >
                    <p className="font-bold text-[10px] font-mono text-slate-500 uppercase mb-1">
                      {m.role === 'user' ? 'Operator' : m.role === 'system' ? 'System Notification' : 'FRIDAY'}
                    </p>
                    <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>
                  </div>
                </div>
              ))}

              {/* Streaming Content */}
              {isStreaming && currentStreamText && (
                <div className="flex justify-start">
                  <div className="max-w-[80%] rounded-2xl rounded-tl-none p-4 bg-slate-900/80 border border-white/5 text-slate-300 text-sm">
                    <p className="font-bold text-[10px] font-mono text-cyan-400 uppercase mb-1 flex items-center gap-1.5">
                      <RefreshCw size={10} className="animate-spin" /> FRIDAY STREAMING
                    </p>
                    <div className="whitespace-pre-wrap leading-relaxed">{currentStreamText}</div>
                  </div>
                </div>
              )}

              {/* Pending confirmation block */}
              {pendingConfirmation && (
                <div className="flex justify-start">
                  <div className="max-w-[80%] rounded-2xl rounded-tl-none p-5 bg-cyan-950/20 border border-cyan-500/40 text-slate-200 text-sm space-y-4 shadow-xl neon-border-cyan">
                    <div className="flex items-center gap-2 text-cyan-400">
                      <AlertCircle size={18} />
                      <h3 className="font-bold font-mono text-xs uppercase tracking-wider">APPROVAL REQUIRED</h3>
                    </div>
                    <div className="space-y-2">
                      <p className="text-slate-300">
                        <strong className="text-cyan-300">{pendingConfirmation.recipient}</strong> requests approval for the following action:
                      </p>
                      <p className="bg-slate-900/60 p-3 rounded border border-white/5 text-xs text-slate-400 font-mono italic">
                        {pendingConfirmation.message}
                      </p>
                    </div>

                    {pendingConfirmation.plan && pendingConfirmation.plan.length > 0 && (
                      <div className="space-y-1.5 border-t border-white/5 pt-3">
                        <p className="text-xs font-mono uppercase text-slate-400 font-bold">Planned steps:</p>
                        {pendingConfirmation.plan.map((step: any, idx: number) => (
                          <div key={step.id} className="flex items-center gap-2 text-xs text-slate-400">
                            <div className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                            <span>{idx + 1}. {step.title}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {pendingConfirmation.actionDetails && pendingConfirmation.actionDetails.code && (
                      <div className="space-y-1.5 border-t border-white/5 pt-3">
                        <p className="text-xs font-mono uppercase text-slate-400 font-bold">Generated Source Code ({pendingConfirmation.actionDetails.filename}):</p>
                        <pre className="bg-slate-950/80 p-3 rounded border border-cyan-500/20 text-xs font-mono text-cyan-300 max-h-48 overflow-y-auto">
                          {pendingConfirmation.actionDetails.code}
                        </pre>
                      </div>
                    )}

                    <div className="flex items-center gap-3 pt-2">
                      <button
                        onClick={handleApproveAction}
                        className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-4 py-2 rounded-lg text-xs font-mono flex items-center gap-1.5 cursor-pointer transition"
                      >
                        <Check size={14} /> APPROVE & RUN
                      </button>
                      <button
                        onClick={handleRejectAction}
                        className="bg-slate-900 border border-white/10 hover:border-red-500/40 text-slate-300 hover:text-red-400 px-4 py-2 rounded-lg text-xs font-mono cursor-pointer transition"
                      >
                        <X size={14} /> REJECT
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Input Bar */}
            <div className="p-4 border-t border-white/5 bg-slate-950/60 flex items-center gap-3">
              <button
                onClick={handleToggleVoice}
                className={`p-3 rounded-xl transition ${
                  isVoiceLinkActive 
                    ? 'bg-red-500/20 text-red-400 border border-red-500/40 neon-border-red animate-pulse' 
                    : 'bg-slate-900 border border-white/10 text-cyan-400 hover:bg-slate-800'
                }`}
                title={isVoiceLinkActive ? "Disable continuous Voice Link" : "Activate continuous Voice Link"}
              >
                {isVoiceLinkActive ? <MicOff size={18} className="animate-bounce" /> : <Mic size={18} />}
              </button>
              <input
                type="text"
                placeholder={
                  isVoiceLinkActive 
                    ? (isAwake ? "FRIDAY is listening... speak command now." : "Voice link active. Say 'Friday' or 'Hey Friday' to wake.")
                    : "Ask FRIDAY to write code, search web, create tasks..."
                }
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleTypedPromptSubmit()}
                className="flex-1 bg-slate-900 border border-white/10 rounded-xl p-3.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition text-sm font-mono"
                disabled={isStreaming}
              />
              <button
                onClick={() => handleTypedPromptSubmit()}
                className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 p-3.5 rounded-xl cursor-pointer transition font-bold"
                disabled={!chatInput.trim() || isStreaming}
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        )}

        {activeTab === 'tasks' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                  <CheckSquare className="text-cyan-400" />
                  Productivity Task Planner
                </h1>
                <p className="text-slate-400 mt-1">Configure and manage autonomous task checklists.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* List of Tasks */}
              <div className="lg:col-span-2 space-y-4">
                <div className="glass-panel p-5 rounded-2xl">
                  <h2 className="text-sm font-semibold text-slate-400 font-mono uppercase tracking-wider mb-4">ACTIVE WORKFLOWS</h2>
                  
                  {tasks.length === 0 ? (
                    <p className="text-slate-500 text-sm font-mono py-8 text-center border border-dashed border-white/5 rounded-xl">No tasks defined yet. Use the prompt engine or form below to create tasks.</p>
                  ) : (
                    <div className="space-y-4">
                      {tasks.map((task) => (
                        <div key={task.id} className="bg-slate-900/40 p-4 rounded-xl border border-white/5 hover:border-white/10 transition space-y-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={`text-[10px] font-mono px-2 py-0.5 rounded border font-bold uppercase ${
                                  task.status === 'completed'
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                    : task.status === 'running'
                                    ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20 animate-pulse'
                                    : task.status === 'failed'
                                    ? 'bg-red-500/10 text-red-400 border-red-500/20'
                                    : 'bg-slate-800 text-slate-400 border-white/5'
                                }`}>
                                  {task.status}
                                </span>
                                <span className="text-[10px] font-mono bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-white/5 uppercase">
                                  {task.priority} priority
                                </span>
                              </div>
                              <h3 className="text-base font-bold text-white mt-2">{task.title}</h3>
                              <p className="text-xs text-slate-400 mt-0.5">{task.description}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              {task.status === 'pending' && (
                                <button
                                  onClick={() => handleExecuteTask(task.id)}
                                  className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold p-2 rounded-lg text-xs font-mono flex items-center gap-1 cursor-pointer transition"
                                >
                                  <Play size={12} /> Execute
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteTask(task.id)}
                                className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition cursor-pointer"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>

                          {/* Checklist steps */}
                          {task.steps && task.steps.length > 0 && (
                            <div className="border-t border-white/5 pt-3 space-y-2">
                              {task.steps.map((step) => (
                                <div key={step.id} className="flex items-start gap-2.5 text-xs">
                                  {step.status === 'completed' ? (
                                    <CheckCircle size={14} className="text-emerald-400 mt-0.5" />
                                  ) : step.status === 'running' ? (
                                    <span className="w-3.5 h-3.5 rounded-full border border-t-transparent border-cyan-400 animate-spin mt-0.5" />
                                  ) : step.status === 'failed' ? (
                                    <AlertCircle size={14} className="text-red-400 mt-0.5" />
                                  ) : (
                                    <div className="w-3.5 h-3.5 rounded-full border border-slate-600 mt-0.5" />
                                  )}
                                  <div className="flex-1">
                                    <span className={step.status === 'completed' ? 'text-slate-500 line-through' : 'text-slate-300'}>
                                      {step.title}
                                    </span>
                                    {step.result && (
                                      <p className="bg-slate-950/60 p-2 rounded mt-1 border border-white/5 text-[10px] text-cyan-400/80 font-mono whitespace-pre-line">
                                        {step.result}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Task Creation Form */}
              <div className="glass-panel p-5 rounded-2xl h-fit">
                <h2 className="text-sm font-semibold text-slate-400 font-mono uppercase tracking-wider mb-4">NEW AUTONOMOUS WORKFLOW</h2>
                <form onSubmit={handleCreateTask} className="space-y-4">
                  <div>
                    <label className="block text-xs font-mono text-slate-400 mb-1">Task Title</label>
                    <input
                      type="text"
                      placeholder="e.g. Ingest financial records"
                      value={taskTitle}
                      onChange={(e) => setTaskTitle(e.target.value)}
                      className="w-full bg-slate-900 border border-white/10 rounded-xl p-2.5 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-400 transition font-mono text-xs"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-slate-400 mb-1">Description</label>
                    <textarea
                      placeholder="Explain task objective..."
                      value={taskDesc}
                      onChange={(e) => setTaskDesc(e.target.value)}
                      className="w-full bg-slate-900 border border-white/10 rounded-xl p-2.5 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-400 transition font-mono text-xs h-16"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-slate-400 mb-1">Priority</label>
                    <select
                      value={taskPriority}
                      onChange={(e) => setTaskPriority(e.target.value as any)}
                      className="w-full bg-slate-900 border border-white/10 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-cyan-400 transition font-mono text-xs"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>

                  {/* Steps list */}
                  <div className="space-y-2">
                    <label className="block text-xs font-mono text-slate-400">Execution Steps Checklist</label>
                    {taskSteps.map((step, idx) => (
                      <div key={idx} className="flex gap-2">
                        <input
                          type="text"
                          placeholder={`Step ${idx + 1}`}
                          value={step}
                          onChange={(e) => handleStepChange(idx, e.target.value)}
                          className="flex-1 bg-slate-900 border border-white/10 rounded-xl p-2 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-400 transition font-mono text-xs"
                          required
                        />
                        {taskSteps.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveStep(idx)}
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10 px-2 rounded-xl transition"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={handleAddStep}
                      className="text-xs text-cyan-400 hover:text-cyan-300 font-mono flex items-center gap-1"
                    >
                      <Plus size={12} /> Add execution step
                    </button>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold p-3 rounded-xl transition font-mono text-xs cursor-pointer"
                  >
                    REGISTER TASK PLAN
                  </button>
                </form>
              </div>

            </div>
          </div>
        )}

        {activeTab === 'files' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                  <FolderOpen className="text-cyan-400" />
                  Workspace Sandbox File Manager
                </h1>
                <p className="text-slate-400 mt-1">Review, write, and execute code within isolated sandbox directories.</p>
              </div>
              <button
                onClick={() => setShowNewFileModal(true)}
                className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-4 py-2.5 rounded-xl text-xs font-mono flex items-center gap-1.5 cursor-pointer transition"
              >
                <Plus size={14} /> Create file
              </button>
            </div>

            {/* Main view: Left file list, right active editor */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* File list */}
              <div className="lg:col-span-1 glass-panel p-5 rounded-2xl h-fit">
                <h2 className="text-sm font-semibold text-slate-400 font-mono uppercase tracking-wider mb-4 font-bold">DIRECTORY FILE LIST</h2>
                {files.length === 0 ? (
                  <p className="text-slate-500 text-xs font-mono py-6 text-center">Empty workspace sandbox.</p>
                ) : (
                  <div className="space-y-2">
                    {files.map((file) => (
                      <div
                        key={file.path}
                        className={`flex justify-between items-center p-2.5 rounded-xl border transition group cursor-pointer ${
                          editingFile?.path === file.path
                            ? 'bg-cyan-500/10 border-cyan-500/30'
                            : 'bg-slate-900/40 border-white/5 hover:border-white/10'
                        }`}
                      >
                        <div
                          onClick={() => handleOpenFile(file)}
                          className="flex items-center gap-2.5 flex-1 min-w-0"
                        >
                          <FileCode size={16} className={editingFile?.path === file.path ? 'text-cyan-400' : 'text-slate-400'} />
                          <div className="truncate text-xs font-mono">
                            <p className="text-slate-200 truncate">{file.name}</p>
                            <span className="text-[9px] text-slate-500">{Math.ceil(file.size / 1024)} KB</span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteFile(file.path)}
                          className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Editor panel */}
              <div className="lg:col-span-2">
                {editingFile ? (
                  <div className="glass-panel rounded-2xl border border-cyan-500/20 overflow-hidden flex flex-col h-[calc(100vh-14rem)]">
                    <div className="px-5 py-3.5 bg-slate-900/60 border-b border-white/5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileCode size={15} className="text-cyan-400" />
                        <span className="text-xs font-mono font-bold text-slate-200">{editingFile.path}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleSaveFile}
                          disabled={isSavingFile}
                          className="bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-800 text-slate-950 font-bold px-3.5 py-1.5 rounded-lg text-xs font-mono flex items-center gap-1.5 cursor-pointer transition"
                        >
                          <Save size={13} />
                          {isSavingFile ? 'Saving...' : 'Save File'}
                        </button>
                        <button
                          onClick={() => setEditingFile(null)}
                          className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-white/5 rounded-lg transition cursor-pointer"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>

                    <textarea
                      value={fileContent}
                      onChange={(e) => setFileContent(e.target.value)}
                      className="flex-1 bg-slate-950/80 p-4 text-cyan-300 font-mono text-xs leading-relaxed focus:outline-none resize-none overflow-y-auto"
                    />
                  </div>
                ) : (
                  <div className="glass-panel rounded-2xl border border-white/5 p-8 text-center flex flex-col items-center justify-center h-[calc(100vh-14rem)] space-y-3">
                    <FileCode size={40} className="text-slate-700 float-animation" />
                    <h3 className="font-bold font-mono text-slate-400 text-sm">NO ACTIVE FILE SELECT</h3>
                    <p className="text-xs text-slate-500 max-w-sm">Choose an existing source file from the directory sidebar list to view or edit workspace logic directly.</p>
                  </div>
                )}
              </div>

            </div>

            {/* New File Modal */}
            {showNewFileModal && (
              <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="glass-panel w-full max-w-sm p-6 rounded-2xl border border-cyan-500/30">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-white font-mono text-sm">CREATE NEW SANDBOX FILE</h3>
                    <button
                      onClick={() => setShowNewFileModal(false)}
                      className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg cursor-pointer"
                    >
                      <X size={15} />
                    </button>
                  </div>
                  <form onSubmit={handleCreateFile} className="space-y-4">
                    <div>
                      <label className="block text-xs font-mono text-slate-400 mb-1.5">File Name / Path</label>
                      <input
                        type="text"
                        placeholder="e.g. analyzer.py, index.html"
                        value={newFileName}
                        onChange={(e) => setNewFileName(e.target.value)}
                        className="w-full bg-slate-900 border border-white/10 rounded-xl p-2.5 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-400 transition font-mono text-xs"
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold p-3 rounded-xl transition font-mono text-xs cursor-pointer"
                    >
                      CREATE EMPTY FILE
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'memories' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                <Brain className="text-cyan-400" />
                Persistent Memory Bank
              </h1>
              <p className="text-slate-400 mt-1">Manage static guidelines, constraints, and project context variables injected into agent runs.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Memories List */}
              <div className="lg:col-span-2 space-y-4">
                <div className="glass-panel p-5 rounded-2xl">
                  <h2 className="text-sm font-semibold text-slate-400 font-mono uppercase tracking-wider mb-4">STORED CONSTRAINTS & FACTS</h2>
                  
                  {memories.length === 0 ? (
                    <p className="text-slate-500 text-xs font-mono py-8 text-center border border-dashed border-white/5 rounded-xl">No facts stored. Add core guidelines or operator context details.</p>
                  ) : (
                    <div className="space-y-3">
                      {memories.map((mem) => (
                        <div key={mem.id} className="bg-slate-900/40 p-4 rounded-xl border border-white/5 flex justify-between items-start gap-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2 py-0.5 rounded uppercase font-bold">
                                {mem.category}
                              </span>
                              <strong className="text-xs font-mono text-slate-200">{mem.key}</strong>
                            </div>
                            <p className="text-xs text-slate-400 mt-2 font-mono">{mem.content}</p>
                          </div>
                          <button
                            onClick={() => handleDeleteMemory(mem.id)}
                            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition cursor-pointer"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Add Memory Form */}
              <div className="glass-panel p-5 rounded-2xl h-fit">
                <h2 className="text-sm font-semibold text-slate-400 font-mono uppercase tracking-wider mb-4">ADD NEW PERSISTENT KEY</h2>
                <form onSubmit={handleCreateMemory} className="space-y-4">
                  <div>
                    <label className="block text-xs font-mono text-slate-400 mb-1">Category</label>
                    <select
                      value={memCategory}
                      onChange={(e) => setMemCategory(e.target.value)}
                      className="w-full bg-slate-900 border border-white/10 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-cyan-400 transition font-mono text-xs"
                    >
                      <option value="preferences">Operator Preferences</option>
                      <option value="projects">Project Information</option>
                      <option value="facts">Standard Facts</option>
                      <option value="important">Important Guidelines</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-slate-400 mb-1">Key Name</label>
                    <input
                      type="text"
                      placeholder="e.g. coding_style_rule"
                      value={memKey}
                      onChange={(e) => setMemKey(e.target.value)}
                      className="w-full bg-slate-900 border border-white/10 rounded-xl p-2.5 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-400 transition font-mono text-xs"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-slate-400 mb-1">Content Details</label>
                    <textarea
                      placeholder="Provide target details that specialists must retain..."
                      value={memContent}
                      onChange={(e) => setMemContent(e.target.value)}
                      className="w-full bg-slate-900 border border-white/10 rounded-xl p-2.5 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-400 transition font-mono text-xs h-24"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold p-3 rounded-xl transition font-mono text-xs cursor-pointer"
                  >
                    ADD FACT KEY
                  </button>
                </form>
              </div>

            </div>
          </div>
        )}

        {activeTab === 'automations' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                <Zap className="text-cyan-400" />
                Background Automations & Cron Rules
              </h1>
              <p className="text-slate-400 mt-1">Configure scheduled cron-based agents to run code audits, gather research, or run pipeline tasks.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Automations list */}
              <div className="lg:col-span-2 space-y-4">
                <div className="glass-panel p-5 rounded-2xl">
                  <h2 className="text-sm font-semibold text-slate-400 font-mono uppercase tracking-wider mb-4">CRON TRIGGER RULES</h2>
                  
                  {automations.length === 0 ? (
                    <p className="text-slate-500 text-xs font-mono py-8 text-center border border-dashed border-white/5 rounded-xl">No active triggers registered. Create an automation rule below.</p>
                  ) : (
                    <div className="space-y-3">
                      {automations.map((auto) => (
                        <div key={auto.id} className="bg-slate-900/40 p-4 rounded-xl border border-white/5 flex justify-between items-center gap-4">
                          <div>
                            <div className="flex items-center gap-2.5">
                              <span className={`w-2 h-2 rounded-full ${auto.active === 1 ? 'bg-emerald-400 status-pulse' : 'bg-slate-600'}`} />
                              <strong className="text-xs font-mono text-slate-200">{auto.name}</strong>
                              <span className="text-[9px] bg-slate-800 text-slate-400 border border-white/5 px-2 py-0.5 rounded font-mono">
                                CRON: {auto.trigger_val}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400 mt-2 font-mono">Action Prompt: "{auto.action_val}"</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => handleToggleAutomation(auto.id, auto.active)}
                              className={`px-3 py-1 rounded-lg text-xs font-mono cursor-pointer transition ${
                                auto.active === 1
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : 'bg-slate-800 text-slate-400 border border-white/5'
                              }`}
                            >
                              {auto.active === 1 ? 'Active' : 'Disabled'}
                            </button>
                            <button
                              onClick={() => handleDeleteAutomation(auto.id)}
                              className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition cursor-pointer"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Add Automation Form */}
              <div className="glass-panel p-5 rounded-2xl h-fit">
                <h2 className="text-sm font-semibold text-slate-400 font-mono uppercase tracking-wider mb-4">REGISTER AUTOMATION</h2>
                <form onSubmit={handleCreateAutomation} className="space-y-4">
                  <div>
                    <label className="block text-xs font-mono text-slate-400 mb-1">Automation Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Audit code nightly"
                      value={autoName}
                      onChange={(e) => setAutoName(e.target.value)}
                      className="w-full bg-slate-900 border border-white/10 rounded-xl p-2.5 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-400 transition font-mono text-xs"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-slate-400 mb-1">Cron Expression</label>
                    <input
                      type="text"
                      placeholder="e.g. 0 9 * * * (Every morning at 9 AM)"
                      value={autoTrigger}
                      onChange={(e) => setAutoTrigger(e.target.value)}
                      className="w-full bg-slate-900 border border-white/10 rounded-xl p-2.5 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-400 transition font-mono text-xs"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-slate-400 mb-1">AI Action Prompt</label>
                    <textarea
                      placeholder="Prompt details for the agent to run on trigger..."
                      value={autoAction}
                      onChange={(e) => setAutoAction(e.target.value)}
                      className="w-full bg-slate-900 border border-white/10 rounded-xl p-2.5 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-400 transition font-mono text-xs h-20"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold p-3 rounded-xl transition font-mono text-xs cursor-pointer"
                  >
                    SCHEDULE CRON RULE
                  </button>
                </form>
              </div>

            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-6 max-w-3xl">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                <Settings className="text-cyan-400" />
                System Configurations
              </h1>
              <p className="text-slate-400 mt-1">Configure LLM routing engines, API credentials, and voice properties.</p>
            </div>

            <div className="glass-panel p-6 rounded-2xl border border-white/5">
              <form onSubmit={handleSaveSettings} className="space-y-6">
                
                {/* AI parameters */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-mono text-cyan-400/80 uppercase tracking-widest mb-1.5 font-bold">LLM Provider</label>
                    <select
                      value={settings.ai_provider || 'groq'}
                      onChange={(e) => handleSettingChange('ai_provider', e.target.value)}
                      className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-slate-100 focus:outline-none focus:border-cyan-400 transition font-mono text-xs"
                    >
                      <option value="groq">Groq Cloud (Llama 3 / Mixtral)</option>
                      <option value="gemini">Google Gemini AI</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-cyan-400/80 uppercase tracking-widest mb-1.5 font-bold">Default Model</label>
                    <input
                      type="text"
                      placeholder={settings.ai_provider === 'groq' ? 'groq/compound' : 'gemini-1.5-flash'}
                      value={settings.ai_model || (settings.ai_provider === 'groq' ? 'groq/compound' : 'gemini-1.5-flash')}
                      onChange={(e) => handleSettingChange('ai_model', e.target.value)}
                      className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-slate-100 focus:outline-none focus:border-cyan-400 transition font-mono text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-xs font-mono text-cyan-400/80 uppercase tracking-widest mb-1.5 font-bold">Groq API Key</label>
                    <input
                      type="password"
                      placeholder="gsk_..."
                      value={settings.groq_api_key || ''}
                      onChange={(e) => handleSettingChange('groq_api_key', e.target.value)}
                      className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-400 transition font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-cyan-400/80 uppercase tracking-widest mb-1.5 font-bold">Gemini API Key</label>
                    <input
                      type="password"
                      placeholder="AIzaSy..."
                      value={settings.gemini_api_key || ''}
                      onChange={(e) => handleSettingChange('gemini_api_key', e.target.value)}
                      className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-400 transition font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-cyan-400/80 uppercase tracking-widest mb-1.5 font-bold">LLM Temperature</label>
                    <input
                      type="number"
                      min="0"
                      max="2"
                      step="0.1"
                      value={settings.ai_temperature || '0.7'}
                      onChange={(e) => handleSettingChange('ai_temperature', e.target.value)}
                      className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-slate-100 focus:outline-none focus:border-cyan-400 transition font-mono text-xs"
                    />
                  </div>
                </div>

                <div className="border-t border-white/5 pt-6 space-y-4">
                  <h3 className="font-bold font-mono text-xs text-slate-400 uppercase tracking-wider">Voice & Audio Link</h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div>
                      <label className="block text-xs font-mono text-slate-400 mb-1.5">Voice Engine Status</label>
                      <select
                        value={settings.voice_enabled || 'true'}
                        onChange={(e) => handleSettingChange('voice_enabled', e.target.value)}
                        className="w-full bg-slate-900 border border-white/10 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-cyan-400 transition font-mono text-xs"
                      >
                        <option value="true">Speech Enabled</option>
                        <option value="false">Speech Disabled</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-mono text-slate-400 mb-1.5">Voice Name</label>
                      <input
                        type="text"
                        value={settings.voice_name || 'default'}
                        onChange={(e) => handleSettingChange('voice_name', e.target.value)}
                        className="w-full bg-slate-900 border border-white/10 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-cyan-400 transition font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-mono text-slate-400 mb-1.5">Speaking Rate (Speed)</label>
                      <input
                        type="number"
                        min="0.5"
                        max="2.0"
                        step="0.1"
                        value={settings.voice_speed || '1.0'}
                        onChange={(e) => handleSettingChange('voice_speed', e.target.value)}
                        className="w-full bg-slate-900 border border-white/10 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-cyan-400 transition font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-mono text-slate-400 mb-1.5">Auto Call Answering</label>
                      <select
                        value={settings.auto_call_answering || 'false'}
                        onChange={(e) => handleSettingChange('auto_call_answering', e.target.value)}
                        className="w-full bg-slate-900 border border-white/10 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-cyan-400 transition font-mono text-xs"
                      >
                        <option value="true">Auto-Answer (2.2s)</option>
                        <option value="false">Manual Answering</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="border-t border-white/5 pt-6 flex justify-end">
                  <button
                    type="submit"
                    className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-6 py-3 rounded-xl transition font-mono text-xs cursor-pointer shadow-lg"
                  >
                    SAVE CONFIGURATION
                  </button>
                </div>

              </form>
            </div>
          </div>
        )}

      </main>

      {/* Call Answering Service Overlay */}
      {callStatus !== 'idle' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fade-in">
          <div className="absolute inset-0 bg-gradient-to-tr from-cyan-950/10 via-slate-950/40 to-purple-950/10 pointer-events-none" />
          
          <div className="glass-panel max-w-md w-full rounded-3xl p-8 border border-cyan-500/30 flex flex-col items-center justify-between text-center relative overflow-hidden shadow-2xl">
            {/* Background pulsing glow */}
            <div className="absolute -top-24 -left-24 w-48 h-48 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -right-24 w-48 h-48 rounded-full bg-purple-500/10 blur-3xl pointer-events-none" />

            <div className="w-full space-y-6">
              {/* Header */}
              <div>
                <span className="text-[10px] font-mono text-cyan-400 border border-cyan-500/20 px-2.5 py-1 rounded bg-cyan-500/5 uppercase font-bold tracking-widest">
                  {callStatus === 'ringing' ? 'INCOMING CALL' : 'VOICE CONNECTION'}
                </span>
                <h3 className="text-xl font-bold text-white mt-4 font-mono tracking-wide">FRIDAY AI Employee</h3>
                <p className="text-xs text-slate-400 mt-1 font-mono">Secure Voice Line</p>
              </div>

              {/* Pulsing Avatar / Wave animation */}
              <div className="flex justify-center items-center py-6">
                {callStatus === 'ringing' ? (
                  <div className="relative">
                    <div className="w-24 h-24 rounded-full bg-cyan-500/10 border-2 border-cyan-500/40 flex items-center justify-center text-cyan-400 animate-pulse">
                      <PhoneCall size={36} className="animate-bounce" />
                    </div>
                    <div className="absolute -inset-2 rounded-full border border-cyan-500/20 animate-ping pointer-events-none" />
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-20 h-20 rounded-full bg-cyan-500/10 border-2 border-cyan-500/30 flex items-center justify-center text-cyan-400">
                      <Mic size={30} className={isSpeakingRef.current ? "" : "animate-pulse"} />
                    </div>
                    
                    {/* Simulated Voice wave */}
                    <div className="flex items-end justify-center gap-1 h-8 mt-2">
                      <div className={`w-1 bg-cyan-400 rounded transition-all duration-300 ${isSpeakingRef.current ? 'h-6 animate-pulse' : 'h-1'}`} />
                      <div className={`w-1 bg-cyan-400 rounded transition-all duration-300 ${isSpeakingRef.current ? 'h-8' : 'h-2'}`} />
                      <div className={`w-1 bg-cyan-400 rounded transition-all duration-300 ${isSpeakingRef.current ? 'h-4 animate-pulse' : 'h-1'}`} />
                      <div className={`w-1 bg-cyan-400 rounded transition-all duration-300 ${isSpeakingRef.current ? 'h-7' : 'h-2'}`} />
                      <div className={`w-1 bg-cyan-400 rounded transition-all duration-300 ${isSpeakingRef.current ? 'h-5 animate-pulse' : 'h-1'}`} />
                    </div>
                  </div>
                )}
              </div>

              {/* Timer & Connection details */}
              {callStatus === 'connected' && (
                <div className="space-y-1">
                  <p className="text-3xl font-extrabold text-white font-mono tracking-widest text-neon-glow">{formatTime(callTimer)}</p>
                  <p className="text-[10px] font-mono tracking-wide text-slate-400 uppercase">
                    {isSpeakingRef.current ? 'FRIDAY responding...' : 'Listening to Operator...'}
                  </p>
                </div>
              )}

              {/* Transcript list */}
              {callStatus === 'connected' && (
                <div className="w-full bg-slate-950/60 border border-white/5 rounded-2xl p-4 max-h-40 overflow-y-auto text-left space-y-2 text-xs font-mono scrollbar-thin scrollbar-thumb-slate-800">
                  {callTranscript.map((t, idx) => (
                    <div key={idx} className={t.startsWith('Caller:') ? 'text-slate-300' : t.startsWith('FRIDAY:') ? 'text-cyan-400 font-bold' : 'text-slate-500 italic'}>
                      {t}
                    </div>
                  ))}
                  {isStreaming && currentStreamText && (
                    <div className="text-cyan-400/80 animate-pulse">
                      FRIDAY: {currentStreamText}...
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-center gap-6 pt-4">
                {callStatus === 'ringing' ? (
                  <>
                    <button
                      onClick={handleDeclineCall}
                      className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-400 text-white flex items-center justify-center cursor-pointer transition shadow-lg hover:shadow-red-500/20"
                      title="Decline Call"
                    >
                      <PhoneOff size={22} />
                    </button>
                    <button
                      onClick={handleAcceptCall}
                      className="w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center justify-center cursor-pointer transition shadow-lg hover:shadow-emerald-500/20 animate-bounce"
                      title="Accept Call"
                    >
                      <Phone size={22} />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handleHangUp}
                    className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-400 text-white flex items-center justify-center cursor-pointer transition-all duration-300 shadow-lg hover:shadow-red-500/30 hover:scale-105"
                    title="Hang Up"
                  >
                    <PhoneOff size={26} />
                  </button>
                )}
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;
