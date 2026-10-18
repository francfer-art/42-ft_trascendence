import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import styles from './GamePage.module.scss';
import { useViewportWidth } from '../../hooks/useViewportWidth';

type View = 'single' | 'overview';

const PLAYERS = [1, 2, 3, 4].map((n) => ({ id: n, name: `Jugador ${n}`, villain: `Villano ${n}` }));
const LOCATIONS = [1, 2, 3, 4];
const HAND_SIZE = 4;

// Overview grid reads like a real table: 3 4 on the far side, 2 1 on my side
const TABLE_ORDER = [3, 4, 2, 1];
const ACROSS_THE_TABLE = [3, 4];
const DRAG_MIME = 'text/plain';

const handZone = (playerId: number) => `${playerId}-hand`;

// Which cards sit in which zone. No game rules: cards just move between zones.
const INITIAL_ZONES: Record<string, string[]> = Object.fromEntries(
  PLAYERS.map((p) => [handZone(p.id), Array.from({ length: HAND_SIZE }, (_, i) => `J${p.id} · Carta ${i + 1}`)]),
);

interface TableApi {
  zones: Record<string, string[]>;
  moveCard: (card: string, toZone: string) => void;
  setHovered: (card: string | null) => void;
}

const TableContext = createContext<TableApi>({ zones: {}, moveCard: () => {}, setHovered: () => {} });

// Placeholder box: replace each <Slot /> with the real component
function Slot({ label, className = '', children }: { label: string; className?: string; children?: ReactNode }) {
  return (
    <div className={`${styles.slot} ${className}`}>
      <span className={styles.slotLabel}>{label}</span>
      {children}
    </div>
  );
}

