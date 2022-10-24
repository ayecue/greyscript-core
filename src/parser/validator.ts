import general from 'greyscript-meta/dist/signatures/general.json';

import { TokenType } from '../lexer/token';
import { Keyword } from '../types/keywords';
import { Operator } from '../types/operators';
import { Selector } from '../types/selector';

export default class Validator {
  getBreakingBlockShortcutKeywords(): string[] {
    return [
      Keyword.If,
      Keyword.Else,
      Keyword.ElseIf,
      Operator.EndOfFile,
      Keyword.EndFor,
      Keyword.EndWhile,
      Keyword.EndFunction,
      Keyword.EndIf
    ];
  }

  getNatives(): string[] {
    return [
      'globals',
      'locals',
      'outer',
      'self',
      'params',
      'string',
      'list',
      'map',
      'number',
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
      Operator.Isa,
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

  isExpressionOperator(selector: Selector): boolean {
    return (
      (selector.type === TokenType.Punctuator ||
        selector.type === TokenType.Keyword) &&
      this.getExpressionOperators().indexOf(selector.value as Operator) !== -1
    );
  }
}
