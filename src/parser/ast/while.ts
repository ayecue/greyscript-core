import { ASTBase, ASTBaseBlock, ASTBaseBlockOptions, ASTType } from './base';

export interface ASTWhileStatementOptions extends ASTBaseBlockOptions {
  condition: ASTBase;
}

export class ASTWhileStatement extends ASTBaseBlock {
  condition: ASTBase;

  constructor(options: ASTWhileStatementOptions) {
    super(ASTType.WhileStatement, options);
    this.condition = options.condition;
  }
}
