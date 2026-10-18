const activeConnections = new Map<number, Set<string>>();

export function markUserOnline(userId: number, socketId: string) {
  const sockets = activeConnections.get(userId) ?? new Set<string>();
  sockets.add(socketId);
  activeConnections.set(userId, sockets);
}

export function markUserOffline(userId: number, socketId: string) {
  const sockets = activeConnections.get(userId);

  if (!sockets) {
    return;
  }

  sockets.delete(socketId);

  if (sockets.size === 0) {
    activeConnections.delete(userId);
  }
}

export function isUserOnline(userId: number) {
  return (activeConnections.get(userId)?.size ?? 0) > 0;
}

export function getUserSocketIds(userId: number): Set<string> {
  return activeConnections.get(userId) ?? new Set<string>();
}
