import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useUser } from '../../contexts/UserContext';
import styles from './LobbyPage.module.scss';
import defaultProfileImage from '../../assets/defaultProfile.webp';

const BACKEND_URL = '/api';

interface VillainImage {
  id: string;
  path: string;
}

interface Villain {
  id: string;
  name: string;
  images: VillainImage[];
}

interface LobbyPlayer {
  userId: number;
  displayName: string;
  image: string | null;
  villainId: string | null;
}

interface LobbyState {
  code: string;
  hostId: number;
  players: LobbyPlayer[];
  maxPlayers: number;
  isPrivate: boolean;
  status: string;
}

function getAvatarUrl(image?: string | null): string {
  if (!image) return defaultProfileImage;
  if (image.startsWith('http')) return image;
  return `${BACKEND_URL}${image}`;
}

function getVillainImageUrl(path: string): string {
  if (path.startsWith('http')) return path;
  return `${BACKEND_URL}${path}`;
}

function getVillainImage(villain: Villain): string | null {
  const img = villain.images[0];
  return img ? getVillainImageUrl(img.path) : null;
}

interface VillainPickerProps {
  villains: Villain[];
  takenIds: string[];
  onSelect: (id: string) => void;
  onClose: () => void;
}

function VillainPicker({
  villains,
  takenIds,
  onSelect,
  onClose,
}: VillainPickerProps) {
  return (
    <div className={styles.pickerOverlay} onClick={onClose}>
      <div className={styles.pickerModal} onClick={(e) => e.stopPropagation()}>
        <h3 className={styles.pickerTitle}>CHOOSE YOUR VILLAIN</h3>
        <div className={styles.pickerGrid}>
          {villains.map((v) => {
            const taken = takenIds.includes(v.id);
            const img = getVillainImage(v);
            return (
              <button
                key={v.id}
                className={`${styles.pickerCard} ${taken ? styles.taken : ''}`}
                disabled={taken}
                onClick={() => !taken && onSelect(v.id)}
              >
                {img && (
                  <img src={img} alt={v.name} className={styles.pickerImg} />
                )}
                <span className={styles.pickerName}>{v.name}</span>
                {taken && <span className={styles.takenBadge}>TAKEN</span>}
              </button>
            );
          })}
        </div>
        <button className={styles.pickerClose} onClick={onClose}>
          CANCEL
        </button>
      </div>
    </div>
  );
}

interface JoinCodeInputProps {
  onJoin: (code: string) => void;
  onCancel: () => void;
  error: string | null;
}

function JoinCodeInput({ onJoin, onCancel, error }: JoinCodeInputProps) {
  const [code, setCode] = useState('');

  return (
    <div className={styles.pickerOverlay} onClick={onCancel}>
      <div className={styles.joinModal} onClick={(e) => e.stopPropagation()}>
        <h3 className={styles.pickerTitle}>JOIN GAME</h3>
        <p className={styles.joinSubtitle}>
          Enter the 4-character code from the host
        </p>
        <input
          className={styles.codeInput}
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 4))}
          placeholder="A72F"
          maxLength={4}
          autoFocus
          onKeyDown={(e) =>
            e.key === 'Enter' && code.length === 4 && onJoin(code)
          }
        />
        {error && <p className={styles.joinError}>{error}</p>}
        <div className={styles.joinActions}>
          <button
            className={styles.joinBtn}
            disabled={code.length !== 4}
            onClick={() => onJoin(code)}
          >
            JOIN
          </button>
          <button className={styles.cancelBtn} onClick={onCancel}>
            CANCEL
          </button>
        </div>
      </div>
    </div>
  );
}

