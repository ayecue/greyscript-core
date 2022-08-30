import { ASTBase, ASTBaseOptions, ASTType } from './base';

export interface ASTIdentifierOptions extends ASTBaseOptions {
  name: string;
}

export class ASTIdentifier extends ASTBase {
  name: string;

  constructor(options: ASTIdentifierOptions) {
    super(ASTType.Identifier, options);
    this.name = options.name;
  }
}

export interface ASTMemberExpressionOptions extends ASTBaseOptions {
  indexer: string;
  identifier: ASTBase;
  base: ASTBase;
}

export class ASTMemberExpression extends ASTBase {
  indexer: string;
  identifier: ASTBase;
  base: ASTBase;

  constructor(options: ASTMemberExpressionOptions) {
    super(ASTType.MemberExpression, options);
    this.indexer = options.indexer;
    this.identifier = options.identifier;
    this.base = options.base;
  }
}

export interface ASTIndexExpressionOptions extends ASTBaseOptions {
  base: ASTBase;
  index: ASTBase;
}

export class ASTIndexExpression extends ASTBase {
  base: ASTBase;
  index: ASTBase;

  constructor(options: ASTIndexExpressionOptions) {
    super(ASTType.IndexExpression, options);
    this.base = options.base;
    this.index = options.index;
  }
}