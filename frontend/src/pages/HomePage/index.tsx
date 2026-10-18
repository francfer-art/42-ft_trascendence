import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import styles from './HomePage.module.scss';

import { useTranslation } from '../../hooks/useTranslation';
import { useUser } from '../../contexts/UserContext';
import { HowToPlayCarousel } from '../../components/HowToPlayCarousel/HowToPlayCarousel';
import defaultProfileImage from '../../assets/defaultProfile.webp';

const getImageUrl = (image?: string | null): string => {
  if (!image) return defaultProfileImage;
  if (image.startsWith('http')) return image;
  return `/api${image}`;
};

export function HomePage() {
  const navigate = useNavigate();
  const { language, user, socket, logout, unreadConvIds } = useUser();

  const translations = useTranslation(language, 'homePage,cardTypes');

  const [pendingCount, setPendingCount] = useState(0);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joiningLobby, setJoiningLobby] = useState(false);

  const loadPendingCount = async () => {
    if (!user) {
      setPendingCount(0);
      return;
    }
    try {
      const res = await fetch('/api/users/friend-requests', {
        credentials: 'include',
      });
      if (!res.ok) return;
      const data = await res.json();
      setPendingCount((data.requests ?? []).length);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    void loadPendingCount();
  }, [user]);

  useEffect(() => {
    if (!socket || !user) return;
    const onRequest = () => void loadPendingCount();
    socket.on('social.friend.requested', onRequest);
    return () => {
      socket.off('social.friend.requested', onRequest);
    };
  }, [socket, user]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleCreateGame = useCallback(() => {
    if (!socket) return;
    socket.emit('game.lobby.create', {}, (ack: { success: boolean; code?: string; error?: string }) => {
      if (ack.success && ack.code) {
        navigate(`/lobby/${ack.code}`);
      }
    });
  }, [socket, navigate]);

  const handleJoinGame = useCallback(() => {
    if (!socket || joinCode.length !== 4) return;
    setJoiningLobby(true);
    setJoinError(null);
    socket.emit('game.lobby.join', { code: joinCode }, (ack: { success: boolean; code?: string; error?: string }) => {
      setJoiningLobby(false);
      if (ack.success && ack.code) {
        setShowJoinModal(false);
        setJoinCode('');
        navigate(`/lobby/${ack.code}`);
      } else {
        setJoinError(ack.error ?? 'Could not join lobby');
      }
    });
  }, [socket, joinCode, navigate]);

  if (!translations) {
    return <p>...</p>;
  }

  const displayName = user?.displayName ?? user?.login ?? 'Player';

  return (
    <div className={styles.home}>
      {/* =====================================================
          SIDEBAR
      ===================================================== */}

      <aside className={styles.sidebar}>
        <div className={styles.logo}>
          <span>VILLAINOUS</span>
        </div>

        <div className={styles.profile}>
          <div className={styles.profileImage}>
            <img
              src={getImageUrl(user?.image)}
              alt={displayName}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                borderRadius: '50%',
              }}
            />
          </div>

          <div>
            <p className={styles.profileName}>{displayName.toUpperCase()}</p>
            <p className={styles.profileStatus}>ONLINE</p>
          </div>
        </div>

        <nav className={styles.navigation}>
          <button className={`${styles.navItem} ${styles.active}`}>
            <span>♜</span>
            {translations.homePage.home}
          </button>

          <button
            className={styles.navItem}
            onClick={() => navigate('/friends')}
          >
            <span>♟</span>
            {translations.homePage.friends}
          </button>

          <button
            className={styles.navItem}
            onClick={() => navigate('/messages')}
          >
            <span>✉</span>
            {translations.homePage.chat}
            {unreadConvIds.size > 0 && (
              <span className={styles.sideBadge}>{unreadConvIds.size}</span>
            )}
          </button>

          <button
            className={styles.navItem}
            onClick={() => navigate('/profile')}
          >
            <span>♙</span>
            {translations.homePage.profile}
          </button>

          <button
            className={styles.navItem}
            onClick={() => navigate('/notifications')}
          >
            <span>♢</span>
            {translations.homePage.notifications}
            {pendingCount > 0 && (
              <span className={styles.sideBadge}>{pendingCount}</span>
            )}
          </button>

          <button className={styles.navItem}>
            <span>♛</span>
            {translations.homePage.myGames}
          </button>
        </nav>

        <button className={styles.logout} onClick={() => void handleLogout()}>
          <span>↪</span>
          {translations.homePage.logout}
        </button>
      </aside>

      {/* =====================================================
          MAIN
      ===================================================== */}

      <main className={styles.main}>
        {/* =================================================
            HERO
        ================================================= */}

        <section className={styles.hero}>
          <div className={styles.heroOverlay} />

          <div className={styles.heroContent}>
            {/* =============================================
                WELCOME
            ============================================= */}

            <section className={styles.welcome}>
              <div>
                <p className={styles.eyebrow}>THE REALM AWAITS</p>

                <h1>
                  WELCOME BACK, <span>{displayName.toUpperCase()}</span>
                </h1>

                <p className={styles.welcomeSubtitle}>
                  What shall we play today?
                </p>
              </div>
            </section>

            {/* =============================================
                CREATE / JOIN
            ============================================= */}

            <section className={styles.actions}>
              <button
                className={styles.createGame}
                onClick={handleCreateGame}
              >
                <span className={styles.actionIcon}>+</span>

                <span>
                  <strong>CREATE GAME</strong>

                  <small>Start a new game</small>
                </span>
              </button>

              <button
                className={styles.joinGame}
                onClick={() => { setShowJoinModal(true); setJoinError(null); setJoinCode(''); }}
              >
                <span className={styles.actionIcon}>👥</span>

                <span>
                  <strong>JOIN GAME</strong>

                  <small>Join an existing game</small>
                </span>
              </button>
            </section>
          </div>
        </section>

        {/* =================================================
            HOW TO PLAY
        ================================================= */}

        <h2 className={styles.howToPlayTitle}>LEARN HOW TO PLAY</h2>

        {/* =================================================
            CAROUSEL
        ================================================= */}

        <HowToPlayCarousel />

        {/* =================================================
            YOUR GAMES
        ================================================= */}

        <section className={styles.games}>
          <div className={styles.gamesHeader}>
            <div>
              <p className={styles.eyebrow}>YOUR BATTLES</p>

              <h2>YOUR GAMES</h2>
            </div>

            <button className={styles.viewAll}>VIEW ALL →</button>
          </div>

          <div className={styles.gameList}>
            <article className={styles.game}>
              <div className={styles.gameIcon}>⚔</div>

              <div className={styles.gameInfo}>
                <h3>The Dark Realm</h3>

                <p>Playing as Scar</p>
              </div>

              <div className={styles.status}>YOUR TURN</div>

              <button className={styles.continue}>→</button>
            </article>

            <article className={styles.game}>
              <div className={styles.gameIcon}>♛</div>

              <div className={styles.gameInfo}>
                <h3>Villainous Battle</h3>

                <p>Playing as Maleficent</p>
              </div>

              <div className={styles.status}>WAITING</div>

              <button className={styles.continue}>→</button>
            </article>

            <article className={styles.game}>
              <div className={styles.gameIcon}>⌛</div>

              <div className={styles.gameInfo}>
                <h3>The Underworld</h3>

                <p>Playing as Hades</p>
              </div>

              <div className={styles.status}>WAITING</div>

              <button className={styles.continue}>→</button>
            </article>
          </div>
        </section>
      </main>

      {/* ── Join Game Modal ── */}
      {showJoinModal && (
        <div className={styles.modalOverlay} onClick={() => setShowJoinModal(false)}>
          <div className={styles.joinModal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>JOIN GAME</h3>
            <p className={styles.modalSubtitle}>Enter the 4-character code from the host</p>
            <input
              className={styles.codeInput}
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 4))}
              placeholder="A72F"
              maxLength={4}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && joinCode.length === 4 && void handleJoinGame()}
            />
            {joinError && <p className={styles.joinError}>{joinError}</p>}
            <div className={styles.modalActions}>
              <button
                className={styles.joinConfirmBtn}
                disabled={joinCode.length !== 4 || joiningLobby}
                onClick={() => void handleJoinGame()}
              >
                {joiningLobby ? 'JOINING…' : 'JOIN'}
              </button>
              <button className={styles.cancelBtn} onClick={() => setShowJoinModal(false)}>
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
