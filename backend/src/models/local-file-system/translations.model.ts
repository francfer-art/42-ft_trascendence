import { readFile } from 'node:fs/promises';
import type { Translation } from '../../types/translations.types';

const contentFile = new URL('../../../json/content.json', import.meta.url);

export class TranslationsJsonModel {
  static async getByLanguage(language: string): Promise<Translation[]> {
    const content = await readFile(contentFile, 'utf-8');
    const translations = JSON.parse(content) as Record<string, Record<string, string>>;

    const result: Translation[] = [];

    for (const [key, languages] of Object.entries(translations)) {
      const value = languages[language];

      if (typeof value === 'string') {
        result.push({ key, value });
      }
    }

    return result;
  }

  static async getByNamespace(namespace: string, language: string): Promise<Translation[]> {
    
    const translations = await this.getByLanguage(language);

    return translations.filter(({ key }) => key.startsWith(`${namespace}.`));
  }
}
