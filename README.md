# 🤖 FRIDAY AI Employee

> **Your Autonomous Voice-Enabled AI Assistant & Multi-Agent Workspace**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-v24.0+-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-v19.0-61dafb.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4+-blue.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.4+-646cff.svg)](https://vitejs.dev/)
[![SQLite](https://img.shields.io/badge/SQLite-3.0+-003b57.svg)](https://www.sqlite.org/)

---

## 🌟 Overview

**FRIDAY AI Employee** is an intelligent, full-stack autonomous AI workforce platform designed to automate productivity, coding, research, task management, system operations, and voice-assisted workflows. 

Equipped with **Voice Link** (continuous speech recognition, wake-word detection, and text-to-speech synthesis), **multi-agent orchestration**, and persistent **SQLite database memory**, FRIDAY acts as a complete virtual employee for your everyday workflow.

---

## ✨ Key Features

### 🎙️ 1. Voice Link & Speech Recognition
- **Continuous Speech Recognition**: Speak naturally to issue commands or dictate notes in real-time.
- **Wake Word Support**: Native listener for *"Hey Friday"*.
- **Speech Synthesis**: Integrated text-to-speech feedback.
- **Voice Dictation**: Hands-free voice note creation with continuous transcript appending.

### 🧠 2. Specialist Multi-Agent Architecture
FRIDAY dynamically routes prompts to specialized AI agents tailored to specific tasks:
- **`ExecutiveAgent`**: High-level decision routing, general assistant, and workflow orchestration.
- **`ResearchAgent`**: Autonomous web searches, real-time info gathering, and synthesis.
- **`CodingAgent`**: Code analysis, file edits, debugging, and software engineering.
- **`ProductivityAgent`**: Multi-step action plan generation and interactive checklists.
- **`FileAgent`**: Workspace file indexing, document summaries, and file read/write tools.
- **`DataAgent`**: Math calculations, CSV metric processing, and report generation.
- **`AutomationAgent`**: Background cron-based automated schedules and event-driven tasks.
- **`SystemAgent`**: Desktop application launch (e.g. Notepad, Calculator) and URL routing.
- **`NotesAgent`**: Rich note management, tagging, categorization, and dictation.

### 📝 3. Comprehensive Notes & Memory Workspace
- **Category & Tag Organization**: Filter notes by categories (`Quick Notes`, `Ideas`, `Work`, `Personal`) and tags.
- **Persistent Memory Store**: Store context, user preferences, and facts in SQLite for long-term recall.
- **Live Activity Logs**: Track background agent executions, system logs, and task status in real time.

### ⚡ 4. LLM Provider Flexibility
- **Google Gemini API**: Support for `gemini-1.5-flash` and `gemini-1.5-pro`.
- **Groq API**: High-speed inference with Groq models.
- **Dynamic Configuration**: Change active providers, models, and temperature via settings.

---

## 🛠️ Tech Stack

### **Frontend**
- **Framework**: React 19 + Vite
- **Language**: TypeScript
- **Styling**: Vanilla CSS + TailwindCSS v4
- **Icons & Effects**: Lucide React, Canvas Confetti

### **Backend**
- **Runtime**: Node.js + Express
- **Language**: TypeScript (`ts-node`, `nodemon`)
- **Database**: SQLite3 (`sqlite` & `sqlite3`)
- **AI Integrations**: `@google/generative-ai`, Groq API
- **Utilities**: `ws` (WebSockets), `node-cron` (Automations), `bcryptjs`, `jsonwebtoken`

---

## 🚀 Quick Start Guide

### Prerequisites
- **Node.js**: v18.0 or higher (v24 recommended)
- **NPM**: v9.0 or higher

### 1. Clone the Repository
```bash
git clone https://github.com/Blackdevil1234567/Friday-AI-employe.git
cd Friday-AI-employe
```

### 2. Install Dependencies
Install dependencies across all root, backend, and frontend packages with one command:
```bash
npm run install:all
```

### 3. Environment Setup
Create a `.env` file in the root directory (or copy `.env.example`):
```env
PORT=5000
JWT_SECRET=your_jwt_secret_key_here
GEMINI_API_KEY=your_gemini_api_key_here
GROQ_API_KEY=your_groq_api_key_here
```

### 4. Run the Application

#### Option A: One-Click Startup Script (Windows)
Double-click `start.bat` or run in terminal:
```cmd
start.bat
```

#### Option B: NPM Concurrent Script
```bash
npm run dev
```

- **Frontend Interface**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:5000](http://localhost:5000)

---

## 📁 Repository Structure

```
Friday-AI-employe/
├── backend/
│   ├── src/
│   │   ├── agents/        # Agent definitions & routing engine
│   │   ├── providers/     # LLM provider abstractions (Gemini, Groq)
│   │   ├── tools/         # Web search, file manager, notes, tasks, system apps
│   │   ├── db.ts          # SQLite database schema & seed configuration
│   │   └── server.ts      # Express backend server & API endpoints
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── assets/        # Icons & visuals
│   │   ├── pages/         # DashboardPage, NotesPage, etc.
│   │   ├── services/      # Axios/Fetch API client
│   │   ├── App.tsx        # Main application component & routes
│   │   └── main.tsx
│   ├── index.html
│   ├── package.json
│   └── vite.config.ts
├── .env.example
├── .gitignore
├── start.bat
├── package.json
└── README.md
```

---

## 🔒 Security & Privacy

- **Local Storage**: All SQLite data, memories, notes, and activity logs remain local on your machine.
- **Environment Isolation**: API keys are loaded strictly from environment variables and local database settings, keeping secrets safe from exposure.

---

## 📜 License

This project is licensed under the **MIT License**.

---

<p center="true">
  Made with ❤️ by <a href="https://github.com/Blackdevil1234567">Blackdevil1234567</a>
</p>