function CardSlot({ card }: { card: string }) {
  const { setHovered } = useContext(TableContext);
  return (
    <div
      className={`${styles.slot} ${styles.card}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_MIME, card);
        e.dataTransfer.effectAllowed = 'move';
        setHovered(null);
      }}
      onMouseEnter={() => setHovered(card)}
      onMouseLeave={() => setHovered(null)}
    >
      <span className={styles.slotLabel}>{card}</span>
    </div>
  );
}

function DropArea({ zone, label, className = '' }: { zone: string; label: string; className?: string }) {
  const { zones, moveCard } = useContext(TableContext);
  const [over, setOver] = useState(false);
  return (
    <div
      className={`${styles.slot} ${styles.dropArea} ${over ? styles.dropOver : ''} ${className}`}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const card = e.dataTransfer.getData(DRAG_MIME);
        if (card) moveCard(card, zone);
      }}
    >
      <span className={styles.slotLabel}>{label}</span>
      <div className={styles.cardRow}>
        {(zones[zone] ?? []).map((card) => (
          <CardSlot key={card} card={card} />
        ))}
      </div>
    </div>
  );
}

function Location({ n }: { n: number }) {
  return (
    <Slot label={`Ubicación ${n}`} className={styles.location}>
      <span className={`${styles.action} ${styles.topLeft}`}>A1</span>
      <span className={`${styles.action} ${styles.topRight}`}>A2</span>
      <span className={`${styles.action} ${styles.bottomLeft}`}>A3</span>
      <span className={`${styles.action} ${styles.bottomRight}`}>A4</span>
      <Slot label="Acciones extra" className={styles.extraActions} />
    </Slot>
  );
}

function Realm({ playerId }: { playerId: number }) {
  return (
    <div className={styles.realm}>
      <div className={styles.lane}>
        {LOCATIONS.map((n) => (
          <DropArea key={n} zone={`${playerId}-fate-${n}`} label="Cartas destino" className={styles.laneCell} />
        ))}
      </div>
      <Slot label="Tablero (Realm)" className={styles.realmBoard}>
        <div className={styles.locations}>
          {LOCATIONS.map((n) => (
            <Location key={n} n={n} />
          ))}
        </div>
      </Slot>
      <div className={styles.lane}>
        {LOCATIONS.map((n) => (
          <DropArea key={n} zone={`${playerId}-villain-${n}`} label="Cartas villano" className={styles.laneCell} />
        ))}
      </div>
    </div>
  );
}

function PlayerArea({
  player,
  isMe,
  compact = false,
  onOpen,
}: {
  player: (typeof PLAYERS)[number];
  isMe: boolean;
  compact?: boolean;
  onOpen?: () => void;
}) {
  return (
    <div className={`${styles.playerArea} ${isMe ? styles.me : ''}`}>
      <div className={styles.playerHeader}>
        <span>
          {player.villain} — {player.name}
        </span>
        <Slot label="Poder" className={styles.power} />
        {onOpen && (
          <button className={styles.button} onClick={onOpen}>
            Ampliar
          </button>
        )}
      </div>

      <div className={styles.playerBody}>
        <div className={styles.pileColumn}>
          <Slot label="Mazo villano" className={styles.pile} />
          <Slot label="Descarte villano" className={styles.pile} />
        </div>
        <Realm playerId={player.id} />
        <div className={styles.pileColumn}>
          <Slot label="Mazo destino" className={styles.pile} />
          <Slot label="Descarte destino" className={styles.pile} />
        </div>
      </div>

      {compact && <DropArea zone={handZone(player.id)} label="Mano" className={styles.hand} />}
    </div>
  );
}

export function GamePage() {
  const { code } = useParams<{ code: string }>();
  const { isDesktop } = useViewportWidth();
  const [view, setView] = useState<View>('overview');
  const [index, setIndex] = useState(0);
  const [chatOpen, setChatOpen] = useState(true);
  const [zones, setZones] = useState(INITIAL_ZONES);
  const [hovered, setHovered] = useState<string | null>(null);
  const [shiftHeld, setShiftHeld] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => e.key === 'Shift' && setShiftHeld(true);
    const up = (e: KeyboardEvent) => e.key === 'Shift' && setShiftHeld(false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  if (!isDesktop) {
    return (
      <div className={styles.desktopOnly}>
        <p>Vista solo disponible para escritorio</p>
      </div>
    );
  }

  const moveCard = (card: string, toZone: string) =>
    setZones((prev) => {
      const next = Object.fromEntries(Object.entries(prev).map(([zone, cards]) => [zone, cards.filter((c) => c !== card)]));
      next[toZone] = [...(next[toZone] ?? []), card];
      return next;
    });

  const me = PLAYERS[0];
  const shift = (d: number) => setIndex((i) => (i + d + PLAYERS.length) % PLAYERS.length);
  const open = (i: number) => {
    setIndex(i);
    setView('single');
  };

  return (
    <TableContext.Provider value={{ zones, moveCard, setHovered }}>
      <div className={styles.page}>
        <header className={styles.toolbar}>
          <div className={styles.toolbarGroup}>
            <button className={styles.button} onClick={() => setChatOpen((o) => !o)} aria-label="Abrir/cerrar chat">
              ☰
            </button>
            <span>Partida #{code}</span>
          </div>
          <small>Shift + pasar el ratón por una carta para ampliarla</small>
          <div className={styles.toolbarGroup}>
            <button className={styles.button} disabled={view === 'single'} onClick={() => setView('single')}>
              Vista jugador
            </button>
            <button className={styles.button} disabled={view === 'overview'} onClick={() => setView('overview')}>
              Vista general
            </button>
          </div>
        </header>

        <div className={styles.main}>
          {chatOpen && <Slot label="Chat (mensajes + eventos)" className={styles.chat} />}

          <section className={styles.boardArea}>
            {view === 'single' ? (
              <div className={styles.single}>
                <button className={styles.button} onClick={() => shift(-1)}>
                  ←
                </button>
                <PlayerArea player={PLAYERS[index]} isMe={PLAYERS[index].id === me.id} />
                <button className={styles.button} onClick={() => shift(1)}>
                  →
                </button>
              </div>
            ) : (
              <div className={styles.overview}>
                <DropArea zone="center" label="Centro de la mesa (efectos, cartas robadas/reveladas)" className={styles.tableCenter} />
                {TABLE_ORDER.map((id) => {
                  const i = PLAYERS.findIndex((p) => p.id === id);
                  const p = PLAYERS[i];
                  return (
                    <div key={id} className={ACROSS_THE_TABLE.includes(id) ? styles.facingMe : ''}>
                      <PlayerArea player={p} isMe={p.id === me.id} compact onOpen={() => open(i)} />
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {view === 'single' && <DropArea zone={handZone(me.id)} label={`Mano de ${me.name}`} className={styles.hand} />}

        {shiftHeld && hovered && (
          <div className={styles.zoomOverlay}>
            <Slot label={hovered} className={styles.zoomCard} />
          </div>
        )}
      </div>
    </TableContext.Provider>
  );
}
