import type { Request, Response } from 'express';
import { getRequestedLanguage } from '../utils/language';
import type { CardModelContract } from '../types/villains.types';

export class CardController {
  constructor(private cardModel: CardModelContract) {}

  getById = async (req: Request<{ cardId: string }>, res: Response) => {
    const cardId = req.params.cardId.toLowerCase();
    const language = getRequestedLanguage(req.query.lang);

    const card = await this.cardModel.getById(cardId, language);

    if (!card) {
      return res.status(404).json({
        message: `Card "${cardId}" not found`,
      });
    }

    return res.json(card);
  };

  getByVillainId = async (req: Request<{ villainId: string }>, res: Response) => {
    const villainId = req.params.villainId.toLowerCase();
    const language = getRequestedLanguage(req.query.lang);
    const cards = await this.cardModel.getByVillainId(villainId, language);

    if (!cards) {
      return res.status(404).json({
        message: `Villain "${villainId}" not found`,
      });
    }

    return res.json(cards);
  };
}