export function LobbyPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { user, socket } = useUser();

  const [lobby, setLobby] = useState<LobbyState | null>(null);
  const [villains, setVillains] = useState<Villain[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [lobbyError, setLobbyError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const startedRef = useRef(false);

  useEffect(() => {
    fetch(`${BACKEND_URL}/villains?lang=en`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: Villain[] | null) => {
        if (data) setVillains(data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!socket || !code) return;

    const joinLobby = () => {
      socket.emit(
        'game.lobby.join',
        { code: code.toUpperCase() },
        (ack: { success: boolean; error?: string }) => {
          if (!ack.success) {
            setLobbyError(ack.error ?? 'Could not join lobby');
          }
        },
      );
    };

    const onUpdated = (data: LobbyState) => {
      setLobby(data);
      setLobbyError(null);
    };

    const onKicked = () => {
      navigate('/home');
    };

    const onError = ({ error }: { error: string }) => {
      setLobbyError(error);
    };

    const onStarted = (data: LobbyState) => {
      startedRef.current = true;
      setLobby(data);
      navigate(`/game/${data.code}`);
    };

    socket.on('game.lobby.updated', onUpdated);
    socket.on('game.lobby.kicked', onKicked);
    socket.on('game.lobby.error', onError);
    socket.on('game.match.started', onStarted);
    socket.on('reconnect', joinLobby); // Resync after brief socket reconnect

    joinLobby();

    return () => {
      socket.off('game.lobby.updated', onUpdated);
      socket.off('game.lobby.kicked', onKicked);
      socket.off('game.lobby.error', onError);
      socket.off('game.match.started', onStarted);
      socket.off('reconnect', joinLobby);
      // Going to the game page must keep the player in the lobby
      if (!startedRef.current) socket.emit('game.lobby.leave');
    };
  }, [socket, code, navigate]);

  const handleLeave = useCallback(() => {
    socket?.emit('game.lobby.leave');
    navigate('/home');
  }, [socket, navigate]);

  const handleKick = useCallback(
    (userId: number) => {
      socket?.emit('game.lobby.kick', { userId });
    },
    [socket],
  );

  const handleSelectVillain = useCallback(
    (villainId: string) => {
      socket?.emit('game.villain.select', { villainId });
      setShowPicker(false);
    },
    [socket],
  );

  const handleStartGame = useCallback(() => {
    socket?.emit(
      'game.match.start',
      {},
      (ack: { success: boolean; error?: string }) => {
        if (!ack.success) {
          setLobbyError(ack.error ?? 'Could not start game');
          return;
        }
        startedRef.current = true;
        navigate(`/game/${code?.toUpperCase()}`);
      },
    );
  }, [socket, navigate, code]);

  const handleCopyCode = useCallback(() => {
    if (!lobby) return;
    navigator.clipboard.writeText(lobby.code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [lobby]);

  if (!user) return null;

  if (lobbyError && !lobby) {
    return (
      <div className={styles.errorPage}>
        <p className={styles.errorText}>{lobbyError}</p>
        <button className={styles.backBtn} onClick={() => navigate('/home')}>
          ← BACK TO HOME
        </button>
      </div>
    );
  }

  if (!lobby) {
    return (
      <div className={styles.loadingPage}>
        <p>Connecting to lobby…</p>
      </div>
    );
  }

  const isHost = lobby.hostId === user.id;
  const me = lobby.players.find((p) => p.userId === user.id);
  const takenVillainIds = lobby.players
    .filter((p) => p.userId !== user.id && p.villainId)
    .map((p) => p.villainId as string);

  const allHaveVillain = lobby.players.every((p) => p.villainId);
  const canStart = isHost && lobby.players.length >= 2 && allHaveVillain;

  const slots = Array.from(
    { length: lobby.maxPlayers },
    (_, i) => lobby.players[i] ?? null,
  );

  const villainMap = Object.fromEntries(villains.map((v) => [v.id, v]));

  return (
    <div className={styles.lobby}>
      {/* ── Header ── */}
      <header className={styles.header}>
        <p className={styles.codeDisplay}>#{lobby.code}</p>
        <div className={styles.headerActions}>
          <button className={styles.copyBtn} onClick={handleCopyCode}>
            {copied ? 'COPIED!' : 'COPY CODE'}
          </button>
          <button className={styles.leaveBtn} onClick={handleLeave}>
            LEAVE
          </button>
        </div>
      </header>

      <div className={styles.content}>
        {/* ── Players ── */}
        <section className={styles.section}>
          <p className={styles.sectionLabel}>01 — PLAYERS</p>
          <div className={styles.playerGrid}>
            {slots.map((player, i) => {
              if (!player) {
                return (
                  <div
                    key={`empty-${i}`}
                    className={`${styles.playerSlot} ${styles.empty}`}
                  >
                    <span className={styles.emptyIcon}>👤</span>
                    <p className={styles.emptyText}>Waiting for player</p>
                    <p className={styles.emptySubtext}>OPEN SLOT</p>
                  </div>
                );
              }

              const isMe = player.userId === user.id;
              const villain = player.villainId
                ? villainMap[player.villainId]
                : null;
              const villainImg = villain ? getVillainImage(villain) : null;

              return (
                <div
                  key={`player-${player.userId}`}
                  className={`${styles.playerSlot} ${isMe ? styles.me : ''}`}
                >
                  {villainImg ? (
                    <div className={styles.villainBg}>
                      <img
                        src={villainImg}
                        alt={villain?.name}
                        className={styles.villainBgImg}
                      />
                    </div>
                  ) : (
                    <div className={styles.avatarArea}>
                      <img
                        src={getAvatarUrl(player.image)}
                        alt={player.displayName}
                        className={styles.avatar}
                      />
                    </div>
                  )}

                  <div className={styles.playerInfo}>
                    <p className={styles.playerName}>{player.displayName}</p>
                    <div className={styles.playerBadges}>
                      {lobby.hostId === player.userId && (
                        <span className={styles.hostBadge}>HOST</span>
                      )}
                      {villain && (
                        <span className={styles.villainBadge}>
                          {villain.name}
                        </span>
                      )}
                    </div>
                    {isMe && (
                      <button
                        className={styles.pickVillainBtn}
                        onClick={() => setShowPicker(true)}
                      >
                        {villain ? 'CHANGE VILLAIN' : 'PICK VILLAIN'}
                      </button>
                    )}
                    {isHost && !isMe && (
                      <button
                        className={styles.kickBtn}
                        onClick={() => handleKick(player.userId)}
                      >
                        KICK
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Settings ── */}
        <section className={styles.section}>
          <p className={styles.sectionLabel}>02 — CONFIGURATION</p>
          <div className={styles.configRow}>
            <span>{lobby.isPrivate ? 'Private game' : 'Public game'}</span>
            <span>·</span>
            <span>2–{lobby.maxPlayers} players</span>
          </div>
        </section>

        {/* ── Error ── */}
        {lobbyError && <p className={styles.errorBanner}>{lobbyError}</p>}

        {/* ── Start / Wait ── */}
        <div className={styles.footer}>
          {isHost ? (
            <button
              className={`${styles.startBtn} ${!canStart ? styles.disabled : ''}`}
              disabled={!canStart}
              onClick={handleStartGame}
            >
              {!allHaveVillain
                ? 'ALL PLAYERS MUST PICK A VILLAIN'
                : lobby.players.length < 2
                  ? 'WAITING FOR MORE PLAYERS…'
                  : 'START GAME'}
            </button>
          ) : (
            <div className={styles.waitingMsg}>
              <p>WAITING FOR HOST TO START…</p>
              <p className={styles.waitingSubtext}>
                The game will begin when the host is ready
              </p>
            </div>
          )}
        </div>
      </div>

      {showPicker && me && (
        <VillainPicker
          villains={villains}
          takenIds={takenVillainIds}
          onSelect={handleSelectVillain}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}
