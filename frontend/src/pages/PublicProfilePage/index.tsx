import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useUser } from '../../contexts/UserContext';
import { useToast } from '../../contexts/ToastContext';
import styles from './PublicProfilePage.module.scss';
import defaultProfileImage from '../../assets/defaultProfile.webp';

type PublicUser = {
  id: number;
  login: string | null;
  email: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  image: string | null;
};

type PublicProfileResponse = {
  user: PublicUser;
  isOnline: boolean;
};

const getImageUrl = (image?: string | null): string => {
  if (!image) return defaultProfileImage;
  if (image.startsWith('http')) return image;
  return `/api${image}`;
};

export function PublicProfilePage() {
  const { login } = useParams<{ login: string }>();
  const navigate = useNavigate();
  const { user: currentUser, socket } = useUser();
  const { showToast } = useToast();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [friendRequested, setFriendRequested] = useState(false);
  const [alreadyFriends, setAlreadyFriends] = useState(false);
  const [loading, setLoading] = useState(true);
  const profileLogin = login ?? '';

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const [profileRes, friendsRes] = await Promise.all([
          fetch(`/api/users/${encodeURIComponent(profileLogin)}`),
          fetch('/api/users/friends', { credentials: 'include' }),
        ]);

        if (!profileRes.ok) {
          setUser(null);
          return;
        }

        const userData = (await profileRes.json()) as PublicProfileResponse;
        setUser(userData.user);
        setIsOnline(userData.isOnline);

        if (friendsRes.ok) {
          const friendsData = await friendsRes.json() as { friends: { friend: { id: number } }[] };
          const isFriend = friendsData.friends.some(
            (f) => f.friend.id === userData.user.id,
          );
          setAlreadyFriends(isFriend);
        }
      } catch (error) {
        console.error('Error fetching user:', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    if (profileLogin) {
      void fetchUser();
    }
  }, [profileLogin]);

  useEffect(() => {
    if (!socket || !user) return;

    const handlePresenceChanged = ({
      userId,
      status,
    }: {
      userId: number;
      status: 'online' | 'offline';
    }) => {
      if (userId === user.id) setIsOnline(status === 'online');
    };

    socket.on('social.presence.changed', handlePresenceChanged);
    return () => { socket.off('social.presence.changed', handlePresenceChanged); };
  }, [socket, user]);

  const handleAddFriend = () => {
    if (!user || friendRequested || alreadyFriends || currentUser?.id === user.id) return;

    const sendFriendRequest = async () => {
      try {
        const response = await fetch(
          `/api/users/${encodeURIComponent(profileLogin)}/friend-request`,
          { method: 'POST', credentials: 'include' },
        );

        const data = await response.json().catch(() => null);

        if (!response.ok) {
          showToast({ message: data?.error ?? 'Could not send friend request', type: 'error', location: 'TOP-RIGHT' });
          return;
        }

        if (data?.created) {
          showToast({ message: 'Friend request sent', type: 'success', location: 'TOP-RIGHT' });
        }

        setFriendRequested(true);
      } catch {
        showToast({ message: 'Could not send friend request', type: 'error', location: 'TOP-RIGHT' });
      }
    };

    void sendFriendRequest();
  };

  if (loading) return <div className={styles.page}><p style={{ color: '#e8dfc5' }}>Loading…</p></div>;

  if (!user) {
    return (
      <div className={styles.page}>
        <button type="button" className={styles.back} onClick={() => navigate(-1)}>← Back</button>
        <div className={styles.userInfo}>
          <h2 style={{ color: '#e8dfc5' }}>Profile not found</h2>
          <p style={{ color: '#aaa69b' }}>This user does not exist or the profile is unavailable.</p>
        </div>
      </div>
    );
  }

  const isSelf = currentUser?.id === user.id;

  const friendButtonLabel = () => {
    if (alreadyFriends) return 'Already friends';
    if (friendRequested) return 'Request sent';
    return 'Add friend';
  };

  return (
    <div className={styles.page}>
      <button type="button" className={styles.back} onClick={() => navigate(-1)}>
        ← Back
      </button>

      <div className={styles.userInfo}>
        <div className={styles.avatarSection}>
          <div className={styles.avatarWrapper}>
            <img
              className={styles.profileImage}
              src={getImageUrl(user.image)}
              alt={user.displayName ?? user.login ?? ''}
            />
            <span
              className={`${styles.presenceDot} ${isOnline ? styles.online : styles.offline}`}
              aria-label={isOnline ? 'Online' : 'Offline'}
              title={isOnline ? 'Online' : 'Offline'}
            />
          </div>
        </div>

        <div className={styles.presenceRow}>
          <span className={`${styles.presenceBadge} ${isOnline ? styles.onlineBadge : styles.offlineBadge}`}>
            {isOnline ? 'Online' : 'Offline'}
          </span>
        </div>

        <div className={styles.fields}>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Login</span>
            <span className={styles.fieldValue}>{user.login}</span>
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Email</span>
            <span className={styles.fieldValue}>{user.email}</span>
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>First Name</span>
            <span className={styles.fieldValue}>{user.firstName}</span>
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Last Name</span>
            <span className={styles.fieldValue}>{user.lastName}</span>
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Display Name</span>
            <span className={styles.fieldValue}>{user.displayName}</span>
          </div>
        </div>

        {!isSelf && (
          <div className={styles.actions}>
            <button
              type="button"
              onClick={handleAddFriend}
              disabled={!socket || friendRequested || alreadyFriends}
            >
              {friendButtonLabel()}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
