'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DashboardSidebar, DashboardIcon } from '../../components/DreamDashboard';
import styles from '../Chat.module.css';

const apiBase = process.env.NEXT_PUBLIC_API_URL || '';

function getSessionId() {
  const key = 'lp-chat-session';
  try {
    let id = localStorage.getItem(key);
    if (id && id.length >= 8) return id;
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const starters = ['Hey, how are you?', 'Tell me about yourself', 'What are you up to?', 'I like your vibe'];

export default function ConversationClient({ slug }) {
  const [character, setCharacter] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const sessionId = useRef('');

  useEffect(() => { sessionId.current = getSessionId(); }, []);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const charRes = await fetch(`${apiBase}/api/chat/characters/${slug}`, { signal: controller.signal });
        if (!charRes.ok) { setNotice('Character not found.'); setLoading(false); return; }
        const charData = await charRes.json();
        setCharacter(charData);

        const sid = sessionId.current;
        if (sid) {
          const histRes = await fetch(`${apiBase}/api/chat/history/${slug}?sessionId=${encodeURIComponent(sid)}`, { signal: controller.signal });
          if (histRes.ok) {
            const histData = await histRes.json();
            setMessages(histData.messages || []);
          }
        }
      } catch (err) {
        if (err.name !== 'AbortError') setNotice('Could not load chat.');
      }
      setLoading(false);
    })();
    return () => controller.abort();
  }, [slug]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(''), 3200);
    return () => clearTimeout(t);
  }, [notice]);

  const sendMessage = useCallback(async (text) => {
    const msg = (text || input).trim();
    if (!msg || sending || !character) return;
    setInput('');
    setSending(true);

    const userMsg = { role: 'user', content: msg, createdAt: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);

    try {
      const response = await fetch(`${apiBase}/api/chat/send/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, sessionId: sessionId.current }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to send message');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';
      const assistantMsg = { role: 'assistant', content: '', createdAt: new Date().toISOString() };
      setMessages(prev => [...prev, assistantMsg]);

      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (payload === '[DONE]') continue;
          try {
            const parsed = JSON.parse(payload);
            if (parsed.text) {
              assistantContent += parsed.text;
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { ...updated[updated.length - 1], content: assistantContent };
                return updated;
              });
            }
          } catch { /* skip malformed chunks */ }
        }
      }
    } catch (err) {
      setNotice(err.message || 'Failed to get response.');
      setMessages(prev => prev.filter(m => m.role !== 'assistant' || m.content));
    }
    setSending(false);
    textareaRef.current?.focus();
  }, [input, sending, character, slug]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const initials = character?.name?.split(' ').map(w => w[0]).join('') || '?';

  if (loading) {
    return (
      <div className={styles.dashboard}>
        <DashboardSidebar active="Chat" savedCount={0} mobileOpen={false} onClose={() => {}} onUnavailable={() => {}} />
        <main className={styles.main}>
          <div className={styles.backGlow} />
          <div className={styles.skeletonGrid}><div /><div /></div>
        </main>
      </div>
    );
  }

  if (!character) {
    return (
      <div className={styles.dashboard}>
        <DashboardSidebar active="Chat" savedCount={0} mobileOpen={false} onClose={() => {}} onUnavailable={() => {}} />
        <main className={styles.main}>
          <div className={styles.backGlow} />
          <section className={styles.empty}>
            <DashboardIcon name="message" size={28} />
            <h2>Character not found</h2>
            <p>This companion does not exist.</p>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className={styles.dashboard}>
      <DashboardSidebar active="Chat" savedCount={0} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} onUnavailable={setNotice} />
      <main className={styles.main}>
        <div className={styles.backGlow} />
        <header className={styles.mobileHeader}>
          <Link href="/chat" className={styles.brand}>
            <img className={styles.brandLogo} src="/7035402.svg" alt="LeakPorns" />
            <span>Leak<span>Porns</span></span>
          </Link>
          <button type="button" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
            <DashboardIcon name="menu" />
          </button>
        </header>

        <div className={styles.chatLayout}>
          <div className={styles.chatHeader}>
            <Link href="/chat" className={styles.chatBackBtn} aria-label="Back to companions">
              <DashboardIcon name="arrow" size={16} />
            </Link>
            {character.imageUrl ? (
              <img src={character.imageUrl} alt={character.name} />
            ) : (
              <div className={styles.chatHeaderFallback}>{initials}</div>
            )}
            <div className={styles.chatHeaderInfo}>
              <strong>{character.name}</strong>
              <small>Online now</small>
            </div>
          </div>

          <div className={styles.messagesArea}>
            {messages.length === 0 ? (
              <div className={styles.chatWelcome}>
                {character.imageUrl ? (
                  <img src={character.imageUrl} alt={character.name} style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '3px solid rgba(124,92,252,.4)' }} />
                ) : (
                  <div className={styles.chatHeaderFallback} style={{ width: 80, height: 80, fontSize: 24 }}>{initials}</div>
                )}
                <h2>{character.name}</h2>
                <p>{character.tagline}</p>
                <div className={styles.chatStarters}>
                  {starters.map(s => (
                    <button key={s} type="button" onClick={() => sendMessage(s)}>{s}</button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div key={i} className={`${styles.msgRow} ${msg.role === 'user' ? styles.msgRowUser : ''}`}>
                  {msg.role === 'assistant' && (
                    character.imageUrl ? (
                      <img className={styles.msgAvatar} src={character.imageUrl} alt="" />
                    ) : (
                      <div className={styles.msgAvatarFallback}>{initials}</div>
                    )
                  )}
                  <div>
                    <div className={`${styles.msgBubble} ${msg.role === 'user' ? styles.msgBubbleUser : styles.msgBubbleAssistant}`}>
                      {msg.content}
                    </div>
                    {msg.createdAt && <span className={styles.msgTime}>{formatTime(msg.createdAt)}</span>}
                  </div>
                </div>
              ))
            )}
            {sending && messages[messages.length - 1]?.role !== 'assistant' && (
              <div className={styles.msgRow}>
                <div className={styles.msgAvatarFallback}>{initials}</div>
                <div className={styles.typingIndicator}>
                  <span className={styles.typingDot} />
                  <span className={styles.typingDot} />
                  <span className={styles.typingDot} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className={styles.chatInputArea}>
            <textarea
              ref={textareaRef}
              className={styles.chatInput}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Message ${character.name}...`}
              rows={1}
              disabled={sending}
            />
            <button
              type="button"
              className={styles.chatSendBtn}
              onClick={() => sendMessage()}
              disabled={!input.trim() || sending}
              aria-label="Send message"
            >
              <DashboardIcon name="arrow" size={18} />
            </button>
          </div>
        </div>
      </main>

      <nav className={styles.bottomNav}>
        <Link href="/discover"><DashboardIcon name="compass" /><span>Home</span></Link>
        <Link href="/creators"><DashboardIcon name="grid" /><span>Explore</span></Link>
        <Link href="/studio"><DashboardIcon name="wand" /><span>Studio</span></Link>
        <Link href="/chat" className={styles.bottomActive}><DashboardIcon name="message" /><span>Chat</span></Link>
        <Link href="/auth/sign-in"><DashboardIcon name="user" /><span>Profile</span></Link>
      </nav>

      {notice && <div className={styles.toast} role="status"><DashboardIcon name="info" size={16} />{notice}</div>}
    </div>
  );
}
