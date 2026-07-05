import { useCallback, useEffect, useRef, useState } from 'react'

// ─── Constants ───────────────────────────────────────────────────────────────
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

const OLLAMA_MODELS = ['llama3', 'llama3.1', 'mistral', 'codellama', 'phi3', 'gemma2', 'qwen2']

const DEFAULT_SETTINGS = {
  provider: 'grok',
  ollamaModel: 'llama3',
  temperature: 0.7,
  topP: 0.9,
  maxTokens: 800,
  stream: false,
  systemPrompt: 'You are a helpful, knowledgeable, and friendly AI assistant. Provide clear, accurate, and thoughtful responses.',
}

const WELCOME_PROMPTS = [
  '✨ Explain quantum computing simply',
  '🚀 Help me write a cover letter',
  '🧠 What is machine learning?',
  '💡 Give me a creative app idea',
]

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getInitials(name, email) {
  if (name) return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
  return (email?.[0] || 'U').toUpperCase()
}

function genId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function historyKey(email) {
  return `nova-history-${email}`
}

function settingsKey(email) {
  return `nova-settings-${email}`
}

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.message || 'Request failed')
  return data
}

/** Very simple markdown renderer — bold, inline code, code blocks */
function renderMarkdown(text) {
  // Escape HTML first
  const esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  // Code blocks (```...```)
  let rendered = esc.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) =>
    `<pre><code class="lang-${lang}">${code.trim()}</code></pre>`)

  // Inline code
  rendered = rendered.replace(/`([^`]+)`/g, '<code>$1</code>')

  // Bold
  rendered = rendered.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  rendered = rendered.replace(/__([^_]+)__/g, '<strong>$1</strong>')

  // Italic
  rendered = rendered.replace(/\*([^*]+)\*/g, '<em>$1</em>')
  rendered = rendered.replace(/_([^_]+)_/g, '<em>$1</em>')

  // Line breaks
  rendered = rendered.replace(/\n/g, '<br />')

  return rendered
}

// ─── File parsing ─────────────────────────────────────────────────────────────
async function extractFileText(file) {
  const name = file.name.toLowerCase()

  if (name.endsWith('.pdf')) {
    // Use PDF.js via CDN (loaded lazily)
    try {
      const pdfjsLib = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.min.mjs')
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs'

      const arrayBuffer = await file.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
      const textParts = []
      for (let i = 1; i <= Math.min(pdf.numPages, 20); i++) {
        const page = await pdf.getPage(i)
        const content = await page.getTextContent()
        textParts.push(content.items.map(item => item.str).join(' '))
      }
      return textParts.join('\n')
    } catch {
      return '[PDF could not be parsed — please copy-paste the text instead]'
    }
  }

  // Plain text / markdown
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => resolve(e.target.result)
    reader.onerror = reject
    reader.readAsText(file)
  })
}

// ─── ChatApp ─────────────────────────────────────────────────────────────────
export function ChatApp() {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const [view, setView] = useState('login') // 'login' | 'signup' | 'chat'
  const [currentUser, setCurrentUser] = useState(null)
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' })
  const [authMsg, setAuthMsg] = useState('')

  // ── Settings ────────────────────────────────────────────────────────────────
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)

  // ── Provider status ──────────────────────────────────────────────────────────
  const [providerStatus, setProviderStatus] = useState({ ok: true, message: '' })

  // ── Chat sessions / history ─────────────────────────────────────────────────
  const [sessions, setSessions] = useState([])        // [{id, title, messages, createdAt}]
  const [activeSessionId, setActiveSessionId] = useState(null)

  // Derived: current messages
  const activeSession = sessions.find(s => s.id === activeSessionId) || null
  const messages = activeSession?.messages || []

  // ── UI states ────────────────────────────────────────────────────────────────
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(true) // mobile toggle

  // ── File upload ──────────────────────────────────────────────────────────────
  const [attachedFile, setAttachedFile] = useState(null)   // {name, text}
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef(null)

  // ── Voice ────────────────────────────────────────────────────────────────────
  const [isRecording, setIsRecording] = useState(false)
  const [voiceTranscript, setVoiceTranscript] = useState('')
  const recognitionRef = useRef(null)

  // ── Text-to-Speech ───────────────────────────────────────────────────────────
  const [speakingMessageId, setSpeakingMessageId] = useState(null)
  const speechSynthRef = useRef(null)

  // ── Refs ─────────────────────────────────────────────────────────────────────
  const messagesEndRef = useRef(null)
  const textareaRef = useRef(null)

  // ─── Persist / restore history ──────────────────────────────────────────────
  useEffect(() => {
    if (!currentUser?.email) return
    const raw = localStorage.getItem(historyKey(currentUser.email))
    if (raw) {
      try {
        const saved = JSON.parse(raw)
        setSessions(saved)
        if (saved.length > 0) setActiveSessionId(saved[0].id)
      } catch { /* ignore */ }
    } else {
      // Start with a blank session
      startNewSession()
    }

    // Restore settings
    const rawSettings = localStorage.getItem(settingsKey(currentUser.email))
    if (rawSettings) {
      try { setSettings(s => ({ ...s, ...JSON.parse(rawSettings) })) } catch { /* ignore */ }
    }
  }, [currentUser])

  function persistSessions(nextSessions) {
    if (!currentUser?.email) return
    localStorage.setItem(historyKey(currentUser.email), JSON.stringify(nextSessions))
  }

  function persistSettings(nextSettings) {
    if (!currentUser?.email) return
    localStorage.setItem(settingsKey(currentUser.email), JSON.stringify(nextSettings))
  }

  // ─── Provider status check ───────────────────────────────────────────────────
  useEffect(() => {
    if (view !== 'chat') return
    const check = async () => {
      try {
        const data = await apiFetch(`/api/ai/status?provider=${settings.provider}`)
        setProviderStatus(data.data?.status || { ok: true, message: '' })
      } catch {
        setProviderStatus({ ok: false, message: 'Provider unreachable' })
      }
    }
    check()
  }, [settings.provider, view])

  // ─── Auto-scroll ─────────────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // ─── Restore session ──────────────────────────────────────────────────────────
  useEffect(() => {
    const restore = async () => {
      try {
        const data = await apiFetch('/api/auth/me')
        if (data.data?.user) {
          setCurrentUser(data.data.user)
          setView('chat')
        }
      } catch {
        setCurrentUser(null)
        setView('login')
      }
    }
    restore()
  }, [])

  // ─── Textarea auto-resize ─────────────────────────────────────────────────────
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px'
  }, [input])

  // ─── Session helpers ──────────────────────────────────────────────────────────
  function startNewSession() {
    const session = {
      id: genId(),
      title: 'New chat',
      messages: [],
      createdAt: new Date().toISOString(),
    }
    setSessions(prev => {
      const next = [session, ...prev]
      persistSessions(next)
      return next
    })
    setActiveSessionId(session.id)
    setInput('')
    setAttachedFile(null)
    setError('')
  }

  function deleteSession(id) {
    setSessions(prev => {
      const next = prev.filter(s => s.id !== id)
      persistSessions(next)
      if (activeSessionId === id) {
        if (next.length > 0) setActiveSessionId(next[0].id)
        else {
          // Create blank session
          const blank = { id: genId(), title: 'New chat', messages: [], createdAt: new Date().toISOString() }
          const withBlank = [blank, ...next]
          persistSessions(withBlank)
          setActiveSessionId(blank.id)
          return withBlank
        }
      }
      return next
    })
  }

  function updateSessionMessages(sessionId, msgs, title) {
    setSessions(prev => {
      const next = prev.map(s =>
        s.id === sessionId
          ? { ...s, messages: msgs, title: title || s.title }
          : s
      )
      persistSessions(next)
      return next
    })
  }

  // ─── Auth handlers ────────────────────────────────────────────────────────────
  const handleAuthChange = e => setAuthForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const handleLogin = async e => {
    e.preventDefault()
    setAuthMsg('')
    if (!authForm.email || !authForm.password) { setAuthMsg('Enter your email and password.'); return }
    try {
      const data = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: authForm.email, password: authForm.password }),
      })
      setCurrentUser(data.data?.user || null)
      setView('chat')
      setAuthForm({ name: '', email: '', password: '' })
    } catch (err) {
      setAuthMsg(err.message || 'Unable to sign in.')
    }
  }

  const handleSignup = async e => {
    e.preventDefault()
    setAuthMsg('')
    if (!authForm.name || !authForm.email || !authForm.password) { setAuthMsg('Please fill in all fields.'); return }
    try {
      const data = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name: authForm.name, email: authForm.email, password: authForm.password }),
      })
      setCurrentUser(data.data?.user || null)
      setView('chat')
      setAuthForm({ name: '', email: '', password: '' })
    } catch (err) {
      setAuthMsg(err.message || 'Unable to create account.')
    }
  }

  const handleLogout = async () => {
    try { await apiFetch('/api/auth/logout', { method: 'POST' }) } catch { /* ignore */ }
    setCurrentUser(null)
    setView('login')
    setSessions([])
    setActiveSessionId(null)
    setError('')
  }

  // ─── Settings ─────────────────────────────────────────────────────────────────
  const handleSettingChange = e => {
    const { name, value, type, checked } = e.target
    setSettings(prev => {
      const next = { ...prev, [name]: type === 'checkbox' ? checked : type === 'number' ? Number(value) : value }
      persistSettings(next)
      return next
    })
  }

  // ─── Send message ─────────────────────────────────────────────────────────────
  const sendMessage = async e => {
    e?.preventDefault()
    const trimmed = input.trim()
    if (!trimmed && !attachedFile) return
    if (!activeSessionId) return

    let userContent = trimmed
    let fileChip = null

    if (attachedFile) {
      fileChip = attachedFile.name
      userContent = attachedFile.text
        ? `[File: ${attachedFile.name}]\n\n${attachedFile.text}\n\n${trimmed}`
        : trimmed
    }

    const userMsg = {
      role: 'user',
      content: userContent,
      displayContent: trimmed || `[Attached: ${attachedFile?.name}]`,
      fileChip,
    }

    const prevMsgs = messages
    const nextMsgs = [...prevMsgs, userMsg]

    // Auto-title first message
    const isFirst = prevMsgs.length === 0
    const newTitle = isFirst ? (trimmed.slice(0, 50) || fileChip || 'New chat') : null

    updateSessionMessages(activeSessionId, nextMsgs, newTitle)
    setInput('')
    setAttachedFile(null)
    setLoading(true)
    setError('')

    try {
      const apiMessages = [
        { role: 'system', content: settings.systemPrompt },
        ...nextMsgs.map(m => ({ role: m.role, content: m.content })),
      ]

      const body = {
        provider: settings.provider,
        messages: apiMessages,
        temperature: settings.temperature,
        topP: settings.topP,
        maxTokens: settings.maxTokens,
        stream: settings.stream,
      }

      if (settings.provider === 'ollama') {
        body.model = settings.ollamaModel
      }

      const data = await apiFetch('/api/ai/chat', { method: 'POST', body: JSON.stringify(body) })
      const reply = data.data?.response?.content || 'No response received.'

      const assistantMsg = { role: 'assistant', content: reply }
      const finalMsgs = [...nextMsgs, assistantMsg]
      updateSessionMessages(activeSessionId, finalMsgs, null)
    } catch (err) {
      const msg = err.message || 'Unable to reach the AI backend.'
      setError(msg)
      const errorMsg = { role: 'assistant', content: msg, isError: true }
      updateSessionMessages(activeSessionId, [...nextMsgs, errorMsg], null)
    } finally {
      setLoading(false)
    }
  }

  // ─── Keyboard handler ─────────────────────────────────────────────────────────
  const handleKeyDown = e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // ─── File handling ────────────────────────────────────────────────────────────
  const handleFileSelect = useCallback(async file => {
    if (!file) return
    const maxMB = 5
    if (file.size > maxMB * 1024 * 1024) {
      setError(`File too large. Max size is ${maxMB}MB.`)
      return
    }
    try {
      const text = await extractFileText(file)
      setAttachedFile({ name: file.name, text: text?.slice(0, 12000) })
      setShowUploadModal(false)
    } catch {
      setError('Could not read file.')
    }
  }, [])

  const handleDropZone = e => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileSelect(file)
  }

  // ─── Voice input ──────────────────────────────────────────────────────────────
  const startRecording = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setError('Voice input is not supported in your browser. Please use Chrome or Edge.')
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = e => {
      const transcript = Array.from(e.results)
        .map(r => r[0].transcript)
        .join('')
      setVoiceTranscript(transcript)
    }

    recognition.onerror = () => {
      setIsRecording(false)
      setVoiceTranscript('')
    }

    recognition.onend = () => {
      setIsRecording(false)
    }

    recognition.start()
    recognitionRef.current = recognition
    setIsRecording(true)
    setVoiceTranscript('')
  }

  const stopRecording = () => {
    recognitionRef.current?.stop()
    setIsRecording(false)
    if (voiceTranscript.trim()) {
      setInput(prev => (prev ? prev + ' ' : '') + voiceTranscript.trim())
    }
    setVoiceTranscript('')
  }

  const cancelRecording = () => {
    recognitionRef.current?.stop()
    setIsRecording(false)
    setVoiceTranscript('')
  }

  // ─── Text-to-Speech handlers ───────────────────────────────────────────────────
  const speakMessage = (messageId, text) => {
    if (!('speechSynthesis' in window)) {
      setError('Speech is not supported in this browser.')
      return
    }

    // Stop any currently playing speech
    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.onend = () => setSpeakingMessageId(null)
    utterance.onerror = () => setSpeakingMessageId(null)

    window.speechSynthesis.speak(utterance)
    setSpeakingMessageId(messageId)
  }

  const stopSpeaking = () => {
    window.speechSynthesis.cancel()
    setSpeakingMessageId(null)
  }

  const toggleSpeech = (messageId, text) => {
    if (speakingMessageId === messageId) {
      stopSpeaking()
    } else {
      speakMessage(messageId, text)
    }
  }

  // Cleanup speech on unmount
  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel()
    }
  }, [])

  // ─── Provider label ───────────────────────────────────────────────────────────
  const providerLabel = {
    sarvam: 'Sarvam AI',
    grok: 'Grok / Groq',
    ollama: `Ollama · ${settings.ollamaModel}`,
  }[settings.provider] || settings.provider

  const userInitials = getInitials(currentUser?.name, currentUser?.email)

  // ══════════════════════════════════════════════════════════════════════════════
  // RENDER — Auth
  // ══════════════════════════════════════════════════════════════════════════════
  if (!currentUser && view !== 'chat') {
    const isSignup = view === 'signup'
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-logo">
            <div className="auth-logo-mark">✦</div>
            <span className="auth-logo-text">Nova AI</span>
          </div>

          <h2>{isSignup ? 'Create your account' : 'Welcome back'}</h2>
          <p>{isSignup ? 'Join Nova and start chatting in seconds.' : 'Sign in to pick up where you left off.'}</p>

          <form className="auth-form" onSubmit={isSignup ? handleSignup : handleLogin}>
            {isSignup && (
              <label className="field-label">
                <span>Full name</span>
                <input type="text" name="name" value={authForm.name} onChange={handleAuthChange} placeholder="Alex Morgan" />
              </label>
            )}
            <label className="field-label">
              <span>Email</span>
              <input type="email" name="email" value={authForm.email} onChange={handleAuthChange} placeholder="you@example.com" />
            </label>
            <label className="field-label">
              <span>Password</span>
              <input type="password" name="password" value={authForm.password} onChange={handleAuthChange} placeholder="Min 8 characters" />
            </label>

            {authMsg && <div className="auth-message">{authMsg}</div>}

            <button type="submit" className="auth-btn">
              {isSignup ? 'Create account' : 'Sign in'}
            </button>
          </form>

          <div className="auth-switch">
            {isSignup ? 'Already have an account?' : "Don't have an account?"}
            <button type="button" onClick={() => { setView(isSignup ? 'login' : 'signup'); setAuthMsg('') }}>
              {isSignup ? 'Sign in' : 'Sign up'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // RENDER — Chat
  // ══════════════════════════════════════════════════════════════════════════════
  return (
    <div className="app-shell">

      {/* ── SIDEBAR ── */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-top">
          <div className="sidebar-brand">
            <div className="sidebar-brand-mark">✦</div>
            <span className="sidebar-brand-name">Nova AI</span>
          </div>

          <button id="new-chat-btn" className="new-chat-btn" onClick={startNewSession}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            New chat
          </button>
        </div>

        {/* History */}
        <div className="sidebar-section">
          <div className="sidebar-section-label">Recent</div>
        </div>

        <div className="history-list">
          {sessions.length === 0 ? (
            <div className="history-empty">No chats yet</div>
          ) : sessions.map(s => (
            <div
              key={s.id}
              className={`history-item ${s.id === activeSessionId ? 'active' : ''}`}
              onClick={() => setActiveSessionId(s.id)}
              title={s.title}
              role="button"
              tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && setActiveSessionId(s.id)}
            >
              <svg className="history-item-icon" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
              </svg>
              <span className="history-item-title">{s.title}</span>
              <button
                className="history-item-delete"
                onClick={e => { e.stopPropagation(); deleteSession(s.id) }}
                title="Delete"
              >✕</button>
            </div>
          ))}
        </div>

        {/* Bottom */}
        <div className="sidebar-bottom">
          {/* Provider selector */}
          <div style={{ padding: '0 0.25rem', marginBottom: '0.25rem' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>AI Provider</div>
            <select
              value={settings.provider}
              onChange={e => handleSettingChange({ target: { name: 'provider', value: e.target.value, type: 'text' } })}
              style={{ width: '100%', padding: '0.45rem 0.7rem', background: '#2a2a2a', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: '0.85rem', cursor: 'pointer' }}
            >
              <option value="grok">🤖 Grok / Groq</option>
              <option value="sarvam">🧠 Sarvam AI</option>
              <option value="ollama">🦙 Ollama (Local)</option>
            </select>

            {settings.provider === 'ollama' && (
              <select
                value={settings.ollamaModel}
                onChange={e => handleSettingChange({ target: { name: 'ollamaModel', value: e.target.value, type: 'text' } })}
                style={{ width: '100%', marginTop: '0.35rem', padding: '0.45rem 0.7rem', background: '#2a2a2a', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: '0.85rem', cursor: 'pointer' }}
              >
                {OLLAMA_MODELS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            )}
          </div>


          <div className="sidebar-user">
            <div className="sidebar-user-avatar">{userInitials}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{currentUser?.name || 'User'}</div>
              <div className="sidebar-user-email">{currentUser?.email}</div>
            </div>
          </div>

          <button className="sidebar-action-btn danger" onClick={handleLogout}>
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
            </svg>
            Sign out
          </button>
        </div>
      </aside>

      {/* ── MAIN CHAT ── */}
      <main className="chat-main">

        {/* Top bar */}
        <div className="chat-topbar">
          <div className="chat-topbar-left">
            {/* Mobile menu toggle */}
            <button
              className="icon-btn"
              onClick={() => setSidebarOpen(s => !s)}
              style={{ display: 'none' }}
              id="sidebar-toggle"
            >☰</button>

            <span className="chat-topbar-title">
              {activeSession?.title || 'Nova AI'}
            </span>

            <div className={`provider-badge ${providerStatus.ok ? '' : 'offline'}`}>
              {providerLabel} · {providerStatus.ok ? 'Online' : 'Offline'}
            </div>
          </div>

          <div className="topbar-right">
            <button
              className="icon-btn"
              onClick={startNewSession}
              title="New chat"
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M12 5v14M5 12h14"/>
              </svg>
            </button>
          </div>
        </div>


        {/* Messages */}
        <div className="messages-area">
          <div className="messages-inner">

            {/* Welcome screen */}
            {messages.length === 0 && !loading && (
              <div className="welcome-screen">
                <div className="welcome-logo">✦</div>
                <h2>How can I help you?</h2>
                <p>Ask me anything — I'll do my best to assist.</p>
                <div className="welcome-prompts">
                  {WELCOME_PROMPTS.map(p => (
                    <button
                      key={p}
                      className="welcome-prompt-btn"
                      onClick={() => setInput(p.replace(/^[\w\s]+ /, ''))}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Message list */}
            {messages.map((msg, i) => (
              <div key={i} className={`message-row ${msg.role}`}>
                <div className="msg-avatar">
                  {msg.role === 'assistant' ? '✦' : userInitials}
                </div>
                <div className="msg-content">
                  <div className="msg-sender">
                    {msg.role === 'assistant' ? 'Nova' : 'You'}
                  </div>
                  <div className="msg-bubble">
                    {msg.fileChip && (
                      <div className="msg-file-chip">
                        📎 {msg.fileChip}
                      </div>
                    )}
                    {msg.role === 'assistant' ? (
                      <div
                        className="msg-text"
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                      />
                    ) : (
                      <div className="msg-text">
                        {msg.displayContent || msg.content}
                      </div>
                    )}
                    {msg.role === 'assistant' && (
                      <button
                        className="msg-speak-btn"
                        onClick={() => toggleSpeech(i, msg.content)}
                        title={speakingMessageId === i ? 'Stop reading' : 'Read aloud'}
                      >
                        {speakingMessageId === i ? (
                          <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                            <rect x="6" y="6" width="12" height="12" rx="2"/>
                          </svg>
                        ) : (
                          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path d="M11 5L6 9H2v6h4l5 4V5z"/>
                            <path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/>
                          </svg>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {loading && (
              <div className="typing-row">
                <div className="msg-avatar" style={{ background: 'var(--accent)', color: 'white', borderRadius: '50%', width: 36, height: 36, display: 'grid', placeItems: 'center', fontSize: '0.9rem', fontWeight: 700, flexShrink: 0 }}>✦</div>
                <div className="typing-indicator">
                  <div className="typing-dot" />
                  <div className="typing-dot" />
                  <div className="typing-dot" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Error strip */}
        {error && (
          <div className="input-bar-wrap" style={{ paddingBottom: 0 }}>
            <div className="input-bar-inner">
              <div className="error-strip">⚠️ {error} <button onClick={() => setError('')} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', marginLeft: '0.5rem', opacity: 0.7 }}>✕</button></div>
            </div>
          </div>
        )}

        {/* Input bar */}
        <div className="input-bar-wrap">
          <div className="input-bar-inner">

            {/* Attached file chip */}
            {attachedFile && (
              <div className="attached-file">
                <span>📎</span>
                <span className="attached-file-name">{attachedFile.name}</span>
                <button className="attached-file-remove" onClick={() => setAttachedFile(null)} title="Remove">✕</button>
              </div>
            )}

            <div className="composer-box">
              <textarea
                ref={textareaRef}
                className="composer-textarea"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Message Nova… (Shift+Enter for new line)"
                disabled={loading}
                rows={1}
              />

              <div className="composer-actions">
                <div className="composer-actions-left">
                  {/* File upload button */}
                  <button
                    type="button"
                    className="composer-tool-btn"
                    onClick={() => setShowUploadModal(true)}
                    title="Attach file"
                    disabled={loading}
                  >
                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
                    </svg>
                  </button>

                  {/* Voice input button */}
                  <button
                    type="button"
                    className={`composer-tool-btn ${isRecording ? 'recording' : ''}`}
                    onClick={isRecording ? stopRecording : startRecording}
                    title={isRecording ? 'Stop recording' : 'Voice input'}
                    disabled={loading}
                  >
                    {isRecording ? (
                      <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
                        <rect x="6" y="6" width="12" height="12" rx="2"/>
                      </svg>
                    ) : (
                      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                        <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
                        <path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"/>
                      </svg>
                    )}
                  </button>
                </div>

                <div className="composer-actions-right">
                  {/* Send button */}
                  <button
                    type="button"
                    className="send-btn"
                    onClick={sendMessage}
                    disabled={loading || (!input.trim() && !attachedFile)}
                    title="Send message"
                    id="send-btn"
                  >
                    {loading ? (
                      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ animation: 'spin 1s linear infinite' }}>
                        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                      </svg>
                    ) : (
                      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <p className="composer-hint">
              Press Enter to send · Shift+Enter for new line · Powered by {providerLabel}
            </p>
          </div>
        </div>
      </main>

      {/* ── VOICE OVERLAY ── */}
      {isRecording && (
        <div className="voice-overlay">
          <div className="voice-ring">
            <button className="voice-mic-btn" onClick={stopRecording} title="Stop and use transcript">
              🎙️
            </button>
          </div>
          <div className="voice-label">Listening…</div>
          {voiceTranscript && (
            <div className="voice-transcript">"{voiceTranscript}"</div>
          )}
          <button className="voice-cancel-btn" onClick={cancelRecording}>
            Cancel
          </button>
        </div>
      )}

      {/* ── UPLOAD MODAL ── */}
      {showUploadModal && (
        <div className="upload-modal-overlay" onClick={() => setShowUploadModal(false)}>
          <div className="upload-modal" onClick={e => e.stopPropagation()}>
            <div className="upload-modal-header">
              <span className="upload-modal-title">📎 Attach a file</span>
              <button className="upload-modal-close" onClick={() => setShowUploadModal(false)}>✕</button>
            </div>

            <div
              className={`drop-zone ${dragOver ? 'drag-over' : ''}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDropZone}
            >
              <div className="drop-zone-icon">📄</div>
              <div className="drop-zone-label">Click to browse or drag &amp; drop</div>
              <div className="drop-zone-hint">Supported formats: .txt, .md, .pdf (max 5MB)</div>
            </div>

            <div className="upload-modal-types">
              {['.txt', '.md', '.pdf'].map(t => (
                <span key={t} className="type-chip">{t}</span>
              ))}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.pdf,.jpg,.jpeg,.png,.gif,.webp"
              className="hidden-file-input"
              onChange={e => handleFileSelect(e.target.files?.[0])}
            />
          </div>
        </div>
      )}
    </div>
  )
}
