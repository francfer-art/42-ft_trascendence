import { Router } from 'express';
import { CardController } from '../controllers/card.controller';
import type { CardModelContract } from '../types/villains.types';

export const createCardRouter = (cardModel: CardModelContract) => {
  const cardRouter = Router();

  const cardController = new CardController(cardModel);

  cardRouter.get('/:cardId', cardController.getById);

  return cardRouter;
};
