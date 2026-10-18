import { Router } from 'express';
import { CardController } from '../controllers/card.controller';
import { VillainController } from '../controllers/villain.controller';
import type {
  CardModelContract,
  VillainModelContract,
} from '../types/villains.types';

export const createVillainRouter = (
  villainModel: VillainModelContract,
  cardModel: CardModelContract,
) => {
  const villainRouter = Router();

  const villainController = new VillainController(villainModel);
  const cardController = new CardController(cardModel);

  villainRouter.get('/', villainController.getAll);
  villainRouter.get('/:villainId/cards', cardController.getByVillainId);
  villainRouter.get('/:villainId', villainController.getById);

  return villainRouter;
};
