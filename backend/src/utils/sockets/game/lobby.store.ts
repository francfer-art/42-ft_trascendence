export interface LobbyPlayer {
  userId: number;
  displayName: string;
  image: string | null;
  villainId: string | null;
  joinedAt: Date;
}

export interface Lobby {
  code: string;
  hostId: number;
  players: LobbyPlayer[];
  maxPlayers: number;
  isPrivate: boolean;
  status: 'waiting' | 'in_game';
  createdAt: Date;
}

const lobbies = new Map<string, Lobby>();
const userToLobby = new Map<number, string>();

function generateCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code: string;
  do {
    code = Array.from({ length: 4 }, () =>
      chars[Math.floor(Math.random() * chars.length)],
    ).join('');
  } while (lobbies.has(code));
  return code;
}

export function createLobby(host: LobbyPlayer): Lobby {
  removeLobbyPlayer(host.userId);

  const code = generateCode();
  const lobby: Lobby = {
    code,
    hostId: host.userId,
    players: [{ ...host }],
    maxPlayers: 4,
    isPrivate: true,
    status: 'waiting',
    createdAt: new Date(),
  };
  lobbies.set(code, lobby);
  userToLobby.set(host.userId, code);
  return lobby;
}

export function getLobby(code: string): Lobby | undefined {
  return lobbies.get(code);
}

export function getLobbyByUserId(userId: number): Lobby | undefined {
  const code = userToLobby.get(userId);
  if (!code) return undefined;
  return lobbies.get(code);
}

export function joinLobby(
  code: string,
  player: LobbyPlayer,
): { lobby: Lobby; alreadyIn?: boolean } | { error: string } {
  const lobby = lobbies.get(code);
  if (!lobby) return { error: 'Lobby not found' };
  if (lobby.status !== 'waiting') return { error: 'Game already started' };
  if (lobby.players.length >= lobby.maxPlayers) return { error: 'Lobby is full' };
  if (lobby.players.some((p) => p.userId === player.userId))
    return { lobby, alreadyIn: true };

  removeLobbyPlayer(player.userId);

  lobby.players.push({ ...player });
  userToLobby.set(player.userId, code);
  return { lobby };
}

export function leaveLobby(userId: number): { lobby: Lobby | null } {
  const code = userToLobby.get(userId);
  if (!code) return { lobby: null };

  const lobby = lobbies.get(code);
  if (!lobby) {
    userToLobby.delete(userId);
    return { lobby: null };
  }

  removeLobbyPlayer(userId);

  if (lobby.players.length === 0) {
    lobbies.delete(code);
    return { lobby: null };
  }

  if (lobby.hostId === userId) {
    lobby.players.sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime());
    lobby.hostId = lobby.players[0].userId;
  }

  return { lobby };
}

export function kickPlayer(
  code: string,
  hostId: number,
  targetUserId: number,
): { lobby: Lobby } | { error: string } {
  const lobby = lobbies.get(code);
  if (!lobby) return { error: 'Lobby not found' };
  if (lobby.hostId !== hostId) return { error: 'Not the host' };
  if (targetUserId === hostId) return { error: 'Cannot kick yourself' };
  if (!lobby.players.some((p) => p.userId === targetUserId))
    return { error: 'Player not in lobby' };

  lobby.players = lobby.players.filter((p) => p.userId !== targetUserId);
  userToLobby.delete(targetUserId);
  return { lobby };
}

export function selectVillain(
  code: string,
  userId: number,
  villainId: string,
): { lobby: Lobby } | { error: string } {
  const lobby = lobbies.get(code);
  if (!lobby) return { error: 'Lobby not found' };

  const alreadyTaken = lobby.players.some(
    (p) => p.userId !== userId && p.villainId === villainId,
  );
  if (alreadyTaken) return { error: 'Villain already taken' };

  const player = lobby.players.find((p) => p.userId === userId);
  if (!player) return { error: 'Not in lobby' };

  player.villainId = villainId;
  return { lobby };
}

export function startGame(
  code: string,
  hostId: number,
): { lobby: Lobby } | { error: string } {
  const lobby = lobbies.get(code);
  if (!lobby) return { error: 'Lobby not found' };
  if (lobby.hostId !== hostId) return { error: 'Not the host' };
  if (lobby.players.length < 2) return { error: 'Need at least 2 players' };

  const missingVillain = lobby.players.some((p) => !p.villainId);
  if (missingVillain) return { error: 'All players must select a villain' };

  const villainIds = lobby.players.map((p) => p.villainId);
  if (new Set(villainIds).size !== villainIds.length)
    return { error: 'Duplicate villains detected' };

  lobby.status = 'in_game';
  return { lobby };
}

function removeLobbyPlayer(userId: number): void {
  const existingCode = userToLobby.get(userId);
  if (!existingCode) return;

  const existingLobby = lobbies.get(existingCode);
  if (existingLobby) {
    existingLobby.players = existingLobby.players.filter(
      (p) => p.userId !== userId,
    );
    if (existingLobby.players.length === 0) {
      lobbies.delete(existingCode);
    } else if (existingLobby.hostId === userId) {
      existingLobby.players.sort(
        (a, b) => a.joinedAt.getTime() - b.joinedAt.getTime(),
      );
      existingLobby.hostId = existingLobby.players[0].userId;
    }
  }
  userToLobby.delete(userId);
}
