import { useEffect, useMemo, useState } from 'react';
import { useUser } from '../../contexts/UserContext';
import { useToast } from '../../contexts/ToastContext';
import styles from './NotificationsBell.module.scss';

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

type FriendRequestsResponse = {
  requests: FriendRequestItem[];
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

export function NotificationsBell() {
  const { socket, user } = useUser();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [requests, setRequests] = useState<FriendRequestItem[]>([]);
  const [loading, setLoading] = useState(false);

  const loadRequests = async () => {
    if (!user) {
      setRequests([]);
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/users/friend-requests', {
        credentials: 'include',
      });

      if (!response.ok) {
        setRequests([]);
        return;
      }

      const data = (await response.json()) as FriendRequestsResponse;
      setRequests(data.requests ?? []);
    } catch (error) {
      console.error('Error loading friend requests:', error);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRequests();
  }, [user]);

  useEffect(() => {
    if (!socket || !user) {
      return;
    }

    const handleIncomingRequest = () => {
      void loadRequests();
    };

    socket.on('social.friend.requested', handleIncomingRequest);

    return () => {
      socket.off('social.friend.requested', handleIncomingRequest);
    };
  }, [socket, user]);

  const pendingCount = useMemo(() => requests.length, [requests]);

  const handleAccept = async (friendshipId: number) => {
    try {
      const response = await fetch(
        `/api/users/friend-requests/${friendshipId}/accept`,
        {
          method: 'POST',
          credentials: 'include',
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error ?? 'Could not accept friend request');
      }

      showToast({
        message: 'Friend request accepted',
        type: 'success',
        location: 'TOP-RIGHT',
      });

      await loadRequests();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Could not accept friend request';
      showToast({
        message,
        type: 'error',
        location: 'TOP-RIGHT',
      });
    }
  };

  const handleReject = async (friendshipId: number) => {
    try {
      const response = await fetch(
        `/api/users/friend-requests/${friendshipId}/reject`,
        {
          method: 'POST',
          credentials: 'include',
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error ?? 'Could not reject friend request');
      }

      showToast({
        message: 'Friend request rejected',
        type: 'info',
        location: 'TOP-RIGHT',
      });

      await loadRequests();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Could not reject friend request';
      showToast({
        message,
        type: 'error',
        location: 'TOP-RIGHT',
      });
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className={styles.notificationsWrapper}>
      <button
        type="button"
        className={styles.bellButton}
        onClick={() => setOpen((current) => !current)}
        aria-label="Notifications"
      >
        <span className={styles.bellIcon}>🔔</span>
        {pendingCount > 0 && (
          <span className={styles.badge}>{pendingCount}</span>
        )}
      </button>

      {open && (
        <div className={styles.dropdown}>
          <div className={styles.dropdownHeader}>
            <strong>Friend requests</strong>
            <button
              type="button"
              className={styles.closeButton}
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </div>

          <div className={styles.dropdownBody}>
            {loading ? (
              <p className={styles.emptyState}>Loading requests...</p>
            ) : requests.length === 0 ? (
              <p className={styles.emptyState}>No pending requests.</p>
            ) : (
              requests.map((request) => {
                const requesterName =
                  request.requester.displayName ??
                  request.requester.login ??
                  'Unknown user';
                const avatarUrl = getImageUrl(request.requester.image);

                return (
                  <div key={request.id} className={styles.requestCard}>
                    <div className={styles.requesterInfo}>
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt={requesterName}
                          className={styles.avatar}
                        />
                      ) : (
                        <div className={styles.avatarFallback}>
                          {requesterName.slice(0, 1)}
                        </div>
                      )}

                      <div>
                        <strong>{requesterName}</strong>
                        <p>@{request.requester.login}</p>
                      </div>
                    </div>

                    <div className={styles.actions}>
                      <button
                        type="button"
                        onClick={() => void handleAccept(request.id)}
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        className={styles.rejectButton}
                        onClick={() => void handleReject(request.id)}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
