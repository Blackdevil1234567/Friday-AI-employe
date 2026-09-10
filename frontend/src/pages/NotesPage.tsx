import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, Plus, Search, Trash2, Edit3, Tag, Mic, Download, Copy, Check, X, Sparkles 
} from 'lucide-react';
import { api } from '../services/api';
import type { Note } from '../services/api';

interface NotesPageProps {
  onSpeak?: (text: string) => void;
}

export const NotesPage: React.FC<NotesPageProps> = ({ onSpeak }) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modal State
  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [noteTitle, setNoteTitle] = useState<string>('');
  const [noteContent, setNoteContent] = useState<string>('');
  const [noteCategory, setNoteCategory] = useState<string>('Quick Notes');
  const [noteTags, setNoteTags] = useState<string>('');
  const [isDictating, setIsDictating] = useState<boolean>(false);
  const initialContentRef = useRef<string>('');

  const categories = ['all', 'Quick Notes', 'Work', 'Personal', 'AI Transcripts'];

  useEffect(() => {
    fetchNotes();
  }, [activeCategory, searchQuery]);

  const fetchNotes = async () => {
    setIsLoading(true);
    try {
      const data = await api.getNotes(activeCategory, searchQuery);
      setNotes(data);
    } catch (err) {
      console.error('Failed to fetch notes:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenNewModal = () => {
    setEditingNote(null);
    setNoteTitle('');
    setNoteContent('');
    setNoteCategory('Quick Notes');
    setNoteTags('');
    setShowModal(true);
  };

  const handleOpenEditModal = (note: Note) => {
    setEditingNote(note);
    setNoteTitle(note.title);
    setNoteContent(note.content);
    setNoteCategory(note.category || 'Quick Notes');
    setNoteTags(note.tags || '');
    setShowModal(true);
  };

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteTitle.trim() || !noteContent.trim()) return;

    try {
      if (editingNote) {
        await api.updateNote(editingNote.id, {
          title: noteTitle,
          content: noteContent,
          category: noteCategory,
          tags: noteTags
        });
        if (onSpeak) onSpeak(`Updated note "${noteTitle}".`);
      } else {
        await api.createNote({
          title: noteTitle,
          content: noteContent,
          category: noteCategory,
          tags: noteTags
        });
        if (onSpeak) onSpeak(`Created new note "${noteTitle}".`);
      }
      setShowModal(false);
      fetchNotes();
    } catch (err) {
      console.error('Failed to save note:', err);
    }
  };

  const handleDeleteNote = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete note "${title}"?`)) return;
    try {
      await api.deleteNote(id);
      fetchNotes();
      if (onSpeak) onSpeak(`Deleted note "${title}".`);
    } catch (err) {
      console.error('Failed to delete note:', err);
    }
  };

  const handleCopyNote = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExportNote = (note: Note) => {
    const element = document.createElement('a');
    const file = new Blob([`# ${note.title}\nCategory: ${note.category}\nTags: ${note.tags}\nDate: ${note.created_at}\n\n${note.content}`], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `${note.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const dictationRecRef = useRef<any>(null);

  const toggleVoiceDictation = () => {
    if (isDictating) {
      if (dictationRecRef.current) {
        try {
          dictationRecRef.current.stop();
        } catch (e) {}
      }
      setIsDictating(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser.');
      return;
    }

    initialContentRef.current = noteContent;

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';

    rec.onstart = () => setIsDictating(true);
    rec.onend = () => setIsDictating(false);
    rec.onerror = () => setIsDictating(false);

    rec.onresult = (event: any) => {
      let currentSpeech = '';
      for (let i = 0; i < event.results.length; ++i) {
        currentSpeech += event.results[i][0].transcript;
      }
      
      const cleanSpeech = currentSpeech.trim();
      const base = initialContentRef.current.trim();
      const updatedText = base ? base + ' ' + cleanSpeech : cleanSpeech;

      setNoteContent(updatedText);

      if (!noteTitle && cleanSpeech) {
        setNoteTitle(cleanSpeech.substring(0, 30) + (cleanSpeech.length > 30 ? '...' : ''));
      }
    };

    dictationRecRef.current = rec;
    rec.start();
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="glass-panel p-6 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <FileText className="text-cyan-400" size={28} />
            Smart Notes & Dictation
          </h1>
          <p className="text-slate-400 mt-1">
            Organize work notes, dictation transcripts, meeting summaries, and quick voice reminders.
          </p>
        </div>

        <button
          onClick={handleOpenNewModal}
          className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-5 py-2.5 rounded-xl text-sm flex items-center gap-2 shadow-lg shadow-cyan-500/20 transition cursor-pointer"
        >
          <Plus size={18} /> New Note
        </button>
      </div>

      {/* Search & Category Filter Toolbar */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
        {/* Category Pill Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2 rounded-xl text-xs font-mono tracking-wider transition whitespace-nowrap cursor-pointer ${
                activeCategory === cat
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 font-bold'
                  : 'bg-slate-900/60 text-slate-400 border border-white/5 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {cat === 'all' ? 'ALL NOTES' : cat.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3.5 top-2.5 text-slate-500" size={16} />
          <input
            type="text"
            placeholder="Search title, content, tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900/60 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
          />
        </div>
      </div>

      {/* Notes Grid Display */}
      {isLoading ? (
        <div className="text-center py-16 text-slate-500 font-mono">
          <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          Loading notes...
        </div>
      ) : notes.length === 0 ? (
        <div className="glass-panel p-12 rounded-2xl text-center space-y-4">
          <FileText size={48} className="mx-auto text-slate-600" />
          <div>
            <h3 className="text-lg font-bold text-slate-300">No notes found</h3>
            <p className="text-sm text-slate-500 mt-1">
              {searchQuery ? `No notes matching "${searchQuery}"` : 'Create your first note or ask FRIDAY "Take a note..."'}
            </p>
          </div>
          <button
            onClick={handleOpenNewModal}
            className="bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 px-4 py-2 rounded-xl text-sm inline-flex items-center gap-2 cursor-pointer transition"
          >
            <Plus size={16} /> Create Note
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {notes.map((note) => (
            <div
              key={note.id}
              className="glass-panel p-5 rounded-2xl space-y-4 flex flex-col justify-between border border-white/5 hover:border-cyan-500/30 transition-all duration-300 group"
            >
              <div className="space-y-2.5">
                <div className="flex justify-between items-start gap-2">
                  <span className="text-[10px] font-mono uppercase bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded border border-cyan-500/20">
                    {note.category || 'Quick Notes'}
                  </span>
                  <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition">
                    <button
                      onClick={() => handleCopyNote(note.id, note.content)}
                      title="Copy content"
                      className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-cyan-400 transition cursor-pointer"
                    >
                      {copiedId === note.id ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    </button>
                    <button
                      onClick={() => handleExportNote(note)}
                      title="Export text file"
                      className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-cyan-400 transition cursor-pointer"
                    >
                      <Download size={14} />
                    </button>
                    <button
                      onClick={() => handleOpenEditModal(note)}
                      title="Edit note"
                      className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-cyan-400 transition cursor-pointer"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      onClick={() => handleDeleteNote(note.id, note.title)}
                      title="Delete note"
                      className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-red-400 transition cursor-pointer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <h3 className="text-base font-bold text-white leading-snug line-clamp-1">{note.title}</h3>
                <p className="text-xs text-slate-300 whitespace-pre-wrap line-clamp-5 leading-relaxed bg-slate-950/40 p-3 rounded-xl border border-white/5">
                  {note.content}
                </p>
              </div>

              <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-slate-500">
                <div className="flex items-center gap-1">
                  {note.tags && (
                    <span className="flex items-center gap-1 text-slate-400 truncate max-w-[150px]">
                      <Tag size={11} className="text-cyan-400" />
                      {note.tags}
                    </span>
                  )}
                </div>
                <span>{new Date(note.updated_at || note.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New / Edit Note Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="glass-panel p-6 rounded-2xl max-w-xl w-full space-y-5 border border-cyan-500/30 relative animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Sparkles className="text-cyan-400" size={20} />
                {editingNote ? 'Edit Note' : 'Create New Note'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveNote} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">NOTE TITLE</label>
                <input
                  type="text"
                  required
                  placeholder="Enter title..."
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1">CATEGORY</label>
                  <select
                    value={noteCategory}
                    onChange={(e) => setNoteCategory(e.target.value)}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-400 cursor-pointer"
                  >
                    <option value="Quick Notes">Quick Notes</option>
                    <option value="Work">Work</option>
                    <option value="Personal">Personal</option>
                    <option value="AI Transcripts">AI Transcripts</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1">TAGS (COMMA SEPARATED)</label>
                  <input
                    type="text"
                    placeholder="meeting, urgent, ai"
                    value={noteTags}
                    onChange={(e) => setNoteTags(e.target.value)}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-mono text-slate-400">NOTE CONTENT</label>
                  <button
                    type="button"
                    onClick={toggleVoiceDictation}
                    className={`text-xs font-mono px-2.5 py-1 rounded-lg flex items-center gap-1 transition cursor-pointer ${
                      isDictating
                        ? 'bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse'
                        : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/20'
                    }`}
                  >
                    <Mic size={13} /> {isDictating ? 'Listening... (Click to stop)' : 'Voice Dictate'}
                  </button>
                </div>
                <textarea
                  required
                  rows={6}
                  placeholder="Type note content or use Voice Dictate..."
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl p-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400 resize-none font-sans leading-relaxed"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-400 hover:bg-white/5 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-5 py-2 rounded-xl text-sm transition cursor-pointer shadow-md shadow-cyan-500/20"
                >
                  {editingNote ? 'Save Changes' : 'Create Note'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
