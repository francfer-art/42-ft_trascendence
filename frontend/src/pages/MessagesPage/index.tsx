import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useUser } from '../../contexts/UserContext';
import styles from './MessagesPage.module.scss';
import defaultProfileImage from '../../assets/defaultProfile.webp';

type ChatUser = {
  id: number;
  login: string | null;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  image: string | null;
};

type ConversationListItem = {
  id: number;
  friend: ChatUser;
  lastMessage: {
    id: number;
    content: string;
    createdAt: string;
    sender: ChatUser;
  } | null;
  updatedAt: string;
  isOnline: boolean;
};

type MessageItem = {
  id: number;
  content: string;
  createdAt: string;
  sender: ChatUser;
};

type ConversationsResponse = { conversations: ConversationListItem[] };
type MessagesResponse = {
  conversation: { id: number; friend: ChatUser };
  messages: MessageItem[];
};

const getImageUrl = (image?: string | null): string => {
  if (!image) return defaultProfileImage;
  if (image.startsWith('http')) return image;
  return `/api${image}`;
};

const friendName = (u: ChatUser) =>
  u.displayName ?? u.login ?? 'Unknown';

export function MessagesPage() {
  const { conversationId } = useParams<{ conversationId?: string }>();
  const navigate = useNavigate();
  const { socket, user, unreadConvIds, markConvRead } = useUser();

  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(
    conversationId ? Number(conversationId) : null,
  );
  const [messageText, setMessageText] = useState('');
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const selectedConversation = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId],
  );

  // ── data loaders ──────────────────────────────────────────────────────────

  const loadConversations = async () => {
    try {
      setLoadingConvs(true);
      const res = await fetch('/api/conversations', { credentials: 'include' });
      if (!res.ok) { setConversations([]); return; }
      const data = (await res.json()) as ConversationsResponse;
      setConversations(data.conversations ?? []);

      if (!selectedId && data.conversations?.length) {
        const first = data.conversations[0].id;
        setSelectedId(first);
        navigate(`/messages/${first}`, { replace: true });
      }
    } catch {
      setConversations([]);
    } finally {
      setLoadingConvs(false);
    }
  };

  const loadMessages = async (convId: number) => {
    try {
      setLoadingMsgs(true);
      const res = await fetch(`/api/conversations/${convId}/messages`, {
        credentials: 'include',
      });
      if (!res.ok) { setMessages([]); return; }
      const data = (await res.json()) as MessagesResponse;
      setMessages(data.messages ?? []);
    } catch {
      setMessages([]);
    } finally {
      setLoadingMsgs(false);
    }
  };

  // ── effects ───────────────────────────────────────────────────────────────

  useEffect(() => {
    void loadConversations();
  }, []);

  useEffect(() => {
    if (conversationId) {
      const n = Number(conversationId);
      if (!Number.isNaN(n)) setSelectedId(n);
    }
  }, [conversationId]);

  useEffect(() => {
    if (!selectedId) { setMessages([]); return; }
    void loadMessages(selectedId);
    markConvRead(selectedId);
  }, [selectedId]);

  // scroll to bottom whenever messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // incoming message socket
  useEffect(() => {
    if (!socket || !selectedId) return;

    const handleIncoming = ({
      conversationId: incomingId,
      message,
    }: { conversationId: number; message: MessageItem }) => {
      void loadConversations();
      if (incomingId !== selectedId) return;
      setMessages((prev) => {
        if (prev.some((m) => m.id === message.id)) return prev;
        return [...prev, message];
      });
    };

    socket.on('social.message.received', handleIncoming);
    return () => { socket.off('social.message.received', handleIncoming); };
  }, [socket, selectedId]);

  // presence socket
  useEffect(() => {
    if (!socket) return;

    const handlePresence = ({ userId, status }: { userId: number; status: 'online' | 'offline' }) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.friend.id === userId ? { ...c, isOnline: status === 'online' } : c,
        ),
      );
    };

    socket.on('social.presence.changed', handlePresence);
    return () => { socket.off('social.presence.changed', handlePresence); };
  }, [socket]);

  // ── actions ───────────────────────────────────────────────────────────────

  const handleSelectConversation = (id: number) => {
    setSelectedId(id);
    navigate(`/messages/${id}`);
    markConvRead(id);
  };

  const handleSendMessage = async () => {
    if (!selectedId || !messageText.trim()) return;

    try {
      const res = await fetch(`/api/conversations/${selectedId}/messages`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: messageText.trim() }),
      });
      if (!res.ok) return;
      const data = await res.json();
      setMessages((prev) => [...prev, data.message]);
      setMessageText('');
      void loadConversations();
    } catch {
      // silent
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSendMessage();
    }
  };

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className={styles.page}>
      {/* ── sidebar ── */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarTop}>
          <button type="button" className={styles.back} onClick={() => navigate('/home')}>
            ← Back
          </button>
          <h2 className={styles.sidebarTitle}>Messages</h2>
        </div>

        <div className={styles.convList}>
          {loadingConvs ? (
            <p className={styles.hint}>Loading…</p>
          ) : conversations.length === 0 ? (
            <p className={styles.hint}>No conversations yet.</p>
          ) : (
            conversations.map((conv) => {
              const name = friendName(conv.friend);
              const isActive = conv.id === selectedId;
              const preview = conv.lastMessage?.content ?? 'No messages yet';

              const hasUnread = unreadConvIds.has(conv.id);

              return (
                <button
                  key={conv.id}
                  type="button"
                  className={`${styles.convItem} ${isActive ? styles.convItemActive : ''} ${hasUnread ? styles.convItemUnread : ''}`}
                  onClick={() => handleSelectConversation(conv.id)}
                >
                  <div className={styles.convAvatar}>
                    <img
                      src={getImageUrl(conv.friend.image)}
                      alt={name}
                      className={styles.convAvatarImg}
                    />
                    <span
                      className={`${styles.onlineDot} ${conv.isOnline ? styles.dotOnline : styles.dotOffline}`}
                    />
                  </div>

                  <div className={styles.convMeta}>
                    <span className={`${styles.convName} ${hasUnread ? styles.convNameUnread : ''}`}>{name}</span>
                    <span className={styles.convPreview}>{preview}</span>
                  </div>

                  {hasUnread && <span className={styles.unreadDot} aria-label="Unread messages" />}
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* ── chat pane ── */}
      <section className={styles.chatPane}>
        {selectedConversation ? (
          <>
            {/* header */}
            <header className={styles.chatHeader}>
              <div className={styles.chatHeaderAvatar}>
                <img
                  src={getImageUrl(selectedConversation.friend.image)}
                  alt={friendName(selectedConversation.friend)}
                  className={styles.convAvatarImg}
                />
                <span
                  className={`${styles.onlineDot} ${selectedConversation.isOnline ? styles.dotOnline : styles.dotOffline}`}
                />
              </div>
              <div>
                <p className={styles.chatHeaderName}>
                  {friendName(selectedConversation.friend)}
                </p>
                <p className={styles.chatHeaderStatus}>
                  {selectedConversation.isOnline ? 'Online' : 'Offline'}
                </p>
              </div>
            </header>

            {/* messages */}
            <div className={styles.messagesList}>
              {loadingMsgs ? (
                <p className={styles.hint}>Loading messages…</p>
              ) : messages.length === 0 ? (
                <p className={styles.hint}>No messages yet. Say hello!</p>
              ) : (
                messages.map((msg) => {
                  const isMine = msg.sender.id === user?.id;
                  const time = new Date(msg.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <div
                      key={msg.id}
                      className={`${styles.bubble} ${isMine ? styles.bubbleMine : styles.bubbleTheirs}`}
                    >
                      <p className={styles.bubbleText}>{msg.content}</p>
                      <span className={styles.bubbleTime}>{time}</span>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* composer */}
            <div className={styles.composer}>
              <textarea
                ref={textareaRef}
                className={styles.composerInput}
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Write a message… (Enter to send)"
                rows={1}
              />
              <button
                type="button"
                className={styles.composerSend}
                onClick={() => void handleSendMessage()}
                disabled={!messageText.trim()}
                aria-label="Send message"
              >
                ↑
              </button>
            </div>
          </>
        ) : (
          <div className={styles.emptyChat}>
            <span className={styles.emptyChatIcon}>✦</span>
            <p>Select a conversation to start chatting</p>
          </div>
        )}
      </section>
    </div>
  );
}
