import { ASTBase, ASTBaseBlock, ASTBaseBlockOptions, ASTType } from './base';

export interface ASTForGenericStatementOptions extends ASTBaseBlockOptions {
  variable: ASTBase;
  iterator: ASTBase;
}

export class ASTForGenericStatement extends ASTBaseBlock {
  variable: ASTBase;
  iterator: ASTBase;

  constructor(options: ASTForGenericStatementOptions) {
    super(ASTType.ForGenericStatement, options);
    this.variable = options.variable;
    this.iterator = options.iterator;
  }
}
