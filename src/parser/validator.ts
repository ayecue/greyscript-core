import general from 'greyscript-meta/dist/signatures/general.json';

import { TokenType } from '../lexer/token';

export default class Validator {
  getNatives(): string[] {
    return [
      'globals',
      'locals',
      'outer',
      'self',
      'super',
      'params',
      'string',
      'list',
      'map',
      'number',
      'funcRef',
      ...Object.keys(general).map((name: string) => {
        return name;
      })
    ];
  }

  getNonNilLiterals(): TokenType[] {
    return [
      TokenType.StringLiteral,
      TokenType.NumericLiteral,
      TokenType.BooleanLiteral
    ];
  }

  getLiterals(): TokenType[] {
    return [...this.getNonNilLiterals(), TokenType.NilLiteral];
  }

  isNative(value: string): boolean {
    return this.getNatives().indexOf(value) !== -1;
  }

  isNonNilLiteral(type: TokenType): boolean {
    return this.getNonNilLiterals().indexOf(type) !== -1;
  }

  isLiteral(type: TokenType): boolean {
    return this.getLiterals().indexOf(type) !== -1;
  }
}
