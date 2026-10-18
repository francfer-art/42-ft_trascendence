import type { Prisma } from '@prisma/client';
import { prisma } from '../../utils/prisma';
import type { CardDetail } from '../../types/villains.types';

type CardWithDetails = Prisma.CardGetPayload<{
  include: { translations: true; deck: true };
}>;

export class CardPrismaModel {
  static async getById(
    id: string,
    language: string,
  ): Promise<CardDetail | null> {
    const card = await prisma.card.findUnique({
      where: {
        id,
      },
      include: {
        translations: {
          where: {
            language,
          },
        },
        deck: true,
      },
    });

    if (!card) {
      return null;
    }

    return this.toCardDetail(card, language);
  }

  static async getByVillainId(
    villainId: string,
    language: string,
  ): Promise<CardDetail[] | null> {
    const villain = await prisma.villain.findUnique({
      where: { id: villainId },
      select: { id: true },
    });

    if (!villain) {
      return null;
    }

    const cards = await prisma.card.findMany({
      where: { villainId },
      include: {
        translations: { where: { language } },
        deck: true,
      },
      orderBy: { id: 'asc' },
    });

    return cards.map((card) => this.toCardDetail(card, language));
  }

  private static toCardDetail(card: CardWithDetails, language: string): CardDetail {
    const translation = card.translations[0];

    if (!translation) {
      throw new Error(`Translation "${language}" not found for card "${card.id}"`);
    }

    return {
      id: card.id,
      villainId: card.villainId,
      quantity: card.quantity,
      type: card.type,
      cost: card.cost,
      strength: card.strength,
      imagePath: card.imagePath,
      name: translation.name,
      text: translation.text,

      deck: {
        type: card.deck.type,
        backImagePath: card.deck.backImagePath,
        bottomPowerImagePath: card.deck.bottomPowerImagePath,
        bottomPowerlessImagePath: card.deck.bottomPowerlessImagePath,
      },
    };
  }
}
