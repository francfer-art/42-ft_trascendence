export interface TranslationData {
  loginPage: {
    title: string;
    emailPlaceholder: string;
    passwordPlaceholder: string;
    enterButton: string;
    or: string;
    continueWith42: string;
    newHere: string;
    forgotPassword: string;
    signupTitle: string;
    repeatPasswordPlaceholder: string;
    passwordTooShort: string;
    passwordMismatch: string;
    createAccount: string;
    alreadyHaveAccount: string;
    welcomeTo: string;
    tagline: string;
    emailRequired: string;
    invalidEmail: string;
    passwordRequired: string;
    repeatRequired: string;
    loginNotFound: string;
    loginWrongPassword: string;
    loginVerifyEmail: string;
    loginFailed: string;
    signupEmailExists: string;
    signupFailed: string;
    networkError: string;
  };

  homePage: {
    title: string;
    description: string;
    login: string;
    viewprofile: string;

    home: string;
    play: string;
    friends: string;
    chat: string;
    profile: string;
    notifications: string;
    myGames: string;
    settings: string;
    logout: string;

    realmAwaits: string;
    welcomeBack: string;
    destinyAwaits: string;

    createGame: string;
    createGameDescription: string;
    joinGame: string;
    joinGameDescription: string;

    yourBattles: string;
    yourGames: string;
    viewAll: string;
    playingAs: string;
    yourTurn: string;
    waiting: string;

    howToPlayTitle: string;
    howToPlayDescription: string;
    explore: string;

    scarCarouselDescription: string;
    maleficentCarouselDescription: string;
    'captain-hookCarouselDescription': string;
    hadesCarouselDescription: string;
  };

  howToPage: {
    backToHome: string;
    objectiveTitle: string;
    realmTitle: string;
    realmDescription: string;
    realmLocationOrder: string;
    successionPile: string;
    scarSubtitle: string;
    'captain-hookSubtitle': string;
    maleficentSubtitle: string;
    hadesSubtitle: string;

    villainGuideTitle: string;

    scarGuide: string;
    hadesGuide: string;
    'captain-hookGuide': string;
    maleficentGuide: string;

    cardTypeALLY: string;
    cardTypeEFFECT: string;
    cardTypeITEM: string;
    cardTypeHERO: string;
    cardTypeCONDITION: string;
    cardTypeCURSE: string;
    cardTypeTITAN: string;

    copyNumber: string;

    portrait: string;
    title: string;
    basicRulesDescription: string;
    yourTurn: string;
    stepMoveTitle: string;
    stepMoveText: string;
    stepActTitle: string;
    stepActText: string;
    stepDrawTitle: string;
    stepDrawText: string;
    chooseVillain: string;
    viewGuide: string;
    villainNotFoundTitle: string;
    villainNotFoundText: string;
    loadErrorTitle: string;
    loadErrorText: string;
    seeAllVillains: string;
    retry: string;
  };

  actions: {
    PLAY_CARD: string;
    GAIN_POWER: string;
    FATE: string;
    VANQUISH: string;
    DISCARD_CARDS: string;
    MOVE_ITEM_OR_ALLY: string;
    MOVE_HERO: string;
    ACTIVATE: string;
  };

  cardTypes: {
    ALLY: string;
    CONDITION: string;
    CURSE: string;
    EFFECT: string;
    HERO: string;
    ITEM: string;
    TITAN: string;
  };

  decks: {
    VILLAIN: string;
    FATE: string;
  };

  notFoundPage: {
    eyebrow: string;
    backToRealm: string;
    goBack: string;
    [key: string]: string;
  };
}

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
    FRIEND_ACCEPT: 'social.friend.accept',

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

export interface MessageSendPayload {
  message: string;
}

export interface MessageReceivedPayload {
  id: string;
  user: {
    id: number;
    displayName: string;
    avatarUrl: string | null;
  };
  message: string;
  createdAt: string;
}

export interface SystemConnectedPayload {
  socketId: string;
  userId: number;
}

export interface SystemErrorPayload {
  code: string;
  message: string;
}
