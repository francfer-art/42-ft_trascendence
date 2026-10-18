import type { Server, Socket } from 'socket.io';
import { SOCKET_EVENTS } from '../socket.events';
import type {
  CreateLobbyPayload,
  JoinLobbyPayload,
  KickPlayerPayload,
  LobbyAck,
  SelectVillainPayload,
  SerializedLobby,
} from './game.types';
import type { Lobby } from './lobby.store';
import {
  createLobby,
  getLobbyByUserId,
  joinLobby,
  kickPlayer,
  leaveLobby,
  selectVillain,
  startGame,
} from './lobby.store';
import { getUserSocketIds } from '../presence.store';

// Grace period before a disconnected player is removed from their lobby.
// Covers brief TCP reconnects and HMR reloads without destroying lobby state.
const leaveTimers = new Map<number, ReturnType<typeof setTimeout>>();

export function scheduleLeave(io: Server, socket: Socket, userId: number): void {
  if (leaveTimers.has(userId)) clearTimeout(leaveTimers.get(userId)!);
  const timer = setTimeout(() => {
    leaveTimers.delete(userId);
    handleLeave(io, socket, userId);
  }, 8000);
  leaveTimers.set(userId, timer);
}

export function cancelLeave(userId: number): void {
  if (leaveTimers.has(userId)) {
    clearTimeout(leaveTimers.get(userId)!);
    leaveTimers.delete(userId);
  }
}

function getLobbyRoom(code: string): string {
  return `lobby:${code}`;
}

function serialize(lobby: Lobby): SerializedLobby {
  return {
    code: lobby.code,
    hostId: lobby.hostId,
    players: lobby.players.map((p) => ({
      userId: p.userId,
      displayName: p.displayName,
      image: p.image,
      villainId: p.villainId,
    })),
    maxPlayers: lobby.maxPlayers,
    isPrivate: lobby.isPrivate,
    status: lobby.status,
  };
}

export function registerGameHandlers(io: Server, socket: Socket): void {
  const user = socket.data.user as {
    id: number;
    displayName: string | null;
    login: string | null;
    image: string | null;
  };

  socket.on(
    SOCKET_EVENTS.GAME.LOBBY_CREATE,
    (_payload: CreateLobbyPayload, cb?: (ack: LobbyAck) => void) => {
      const lobby = createLobby({
        userId: user.id,
        displayName: user.displayName ?? user.login ?? 'Player',
        image: user.image,
        villainId: null,
        joinedAt: new Date(),
      });

      socket.join(getLobbyRoom(lobby.code));
      io.to(getLobbyRoom(lobby.code)).emit(
        SOCKET_EVENTS.GAME.LOBBY_UPDATED,
        serialize(lobby),
      );

      console.log('[Game] Lobby created:', lobby.code, 'by', user.id);
      cb?.({ success: true, code: lobby.code });
    },
  );

  socket.on(
    SOCKET_EVENTS.GAME.LOBBY_JOIN,
    (payload: JoinLobbyPayload, cb?: (ack: LobbyAck) => void) => {
      const result = joinLobby(payload.code?.toUpperCase(), {
        userId: user.id,
        displayName: user.displayName ?? user.login ?? 'Player',
        image: user.image,
        villainId: null,
        joinedAt: new Date(),
      });

      if ('error' in result) {
        socket.emit(SOCKET_EVENTS.GAME.LOBBY_ERROR, { error: result.error });
        cb?.({ success: false, error: result.error });
        return;
      }

      socket.join(getLobbyRoom(result.lobby.code));

      if ('alreadyIn' in result && result.alreadyIn) {
        // Resync: send current state only to this socket
        socket.emit(SOCKET_EVENTS.GAME.LOBBY_UPDATED, serialize(result.lobby));
      } else {
        io.to(getLobbyRoom(result.lobby.code)).emit(
          SOCKET_EVENTS.GAME.LOBBY_UPDATED,
          serialize(result.lobby),
        );
      }

      console.log('[Game] User', user.id, 'joined lobby', result.lobby.code);
      cb?.({ success: true, code: result.lobby.code });
    },
  );

  socket.on(SOCKET_EVENTS.GAME.LOBBY_LEAVE, () => {
    handleLeave(io, socket, user.id);
  });

  socket.on(
    SOCKET_EVENTS.GAME.LOBBY_KICK,
    ({ userId }: KickPlayerPayload) => {
      const currentLobby = getLobbyByUserId(user.id);
      if (!currentLobby) return;

      const result = kickPlayer(currentLobby.code, user.id, userId);
      if ('error' in result) {
        socket.emit(SOCKET_EVENTS.GAME.LOBBY_ERROR, { error: result.error });
        return;
      }

      io.to(`user:${userId}`).emit(SOCKET_EVENTS.GAME.LOBBY_KICKED, {
        code: currentLobby.code,
      });

      // Remove kicked player's sockets from the lobby room so they stop receiving events
      const kickedSocketIds = getUserSocketIds(userId);
      for (const socketId of kickedSocketIds) {
        const kickedSocket = io.sockets.sockets.get(socketId);
        kickedSocket?.leave(getLobbyRoom(currentLobby.code));
      }

      io.to(getLobbyRoom(result.lobby.code)).emit(
        SOCKET_EVENTS.GAME.LOBBY_UPDATED,
        serialize(result.lobby),
      );

      console.log('[Game] User', userId, 'kicked from', currentLobby.code);
    },
  );

  socket.on(
    SOCKET_EVENTS.GAME.VILLAIN_SELECT,
    ({ villainId }: SelectVillainPayload) => {
      const currentLobby = getLobbyByUserId(user.id);
      if (!currentLobby) return;

      const result = selectVillain(currentLobby.code, user.id, villainId);
      if ('error' in result) {
        socket.emit(SOCKET_EVENTS.GAME.LOBBY_ERROR, { error: result.error });
        return;
      }

      io.to(getLobbyRoom(result.lobby.code)).emit(
        SOCKET_EVENTS.GAME.LOBBY_UPDATED,
        serialize(result.lobby),
      );
    },
  );

  socket.on(
    SOCKET_EVENTS.GAME.MATCH_START,
    (_payload: unknown, cb?: (ack: LobbyAck) => void) => {
      const currentLobby = getLobbyByUserId(user.id);
      if (!currentLobby) return;

      const result = startGame(currentLobby.code, user.id);
      if ('error' in result) {
        socket.emit(SOCKET_EVENTS.GAME.LOBBY_ERROR, { error: result.error });
        cb?.({ success: false, error: result.error });
        return;
      }

      io.to(getLobbyRoom(result.lobby.code)).emit(
        SOCKET_EVENTS.GAME.MATCH_STARTED,
        serialize(result.lobby),
      );

      console.log('[Game] Match started in lobby', result.lobby.code);
      cb?.({ success: true });
    },
  );
}

export function handleLeave(
  io: Server,
  socket: Socket,
  userId: number,
): void {
  const currentLobby = getLobbyByUserId(userId);
  if (!currentLobby) return;

  const lobbyRoom = getLobbyRoom(currentLobby.code);
  const { lobby } = leaveLobby(userId);

  socket.leave(lobbyRoom);

  if (lobby) {
    io.to(lobbyRoom).emit(SOCKET_EVENTS.GAME.LOBBY_UPDATED, serialize(lobby));
  }

  console.log('[Game] User', userId, 'left lobby', currentLobby.code);
}
