import React from 'react';
import { Mic, MicOff, Play, CheckCircle, AlertCircle, FileText, Globe, Cpu, RefreshCw, Layers, Phone } from 'lucide-react';
import type { Task, ActivityLog } from '../services/api';

interface DashboardPageProps {
  tasks: Task[];
  logs: ActivityLog[];
  isVoiceActive: boolean;
  isAwake: boolean;
  isCallActive: boolean;
  onToggleVoice: () => void;
  onQuickAction: (action: string) => void;
  onExecuteTask: (id: string) => void;
  onSimulateCall: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  tasks,
  logs,
  isVoiceActive,
  isAwake,
  isCallActive,
  onToggleVoice,
  onQuickAction,
  onExecuteTask,
  onSimulateCall,
}) => {
  const activeTask = tasks.find((t) => t.status === 'running') || tasks.find((t) => t.status === 'pending');
  const completedCount = tasks.filter((t) => t.status === 'completed').length;
  const runningCount = tasks.filter((t) => t.status === 'running').length;

  return (
    <div className="space-y-6">
      {/* Top Welcome Panel */}
      <div className="glass-panel p-6 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2">
            Welcome Back, <span className="text-cyan-400 text-neon-glow">Operator</span>
          </h1>
          <p className="text-slate-400 mt-1">FRIDAY is active, configured, and monitoring your workspaces.</p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {/* Dynamic Voice Button widget */}
          <div className="flex items-center gap-4 bg-slate-900/60 p-2.5 rounded-xl border border-white/5">
            <div className="text-right">
              <p className="text-xs text-slate-500 font-mono">VOICE LINK</p>
              <p className="text-sm font-semibold text-slate-300 font-mono">
                {isVoiceActive ? (isAwake ? 'ACTIVE COMMAND' : 'LISTENING FOR WAKE') : 'VOICE LINK OFF'}
              </p>
            </div>
            <button
              onClick={onToggleVoice}
              className={`p-4 rounded-xl cursor-pointer transition-all duration-300 ${
                isVoiceActive
                  ? 'bg-red-500/20 text-red-400 border border-red-500/40 neon-border-red animate-pulse'
                  : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/25 hover:border-cyan-400'
              }`}
            >
              {isVoiceActive ? <MicOff size={22} className="animate-bounce" /> : <Mic size={22} />}
            </button>
          </div>

          {/* Call Answering Service widget */}
          <div className="flex items-center gap-4 bg-slate-900/60 p-2.5 rounded-xl border border-white/5">
            <div className="text-right">
              <p className="text-xs text-slate-500 font-mono">CALL SERVICE</p>
              <p className="text-sm font-semibold text-slate-300 font-mono">
                {isCallActive ? 'ACTIVE CALL' : 'STANDBY'}
              </p>
            </div>
            <button
              onClick={onSimulateCall}
              title="Simulate Incoming Call"
              className={`p-4 rounded-xl cursor-pointer transition-all duration-300 ${
                isCallActive
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 neon-border-emerald animate-pulse'
                  : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/25 hover:border-cyan-400'
              }`}
            >
              <Phone size={22} />
            </button>
          </div>
        </div>
      </div>

      {/* Voice Waveform Overlay if Speaking/Listening */}
      {isAwake && (
        <div className="glass-panel-glow p-6 rounded-2xl flex flex-col items-center justify-center gap-4 border border-cyan-400/30">
          <div className="flex items-end justify-center gap-1.5 h-12">
            <div className="wave-bar h-2" />
            <div className="wave-bar h-5" />
            <div className="wave-bar h-8" />
            <div className="wave-bar h-10" />
            <div className="wave-bar h-6" />
            <div className="wave-bar h-9" />
            <div className="wave-bar h-4" />
            <div className="wave-bar h-7" />
          </div>
          <p className="text-sm text-cyan-400 font-mono tracking-widest text-neon-glow animate-pulse">
            FRIDAY ACTIVE & LISTENING... (SPEAK COMMAND NOW)
          </p>
        </div>
      )}

      {/* Widget Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Widget 1: System Status */}
        <div className="glass-panel p-5 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-400 font-mono tracking-wider">COMMAND SYSTEM</h2>
            <Cpu size={16} className="text-cyan-400" />
          </div>
          <div className="space-y-3.5">
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-400">Agent Core</span>
              <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 status-pulse" />
                ONLINE
              </span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-400">Task Scheduler</span>
              <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 status-pulse" />
                IDLE
              </span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-400">Desktop Apps Launcher</span>
              <span className="text-emerald-400 font-mono">READY</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-400">Smart Notes Bank</span>
              <span className="text-cyan-400 font-mono">ACTIVE</span>
            </div>
          </div>
        </div>

        {/* Widget 2: Tasks Metrics */}
        <div className="glass-panel p-5 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-400 font-mono tracking-wider">WORKFLOW STATS</h2>
            <Layers size={16} className="text-cyan-400" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-900/40 p-4 rounded-xl border border-white/5 text-center">
              <p className="text-2xl font-bold text-cyan-400 font-mono text-neon-glow">{runningCount}</p>
              <p className="text-xs text-slate-400 mt-1 font-mono">RUNNING</p>
            </div>
            <div className="bg-slate-900/40 p-4 rounded-xl border border-white/5 text-center">
              <p className="text-2xl font-bold text-emerald-400 font-mono text-neon-glow-green">{completedCount}</p>
              <p className="text-xs text-slate-400 mt-1 font-mono font-semibold">COMPLETED</p>
            </div>
          </div>
          <div className="text-xs text-slate-500 font-mono flex items-center gap-1.5">
            <RefreshCw size={12} className="animate-spin text-cyan-500/60" /> Auto-syncing with background engine
          </div>
        </div>

        {/* Widget 3: Quick Action Launchpad */}
        <div className="glass-panel p-5 rounded-2xl space-y-3.5">
          <h2 className="text-sm font-semibold text-slate-400 font-mono tracking-wider mb-2">QUICK ACTIONS</h2>
          <button
            onClick={() => onQuickAction('Take a note: Meeting with team at 4 PM to review progress')}
            className="w-full text-left bg-slate-950/40 hover:bg-cyan-950/20 border border-white/5 hover:border-cyan-500/30 p-2.5 rounded-xl text-sm flex items-center gap-2.5 transition text-slate-300 cursor-pointer"
          >
            <FileText size={15} className="text-cyan-400" />
            Dictate & Save Quick Note
          </button>
          <button
            onClick={() => onQuickAction('Prepare study guide for tomorrow\'s AI exam')}
            className="w-full text-left bg-slate-950/40 hover:bg-cyan-950/20 border border-white/5 hover:border-cyan-500/30 p-2.5 rounded-xl text-sm flex items-center gap-2.5 transition text-slate-300 cursor-pointer"
          >
            <FileText size={15} className="text-cyan-400" />
            Launch AI Exam Planner
          </button>
          <button
            onClick={() => onQuickAction('Search AI industry news and summarize benchmarks')}
            className="w-full text-left bg-slate-950/40 hover:bg-cyan-950/20 border border-white/5 hover:border-cyan-500/30 p-2.5 rounded-xl text-sm flex items-center gap-2.5 transition text-slate-300 cursor-pointer"
          >
            <Globe size={15} className="text-cyan-400" />
            Research AI News summary
          </button>
        </div>
      </div>

      {/* Desktop App Launcher Panel */}
      <div className="glass-panel p-6 rounded-2xl space-y-4 border border-cyan-500/20">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Cpu className="text-cyan-400" size={20} />
              Desktop App Launcher
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Launch local applications directly on your computer via 1-click or voice commands ("Hey FRIDAY, open Chrome")
            </p>
          </div>
          <span className="text-xs font-mono text-cyan-400 bg-cyan-500/10 px-2.5 py-1 rounded border border-cyan-500/20">
            12 App Shortcuts
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {[
            { name: 'Notepad', cmd: 'open notepad', icon: '📝' },
            { name: 'Calculator', cmd: 'open calculator', icon: '🧮' },
            { name: 'Chrome', cmd: 'open chrome', icon: '🌐' },
            { name: 'VS Code', cmd: 'open code', icon: '💻' },
            { name: 'File Explorer', cmd: 'open file explorer', icon: '📁' },
            { name: 'Terminal / CMD', cmd: 'open cmd', icon: '🖥️' },
          ].map((app) => (
            <button
              key={app.name}
              onClick={() => onQuickAction(app.cmd)}
              className="bg-slate-900/60 hover:bg-cyan-950/40 border border-white/5 hover:border-cyan-500/40 p-3 rounded-xl flex flex-col items-center justify-center gap-1.5 transition group cursor-pointer"
            >
              <span className="text-2xl group-hover:scale-110 transition-transform duration-200">{app.icon}</span>
              <span className="text-xs font-semibold text-slate-300 group-hover:text-cyan-400 transition">{app.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Active Task indicator */}
      {activeTask && (
        <div className="glass-panel p-5 rounded-2xl border border-cyan-500/20">
          <div className="flex justify-between items-start gap-4">
            <div>
              <span className="text-xs font-mono bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded border border-cyan-500/20 uppercase">
                {activeTask.status} Task
              </span>
              <h3 className="text-lg font-bold text-white mt-1.5">{activeTask.title}</h3>
              <p className="text-sm text-slate-400 mt-1">{activeTask.description}</p>
            </div>
            {activeTask.status === 'pending' && (
              <button
                onClick={() => onExecuteTask(activeTask.id)}
                className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-sm flex items-center gap-1.5 transition cursor-pointer"
              >
                <Play size={14} /> Execute Plan
              </button>
            )}
          </div>

          {/* Checklist progress */}
          {activeTask.steps && activeTask.steps.length > 0 && (
            <div className="mt-4 border-t border-white/5 pt-4 space-y-2">
              <p className="text-xs font-mono text-slate-500 uppercase tracking-widest mb-3">Plan execution checklist</p>
              {activeTask.steps.map((step, idx) => (
                <div key={step.id} className="flex items-center gap-3 text-sm">
                  {step.status === 'completed' ? (
                    <CheckCircle size={15} className="text-emerald-400" />
                  ) : step.status === 'running' ? (
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent border-cyan-400 animate-spin" />
                  ) : step.status === 'failed' ? (
                    <AlertCircle size={15} className="text-red-400" />
                  ) : (
                    <div className="w-3.5 h-3.5 rounded-full border border-slate-600" />
                  )}
                  <span
                    className={
                      step.status === 'completed'
                        ? 'text-slate-500 line-through'
                        : step.status === 'running'
                        ? 'text-cyan-400 font-medium'
                        : 'text-slate-300'
                    }
                  >
                    {idx + 1}. {step.title}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Activity Timeline log list */}
      <div className="glass-panel p-5 rounded-2xl">
        <h2 className="text-sm font-semibold text-slate-400 font-mono tracking-wider mb-4">LATEST SYSTEM ACTIVITY</h2>
        {logs.length === 0 ? (
          <p className="text-sm text-slate-500 font-mono">No actions logged in the system timeline yet.</p>
        ) : (
          <div className="space-y-4">
            {logs.slice(0, 5).map((log) => (
              <div key={log.id} className="flex gap-4 items-start text-sm">
                <span className="text-xs text-slate-600 font-mono mt-0.5">
                  {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        log.type === 'success'
                          ? 'bg-emerald-400'
                          : log.type === 'warning'
                          ? 'bg-amber-400'
                          : log.type === 'error'
                          ? 'bg-red-400'
                          : 'bg-cyan-400'
                      }`}
                    />
                    <span className="font-semibold text-slate-200">{log.message}</span>
                    <span className="text-xs bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono uppercase">
                      {log.category}
                    </span>
                  </div>
                  {log.details && <p className="text-xs text-slate-500 mt-1 font-mono">{log.details}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
