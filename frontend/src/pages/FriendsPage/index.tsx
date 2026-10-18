import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../../contexts/UserContext';
import { useToast } from '../../contexts/ToastContext';
import styles from './FriendsPage.module.scss';
import defaultProfileImage from '../../assets/defaultProfile.webp';

type FriendUser = {
  id: number;
  login: string | null;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  image: string | null;
};

type FriendItem = {
  friendshipId: number;
  friend: FriendUser;
  isOnline: boolean;
};

const getImageUrl = (image?: string | null): string => {
  if (!image) return defaultProfileImage;
  if (image.startsWith('http')) return image;
  return `/api${image}`;
};

export function FriendsPage() {
  const navigate = useNavigate();
  const { socket } = useUser();
  const { showToast } = useToast();
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadFriends = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/users/friends', { credentials: 'include' });
      if (!res.ok) { setFriends([]); return; }
      const data = await res.json();
      setFriends(data.friends ?? []);
    } catch {
      setFriends([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadFriends();
  }, []);

  useEffect(() => {
    if (!socket) return;
    const onAccepted = () => {
      showToast({ message: 'A friend request was accepted', type: 'success', location: 'TOP-RIGHT' });
      void loadFriends();
    };
    socket.on('social.friend.accepted', onAccepted);
    return () => { socket.off('social.friend.accepted', onAccepted); };
  }, [socket]);

  useEffect(() => {
    if (!socket) return;
    const onPresence = ({ userId, status }: { userId: number; status: 'online' | 'offline' }) => {
      setFriends((prev) =>
        prev.map((f) => f.friend.id === userId ? { ...f, isOnline: status === 'online' } : f),
      );
    };
    socket.on('social.presence.changed', onPresence);
    return () => { socket.off('social.presence.changed', onPresence); };
  }, [socket]);

  const handleOpenChat = async (friendId: number) => {
    try {
      const res = await fetch(`/api/conversations/with/${friendId}`, { method: 'POST', credentials: 'include' });
      const data = await res.json().catch(() => null);
      if (!res.ok) { showToast({ message: data?.error ?? 'Could not open chat', type: 'error', location: 'TOP-RIGHT' }); return; }
      navigate(`/messages/${data.conversation.id}`);
    } catch {
      showToast({ message: 'Could not open chat', type: 'error', location: 'TOP-RIGHT' });
    }
  };

  const online = friends.filter((f) => f.isOnline);
  const offline = friends.filter((f) => !f.isOnline);

  const renderCard = (item: FriendItem) => {
    const name =
      (item.friend.displayName ??
      item.friend.login ??
      `${item.friend.firstName ?? ''} ${item.friend.lastName ?? ''}`.trim()) ||
      'Unknown';

    return (
      <article
        key={item.friendshipId}
        className={styles.card}
        onClick={() => navigate(`/profile/${item.friend.login}`)}
      >
        <div className={styles.avatarWrapper}>
          <img src={getImageUrl(item.friend.image)} alt={name} className={styles.avatar} />
        </div>

        <div className={styles.info}>
          <strong className={styles.name}>{name}</strong>
          <span className={styles.login}>@{item.friend.login}</span>
          <span className={`${styles.status} ${item.isOnline ? styles.statusOnline : styles.statusOffline}`}>
            {item.isOnline ? 'Online' : 'Offline'}
          </span>
        </div>

        <div className={styles.cardActions}>
          <button
            type="button"
            className={styles.chatBtn}
            onClick={(e) => { e.stopPropagation(); void handleOpenChat(item.friend.id); }}
            aria-label={`Chat with ${name}`}
          >
            💬
          </button>
        </div>
      </article>
    );
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button type="button" className={styles.back} onClick={() => navigate('/home')}>← Back</button>
        <h1 className={styles.title}>Friends</h1>
        <span className={styles.totalCount}>{friends.length}</span>
      </div>

      {loading ? (
        <p className={styles.empty}>Loading friends…</p>
      ) : friends.length === 0 ? (
        <p className={styles.empty}>You have no friends yet.</p>
      ) : (
        <>
          {online.length > 0 && (
            <section className={styles.section}>
              <p className={styles.sectionLabel}>Online — {online.length}</p>
              <div className={styles.grid}>{online.map(renderCard)}</div>
            </section>
          )}

          {offline.length > 0 && (
            <section className={styles.section}>
              <p className={styles.sectionLabel}>Offline — {offline.length}</p>
              <div className={styles.grid}>{offline.map(renderCard)}</div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
