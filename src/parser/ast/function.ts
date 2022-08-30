import {
  ASTBase,
  ASTBaseBlockWithScope,
  ASTBaseBlockWithScopeOptions,
  ASTType
} from './base';

export interface ASTFunctionStatementOptions
  extends ASTBaseBlockWithScopeOptions {
  parameters?: ASTBase[];
}

export class ASTFunctionStatement extends ASTBaseBlockWithScope {
  parameters: ASTBase[];

  constructor(options: ASTFunctionStatementOptions) {
    super(ASTType.FunctionDeclaration, options);
    this.parameters = options.parameters || [];
  }
}
