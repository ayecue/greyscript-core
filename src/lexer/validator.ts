import { LexerValidator } from 'greybel-core';

import { GreyScriptKeyword } from '../types/keywords';

export default class Validator extends LexerValidator {
  getKeywords(index: number): string[] {
    const baseKeywords = super.getKeywords(index);

    switch (index) {
      case 11:
        return [...baseKeywords, GreyScriptKeyword.ImportCode];
      default:
        return baseKeywords;
    }
  }

  isKeyword(value: string): boolean {
    const length = value.length;
    const keywords = this.getKeywords(length);

    return keywords.indexOf(value) !== -1;
  }
}
