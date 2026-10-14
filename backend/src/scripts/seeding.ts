import { readFile, readdir } from 'node:fs/promises';
import bcrypt from 'bcrypt';
import { prisma } from '../utils/prisma';
import { DeckType } from '@prisma/client';

interface VillainImageFile {
  id: string;
  path: string;
  width: number;
  height: number;
  mimeType: string;
  sourcePage?: string;
  sourceUrl?: string;
}

interface CardTranslationFile {
  name: string;
  text: string;
}

interface VillainTranslationFile {
  name: string;
  objective: string;
  locations: Record<string, string>;
  cards: Record<string, CardTranslationFile>;
}

interface RealmActionFile {
  type: string;
  amount?: number;
}

interface RealmLocationFile {
  id: string;
  position: number;
  topActions: RealmActionFile[];
  bottomActions: RealmActionFile[];
}

interface CardFile {
  id: string;
  quantity: number;
  type: string;
  cost: number | null;
  strength: number | null;
  image: CardImageFile;
}

interface DeckFile {
  totalCards: number;
  backImagePath: string;
  bottomImagePath: string;
  cards: CardFile[];
}

interface CardImageFile {
  path: string;
}

interface VillainFile {
  id: string;
  translations: Record<string, VillainTranslationFile>;
  images: VillainImageFile[];
  realm: RealmLocationFile[];
  decks: Record<string, DeckFile>;
}

type SharedTranslationFile = Record<string, Record<string, string>>; // key → language → value

async function seedSharedTranslations(filename: string) {
  const fileUrl = new URL(
    `../../json/${filename}`,
    import.meta.url,
  );
  const content = await readFile(fileUrl, 'utf-8');
  const translations = JSON.parse(content) as SharedTranslationFile;

  for (const [key, languages] of Object.entries(translations)) {
    for (const [language, value] of Object.entries(languages)) {
      await prisma.translation.upsert({
        where: {
          key_language: {
            key,
            language,
          },
        },
        update: {
          value,
        },
        create: {
          key,
          language,
          value,
        },
      });

      console.log(`Shared translation imported: ${key}/${language}`);
    }
  }
}

const TEST_USERS = [
  { email: 'a@a.com',   password: '123123123', login: 'player_one',   name: 'Alice Darkness',  firstName: 'Alice',   lastName: 'Darkness',  displayName: 'Alice' },
  { email: 'b@b.com',   password: '123123123', login: 'player_two',   name: 'Bob Shadow',      firstName: 'Bob',     lastName: 'Shadow',    displayName: 'Bob' },
  { email: 'c@c.com',   password: '123123123', login: 'player_three', name: 'Carol Grimm',     firstName: 'Carol',   lastName: 'Grimm',     displayName: 'Carol' },
  { email: 'd@d.com',   password: '123123123', login: 'player_four',  name: 'Dave Vile',       firstName: 'Dave',    lastName: 'Vile',      displayName: 'Dave' },
];

async function seedTestUsers() {
  const passwordHash = await bcrypt.hash('123123123', 12);

  for (const u of TEST_USERS) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email,
        name: u.name,
        login: u.login,
        firstName: u.firstName,
        lastName: u.lastName,
        displayName: u.displayName,
        passwordHash,
        emailVerified: true,
      },
    });

    console.log(`Test user upserted: ${u.email} (${u.login})`);
  }
}

