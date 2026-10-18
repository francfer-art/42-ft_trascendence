import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../../contexts/UserContext';
import { useToast } from '../../contexts/ToastContext';
import styles from './NotificationsPage.module.scss';
import defaultProfileImage from '../../assets/defaultProfile.webp';

type FriendRequester = {
  id: number;
  login: string | null;
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
  image: string | null;
};

type FriendRequestItem = {
  id: number;
  requester: FriendRequester;
  createdAt: string;
};

const getImageUrl = (image?: string | null): string => {
  if (!image) return defaultProfileImage;
  if (image.startsWith('http')) return image;
  return `/api${image}`;
};

export function NotificationsPage() {
  const navigate = useNavigate();
  const { user, socket } = useUser();
  const { showToast } = useToast();
  const [requests, setRequests] = useState<FriendRequestItem[]>([]);
  const [loading, setLoading] = useState(true);

  const pendingCount = useMemo(() => requests.length, [requests]);

  const loadRequests = async () => {
    if (!user) { setRequests([]); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/users/friend-requests', { credentials: 'include' });
      if (!res.ok) { setRequests([]); return; }
      const data = await res.json();
      setRequests(data.requests ?? []);
    } catch {
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRequests();
  }, [user]);

  useEffect(() => {
    if (!socket || !user) return;
    const onRequest = () => void loadRequests();
    socket.on('social.friend.requested', onRequest);
    return () => { socket.off('social.friend.requested', onRequest); };
  }, [socket, user]);

  const handleAccept = async (friendshipId: number) => {
    try {
      const res = await fetch(`/api/users/friend-requests/${friendshipId}/accept`, { method: 'POST', credentials: 'include' });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? 'Could not accept');
      showToast({ message: 'Friend request accepted', type: 'success', location: 'TOP-RIGHT' });
      await loadRequests();
    } catch (error) {
      showToast({ message: error instanceof Error ? error.message : 'Could not accept', type: 'error', location: 'TOP-RIGHT' });
    }
  };

  const handleReject = async (friendshipId: number) => {
    try {
      const res = await fetch(`/api/users/friend-requests/${friendshipId}/reject`, { method: 'POST', credentials: 'include' });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? 'Could not reject');
      showToast({ message: 'Friend request rejected', type: 'info', location: 'TOP-RIGHT' });
      await loadRequests();
    } catch (error) {
      showToast({ message: error instanceof Error ? error.message : 'Could not reject', type: 'error', location: 'TOP-RIGHT' });
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button type="button" className={styles.back} onClick={() => navigate('/home')}>← Back</button>
        <h1 className={styles.title}>Notifications</h1>
        {pendingCount > 0 && <span className={styles.badge}>{pendingCount}</span>}
      </div>

      <section className={styles.section}>
        <p className={styles.sectionLabel}>Friend Requests</p>

        {loading ? (
          <p className={styles.empty}>Loading…</p>
        ) : requests.length === 0 ? (
          <p className={styles.empty}>No pending friend requests.</p>
        ) : (
          <div className={styles.list}>
            {requests.map((req) => {
              const name = req.requester.displayName ?? req.requester.login ?? 'Unknown';
              return (
                <article key={req.id} className={styles.card}>
                  <div
                    className={styles.requesterInfo}
                    onClick={() => navigate(`/profile/${req.requester.login}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <img src={getImageUrl(req.requester.image)} alt={name} className={styles.avatar} />
                    <div>
                      <strong className={styles.name}>{name}</strong>
                      <p className={styles.login}>@{req.requester.login}</p>
                    </div>
                  </div>

                  <div className={styles.cardActions}>
                    <button
                      type="button"
                      className={styles.acceptBtn}
                      onClick={() => void handleAccept(req.id)}
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      className={styles.rejectBtn}
                      onClick={() => void handleReject(req.id)}
                    >
                      Reject
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
