export interface Card {
  id: string;
  quantity: number;
  type: string;
  cost: number | null;
  strength: number | null;
  imagePath: string;
  name: string;
  text: string;
}

export interface Deck {
  type: 'VILLAIN' | 'FATE';
  backImagePath: string;
  bottomPowerImagePath: string;
  bottomPowerlessImagePath: string;
  cards: Card[];
}

export interface RealmAction {
  area: 'TOP' | 'BOTTOM';
  position: number;
  type: string;
  amount: number | null;
}

export interface RealmLocationTranslation {
  name: string;
}

export interface RealmLocation {
  id: string;
  name: string;
  position: number;
  actions: RealmAction[];
}

export interface Villain {
  id: string;
  name: string;
  images: VillainImage[];
  objective: string;
}

export interface VillainDetail extends Villain {
  realm: RealmLocation[];
  decks: Deck[];
}

export interface VillainImage {
  id: string;
  path: string;
  width: number;
  height: number;
  mimeType: string;
  sourcePage: string | null;
  sourceUrl: string | null;
}

export interface VillainModelContract {
  getAll(language: string): Promise<Villain[]>;
  getById(id: string, language: string): Promise<VillainDetail | null>;
}

export interface CardDeck {
  type: 'VILLAIN' | 'FATE';
  backImagePath: string;
  bottomPowerImagePath: string;
  bottomPowerlessImagePath: string;
}

export interface CardDetail extends Card {
  villainId: string;
  deck: CardDeck;
}

export interface CardModelContract {
  getById(id: string, language: string): Promise<CardDetail | null>;
  getByVillainId(villainId: string, language: string): Promise<CardDetail[] | null>;
}
