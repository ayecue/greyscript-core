import { ASTBase, ASTBaseOptions, ASTType } from './base';

export interface ASTCallStatementOptions extends ASTBaseOptions {
  expression: ASTBase;
}

export class ASTCallStatement extends ASTBase {
  expression: ASTBase;

  constructor(options: ASTCallStatementOptions) {
    super(ASTType.CallStatement, options);
    this.expression = options.expression;
  }
}

export interface ASTCallExpressionOptions extends ASTBaseOptions {
  base: ASTBase;
  arguments?: ASTBase[];
}

export class ASTCallExpression extends ASTBase {
  base: ASTBase;
  arguments: ASTBase[];

  constructor(options: ASTCallExpressionOptions) {
    super(ASTType.CallExpression, options);
    this.base = options.base;
    this.arguments = options.arguments || [];
  }
}
