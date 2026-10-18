export const SOCKET_EVENTS = {
  SYSTEM: {
    CONNECTED: 'system.connected',
    DISCONNECTED: 'system.disconnected',
    ERROR: 'system.error',
  },

  SOCIAL: {
    MESSAGE_SEND: 'social.message.send',
    MESSAGE_RECEIVED: 'social.message.received',

    FRIEND_REQUEST: 'social.friend.request',
    FRIEND_REQUESTED: 'social.friend.requested',

    FRIEND_ACCEPT: 'social.friend.accept',
    FRIEND_ACCEPTED: 'social.friend.accepted',

    PRESENCE_CHANGED: 'social.presence.changed',
  },

  GAME: {
    INVITATION_SEND: 'game.invitation.send',
    INVITATION_ACCEPT: 'game.invitation.accept',
    INVITATION_REJECT: 'game.invitation.reject',

    LOBBY_CREATE: 'game.lobby.create',
    LOBBY_JOIN: 'game.lobby.join',
    LOBBY_LEAVE: 'game.lobby.leave',
    LOBBY_READY: 'game.lobby.ready',
    LOBBY_KICK: 'game.lobby.kick',
    LOBBY_UPDATED: 'game.lobby.updated',
    LOBBY_KICKED: 'game.lobby.kicked',
    LOBBY_ERROR: 'game.lobby.error',

    VILLAIN_SELECT: 'game.villain.select',

    MATCH_START: 'game.match.start',
    MATCH_END: 'game.match.end',
    MATCH_STARTED: 'game.match.started',

    TURN_PLAY: 'game.turn.play',
    TURN_DRAW: 'game.turn.draw',

    CARD_PLAY: 'game.card.play',
    CARD_DRAW: 'game.card.draw',
  },
} as const;