async function main() {
  if (process.env.SEED_TEST_USERS !== 'false') {
    await seedTestUsers();
  }

  await seedSharedTranslations('translations/game.json');
  await seedSharedTranslations('translations/loginPage.json');
  await seedSharedTranslations('translations/notFoundPage.json');
  await seedSharedTranslations('content.json');

  const directoryUrl = new URL('../../json/villains/', import.meta.url);

  const files = await readdir(directoryUrl);

  const jsonFiles = files.filter((file: string) => file.endsWith('.json'));
  // const jsonFiles = ['scar.json'];

  for (const file of jsonFiles) {
    const fileUrl = new URL(file, directoryUrl);
    const content = await readFile(fileUrl, 'utf-8');
    const data = JSON.parse(content) as VillainFile;

    // console.log(`Importing villain from: ${file}`);

    const villain = await prisma.villain.upsert({
      where: { id: data.id },
      update: {},
      create: { id: data.id },
    });

    for (const [deckId, deck] of Object.entries(data.decks)) {
      // Select the back image path from the villain's images where id = villainDeckBack

      const deckType = deckId === 'villain' ? DeckType.VILLAIN : DeckType.FATE;

      const backImageId =
        deckType === DeckType.VILLAIN ? 'villainDeckBack' : 'fateDeckBack';

      const backImageElement = data.images.find(
        (image) => image.id === backImageId,
      );

      if (!backImageElement) {
        throw new Error('imagePath not found');
      }

      const backImagePath = backImageElement.path;

      // Building this path: backend/assets/scar/cropped-images/scar-power-fate-clean.webp
      const bottomPowerImagePath =
        '/assets/' +
        data.id +
        '/cropped-images/' +
        data.id +
        '-power-' +
        deckId +
        '-clean.webp';

      const bottomPowerlessImagePath =
        '/assets/' +
        data.id +
        '/cropped-images/' +
        data.id +
        '-powerless-' +
        deckId +
        '-clean.webp';

      await prisma.deck.upsert({
        where: {
          villainId_type: {
            villainId: data.id,
            type: deckType,
          },
        },
        update: {
          backImagePath: backImagePath,
          bottomPowerImagePath: bottomPowerImagePath,
          bottomPowerlessImagePath: bottomPowerlessImagePath,
        },
        create: {
          villainId: data.id,
          type: deckType,
          backImagePath: backImagePath,
          bottomPowerImagePath: bottomPowerImagePath,
          bottomPowerlessImagePath: bottomPowerlessImagePath,
        },
      });

      console.log(`Deck imported: ${data.id}/${deckId}`);

      for (const card of deck.cards) {
        // Need to substitute in card image path the substring "cards" with "cropped-images"
        const cardImagePath = card.image.path.replace(
          'cards',
          'cropped-images',
        );

        const cardData = {
          villainId: data.id,
          deckType,
          quantity: card.quantity,
          type: card.type,
          cost: card.cost,
          strength: card.strength,
          imagePath: cardImagePath,
        };

        await prisma.card.upsert({
          where: {
            id: card.id,
          },
          update: cardData,
          create: {
            id: card.id,
            ...cardData,
          },
        });

        console.log(`Card imported: ${data.id}/${deckId}/${card.id}`);

        for (const [language, translation] of Object.entries(
          data.translations,
        )) {
          const cardTranslation = translation.cards[card.id];

          if (!cardTranslation) {
            throw new Error(
              `Card translation missing: ${data.id}/${card.id}/${language}`,
            );
          }

          await prisma.cardTranslation.upsert({
            where: {
              cardId_language: {
                cardId: card.id,
                language,
              },
            },
            update: {
              name: cardTranslation.name,
              text: cardTranslation.text,
            },
            create: {
              cardId: card.id,
              language,
              name: cardTranslation.name,
              text: cardTranslation.text,
            },
          });

          console.log(`Card translation imported: ${card.id}/${language}`);
        }
      }
    }

    console.log('Villain imported:', villain);

    for (const [language, translation] of Object.entries(data.translations)) {
      await prisma.villainTranslation.upsert({
        where: {
          villainId_language: {
            villainId: data.id,
            language,
          },
        },
        update: {
          name: translation.name,
          objective: translation.objective,
        },
        create: {
          villainId: data.id,
          language,
          name: translation.name,
          objective: translation.objective,
        },
      });

      console.log(`Translation imported: ${language}`);
    }

    for (const image of data.images) {
      const imageData = {
        path: image.path,
        width: image.width,
        height: image.height,
        mimeType: image.mimeType,
        sourcePage: image.sourcePage ?? null,
        sourceUrl: image.sourceUrl ?? null,
      };

      await prisma.villainImage.upsert({
        where: {
          villainId_id: {
            villainId: data.id,
            id: image.id,
          },
        },
        update: imageData,
        create: {
          villainId: data.id,
          id: image.id,
          ...imageData,
        },
      });

      console.log(`Image imported: ${image.id}`);
    }

    for (const location of data.realm) {
      await prisma.realmLocation.upsert({
        where: {
          villainId_id: {
            villainId: data.id,
            id: location.id,
          },
        },
        update: {
          position: location.position,
        },
        create: {
          villainId: data.id,
          id: location.id,
          position: location.position,
        },
      });

      console.log(`Realm location imported: ${location.id}`);

      for (const [index, action] of location.topActions.entries()) {
        const position = index + 1;

        await prisma.realmAction.upsert({
          where: {
            villainId_locationId_area_position: {
              villainId: data.id,
              locationId: location.id,
              area: 'TOP',
              position,
            },
          },
          update: {
            type: action.type,
            amount: action.amount ?? null,
          },
          create: {
            villainId: data.id,
            locationId: location.id,
            area: 'TOP',
            position,
            type: action.type,
            amount: action.amount ?? null,
          },
        });

        console.log(
          `Top action imported: ${location.id}/${position}/${action.type}`,
        );
      }

      for (const [index, action] of location.bottomActions.entries()) {
        const position = index + 1;

        await prisma.realmAction.upsert({
          where: {
            villainId_locationId_area_position: {
              villainId: data.id,
              locationId: location.id,
              area: 'BOTTOM',
              position,
            },
          },
          update: {
            type: action.type,
            amount: action.amount ?? null,
          },
          create: {
            villainId: data.id,
            locationId: location.id,
            area: 'BOTTOM',
            position,
            type: action.type,
            amount: action.amount ?? null,
          },
        });

        console.log(
          `Bottom action imported: ${location.id}/${position}/${action.type}`,
        );
      }

      for (const [language, translation] of Object.entries(data.translations)) {
        const locationName = translation.locations[location.id];

        if (!locationName) {
          throw new Error(
            `Translation missing: ${data.id}/${location.id}/${language}`,
          );
        }

        await prisma.realmLocationTranslation.upsert({
          where: {
            villainId_locationId_language: {
              villainId: data.id,
              locationId: location.id,
              language,
            },
          },
          update: {
            name: locationName,
          },
          create: {
            villainId: data.id,
            locationId: location.id,
            language,
            name: locationName,
          },
        });

        console.log(
          `Location translation imported: ${location.id}/${language}`,
        );
      }
    }

  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
