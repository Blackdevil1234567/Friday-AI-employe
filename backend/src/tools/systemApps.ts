import { exec, spawn } from 'child_process';
import path from 'path';

export interface AppShortcut {
  id: string;
  name: string;
  command: string;
  category: 'system' | 'browser' | 'editor' | 'utility' | 'office';
  icon: string;
  description: string;
}

export const SUPPORTED_APPS: AppShortcut[] = [
  {
    id: 'notepad',
    name: 'Notepad',
    command: 'start "" notepad.exe',
    category: 'editor',
    icon: 'FileText',
    description: 'Windows Text Editor'
  },
  {
    id: 'calc',
    name: 'Calculator',
    command: 'start "" calc.exe',
    category: 'utility',
    icon: 'Calculator',
    description: 'System Calculator'
  },
  {
    id: 'chrome',
    name: 'Google Chrome',
    command: 'start "" chrome',
    category: 'browser',
    icon: 'Globe',
    description: 'Web Browser'
  },
  {
    id: 'edge',
    name: 'Microsoft Edge',
    command: 'start "" msedge',
    category: 'browser',
    icon: 'Globe',
    description: 'Edge Browser'
  },
  {
    id: 'code',
    name: 'VS Code',
    command: 'start "" code',
    category: 'editor',
    icon: 'Code',
    description: 'Visual Studio Code'
  },
  {
    id: 'explorer',
    name: 'File Explorer',
    command: 'start "" explorer.exe',
    category: 'system',
    icon: 'Folder',
    description: 'Windows File Explorer'
  },
  {
    id: 'cmd',
    name: 'Command Prompt',
    command: 'start "" cmd.exe',
    category: 'system',
    icon: 'Terminal',
    description: 'Windows Command Console'
  },
  {
    id: 'powershell',
    name: 'PowerShell',
    command: 'start "" powershell.exe',
    category: 'system',
    icon: 'Terminal',
    description: 'Windows PowerShell'
  },
  {
    id: 'mspaint',
    name: 'Paint',
    command: 'start "" mspaint.exe',
    category: 'utility',
    icon: 'Image',
    description: 'Paint Drawing App'
  },
  {
    id: 'spotify',
    name: 'Spotify',
    command: 'start "" spotify:',
    category: 'utility',
    icon: 'Music',
    description: 'Music Streaming App'
  },
  {
    id: 'word',
    name: 'Microsoft Word',
    command: 'start "" winword',
    category: 'office',
    icon: 'FileText',
    description: 'Word Processor'
  },
  {
    id: 'excel',
    name: 'Microsoft Excel',
    command: 'start "" excel',
    category: 'office',
    icon: 'Table',
    description: 'Spreadsheet App'
  }
];

export async function launchSystemApp(appOrCommand: string): Promise<{ success: boolean; appName: string; message: string }> {
  return new Promise((resolve) => {
    const inputLower = appOrCommand.trim().toLowerCase();
    
    // Check if matching predefined shortcut
    const foundApp = SUPPORTED_APPS.find(
      (a) => a.id === inputLower || a.name.toLowerCase() === inputLower || a.name.toLowerCase().includes(inputLower)
    );

    let cmdToRun = '';
    let appDisplayName = appOrCommand;

    if (foundApp) {
      cmdToRun = foundApp.command;
      appDisplayName = foundApp.name;
    } else if (inputLower.startsWith('http://') || inputLower.startsWith('https://')) {
      cmdToRun = `start "" "${appOrCommand.replace(/"/g, '')}"`;
      appDisplayName = `Web URL (${appOrCommand})`;
    } else {
      // Fallback custom command execution
      cmdToRun = inputLower.startsWith('start ') ? appOrCommand : `start "" "${appOrCommand.replace(/"/g, '')}"`;
      appDisplayName = appOrCommand;
    }

    console.log(`[SYSTEM LAUNCHER] Executing command: "${cmdToRun}"`);

    // Execute via Windows shell
    exec(cmdToRun, { windowsHide: true }, (error) => {
      if (error) {
        console.warn(`[SYSTEM LAUNCHER] First attempt failed for "${cmdToRun}", trying fallback direct launch:`, error.message);
        // Fallback try simple exec without 'start'
        exec(appOrCommand, (err2) => {
          if (err2) {
            console.error(`[SYSTEM LAUNCHER] Fallback failed for "${appOrCommand}":`, err2.message);
            resolve({
              success: false,
              appName: appDisplayName,
              message: `Could not launch "${appDisplayName}": ${err2.message}`
            });
          } else {
            resolve({
              success: true,
              appName: appDisplayName,
              message: `Successfully launched ${appDisplayName}.`
            });
          }
        });
      } else {
        console.log(`[SYSTEM LAUNCHER] Launched successfully: ${appDisplayName}`);
        resolve({
          success: true,
          appName: appDisplayName,
          message: `Successfully launched ${appDisplayName}.`
        });
      }
    });
  });
}
