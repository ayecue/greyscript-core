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

  toString(): string {
    if (this.body.length === 0) {
      return `WhileStatement[${this.condition.toString()}]`;
    }

    const body = this.body.map((item) => `${item.start.line}: ${item.toString()}`)
      .join('\n')
      .split('\n')
      .map((item) => `\t${item}`)
      .join('\n');

    return `WhileStatement[${this.condition.toString()}\n${body}\n]`;
  }
}
