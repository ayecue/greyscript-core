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

  toString(): string {
    const args = this.parameters.map((item) => item.toString()).join(', ');

    if (this.body.length === 0) {
      return `${this.type}[${args}]`;
    }

    const body = this.body.map((item) => `${item.start.line}: ${item.toString()}`)
      .join('\n')
      .split('\n')
      .map((item) => `\t${item}`)
      .join('\n');

    return `Function[${args} =>\n${body}\n]`;
  }
}
