import { TokenType } from '../../lexer/token';
import { ASTBase, ASTBaseOptions, ASTType } from './base';

export interface ASTLiteralOptions extends ASTBaseOptions {
  value: string | number | boolean;
}

export class ASTLiteral extends ASTBase {
  value: string | number | boolean;

  static getLiteralType(type: TokenType): ASTType {
    switch (type) {
      case TokenType.BooleanLiteral:
        return ASTType.BooleanLiteral;
      case TokenType.StringLiteral:
        return ASTType.StringLiteral;
      case TokenType.NumericLiteral:
        return ASTType.NumericLiteral;
      case TokenType.NilLiteral:
        return ASTType.NilLiteral;
      default:
        throw new Error('Invalid token type.');
    }
  }

  constructor(
    type:
      | TokenType.StringLiteral
      | TokenType.NumericLiteral
      | TokenType.BooleanLiteral
      | TokenType.NilLiteral,
    options: ASTLiteralOptions
  ) {
    super(ASTLiteral.getLiteralType(type), options);
    this.value = options.value;
  }

  toString(): string {
    return `Literal[${this.start}-${this.end}][${this.value}]`;
  }
}
