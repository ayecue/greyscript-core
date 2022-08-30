import general from 'greyscript-meta/dist/signatures/general.json';

import { TokenType } from '../lexer/token';
import { Operator } from '../types/operators';

export default class Validator {
  getBreakingBlockShortcutKeywords(): string[] {
    return [
      'if',
      'else',
      'else if',
      '<eof>',
      'end for',
      'end while',
      'end function',
      'end if'
    ];
  }

  getNatives(): string[] {
    return [
      'globals',
      'locals',
      'self',
      'params',
      // missing in meta
      'hasIndex',
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

  getExpressionOperators(): Operator[] {
    return [
      Operator.Plus,
      Operator.Asterik,
      Operator.Minus,
      Operator.Slash,
      Operator.PercentSign,
      Operator.LessThan,
      Operator.GreaterThan,
      Operator.LessThanOrEqual,
      Operator.GreaterThanOrEqual,
      Operator.NotEqual,
      Operator.Equal,
      Operator.Or,
      Operator.And,
      Operator.BitwiseAnd,
      Operator.BitwiseOr,
      Operator.Xor,
      Operator.LeftShift,
      Operator.RightShift,
      Operator.UnsignedRightShift
    ];
  }

  isBreakingBlockShortcutKeyword(value: string): boolean {
    return this.getBreakingBlockShortcutKeywords().indexOf(value) !== -1;
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

  isExpressionOperator(value: Operator): boolean {
    return this.getExpressionOperators().indexOf(value) !== -1;
  }
}
