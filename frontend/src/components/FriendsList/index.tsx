import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../contexts/ToastContext';
import { useUser } from '../../contexts/UserContext';
import styles from './FriendsList.module.scss';

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

type FriendsResponse = {
  friends: FriendItem[];
};

const getImageUrl = (image?: string | null) => {
  if (!image) {
    return null;
  }

  if (image.startsWith('http')) {
    return image;
  }

  return `/api${image}`;
};

export function FriendsList() {
  const { socket } = useUser();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadFriends = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/users/friends', {
        credentials: 'include',
      });

      if (!response.ok) {
        setFriends([]);
        return;
      }

      const data = (await response.json()) as FriendsResponse;
      setFriends(data.friends ?? []);
    } catch (error) {
      console.error('Could not load friends:', error);
      setFriends([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadFriends();
  }, []);

  useEffect(() => {
    if (!socket) {
      return;
    }

    const handleFriendAccepted = () => {
      showToast({
        message: 'A friend request was accepted',
        type: 'success',
        location: 'TOP-RIGHT',
      });
      void loadFriends();
    };

    socket.on('social.friend.accepted', handleFriendAccepted);

    return () => {
      socket.off('social.friend.accepted', handleFriendAccepted);
    };
  }, [socket, showToast]);

  const handleOpenChat = async (friendId: number) => {
    try {
      const response = await fetch(`/api/conversations/with/${friendId}`, {
        method: 'POST',
        credentials: 'include',
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        showToast({
          message: data?.error ?? 'Could not open chat',
          type: 'error',
          location: 'TOP-RIGHT',
        });
        return;
      }

      navigate(`/messages/${data.conversation.id}`);
    } catch (error) {
      console.error('Could not open chat:', error);
      showToast({
        message: 'Could not open chat',
        type: 'error',
        location: 'TOP-RIGHT',
      });
    }
  };

  return (
    <section className={styles.friendsList}>
      <div className={styles.header}>
        <h2>Friends</h2>
        <span>{friends.length}</span>
      </div>

      {loading ? (
        <p className={styles.emptyState}>Loading friends...</p>
      ) : friends.length === 0 ? (
        <p className={styles.emptyState}>No friends yet.</p>
      ) : (
        <div className={styles.list}>
          {friends.map((item) => {
            const name =
              (item.friend.displayName ??
                item.friend.login ??
                `${item.friend.firstName ?? ''} ${item.friend.lastName ?? ''}`.trim()) ||
              'Unknown friend';
            const avatarUrl = getImageUrl(item.friend.image);

            return (
              <article key={item.friendshipId} className={styles.friendCard}>
                <div className={styles.friendInfo}>
                  <div className={styles.avatarWrapper}>
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={name}
                        className={styles.avatar}
                      />
                    ) : (
                      <div className={styles.avatarFallback}>
                        {name.slice(0, 1)}
                      </div>
                    )}

                    <span
                      className={`${styles.presenceDot} ${
                        item.isOnline ? styles.online : styles.offline
                      }`}
                      title={item.isOnline ? 'Online' : 'Offline'}
                      aria-label={item.isOnline ? 'Online' : 'Offline'}
                    />
                  </div>

                  <div>
                    <strong>{name}</strong>
                    <p>@{item.friend.login}</p>
                  </div>
                </div>

                <button
                  type="button"
                  className={styles.chatButton}
                  onClick={() => void handleOpenChat(item.friend.id)}
                  aria-label={`Chat with ${name}`}
                >
                  💬
                </button>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
