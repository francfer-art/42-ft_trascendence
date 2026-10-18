import type { Server, Socket } from 'socket.io';
import { SOCKET_EVENTS } from '../socket.events';
import { getUserRoom } from '../socket.rooms';
import { markUserOffline, markUserOnline } from '../presence.store';
import { scheduleLeave, cancelLeave } from '../game/game.handlers';

export function registerSystemHandlers(io: Server, socket: Socket) {
  const userId = socket.data.user.id;
  const userRoom = getUserRoom(userId);

  socket.join(userRoom);
  markUserOnline(userId, socket.id);
  cancelLeave(userId); // Cancel any pending lobby-leave timer from a prior disconnect

  console.log('[System] User joined room:', {
    userId,
    room: userRoom,
  });

  socket.emit(SOCKET_EVENTS.SYSTEM.CONNECTED, {
    socketId: socket.id,
    userId,
  });

  io.emit(SOCKET_EVENTS.SOCIAL.PRESENCE_CHANGED, {
    userId,
    status: 'online',
  });

  socket.on('disconnect', (reason) => {
    markUserOffline(userId, socket.id);
    scheduleLeave(io, socket, userId); // 8s grace period before removing from lobby

    console.log('[System] Socket disconnected:', {
      socketId: socket.id,
      userId,
      reason,
    });

    io.emit(SOCKET_EVENTS.SOCIAL.PRESENCE_CHANGED, {
      userId,
      status: 'offline',
    });
  });
}
