export interface CreateLobbyPayload {
  // empty for now
}

export interface JoinLobbyPayload {
  code: string;
}

export interface KickPlayerPayload {
  userId: number;
}

export interface SelectVillainPayload {
  villainId: string;
}

export interface LobbyAck {
  success: boolean;
  code?: string;
  error?: string;
}

export interface SerializedLobbyPlayer {
  userId: number;
  displayName: string;
  image: string | null;
  villainId: string | null;
}

export interface SerializedLobby {
  code: string;
  hostId: number;
  players: SerializedLobbyPlayer[];
  maxPlayers: number;
  isPrivate: boolean;
  status: string;
}
