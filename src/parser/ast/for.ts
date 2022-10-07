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

  toString(): string {
    if (this.body.length === 0) {
      return `${this.type}[${this.variable.toString()} in ${this.iterator.toString()}]`;
    }

    const body = this.body.map((item) => `${item.start.line}: ${item.toString()}`)
      .join('\n')
      .split('\n')
      .map((item) => `\t${item}`)
      .join('\n');

    return `For[${this.variable.toString()} in ${this.iterator.toString()}\n${body}\n]`;
  }
}
