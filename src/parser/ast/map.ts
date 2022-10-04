import { ASTBase, ASTBaseOptions, ASTType } from './base';

export interface ASTMapKeyStringOptions extends ASTBaseOptions {
  key: ASTBase;
  value: ASTBase;
}

export class ASTMapKeyString extends ASTBase {
  key: ASTBase;
  value: ASTBase;

  constructor(options: ASTMapKeyStringOptions) {
    super(ASTType.MapKeyString, options);
    this.key = options.key;
    this.value = options.value;
  }

  toString(): string {
    return `MapKeyString[${this.key.toString()}: ${this.value.toString()}]`;
  }
}

export interface ASTMapConstructorExpressionOptions extends ASTBaseOptions {
  fields?: ASTMapKeyString[];
}

export class ASTMapConstructorExpression extends ASTBase {
  fields: ASTMapKeyString[];

  constructor(options: ASTMapConstructorExpressionOptions) {
    super(ASTType.MapConstructorExpression, options);
    this.fields = options.fields || [];
  }

  toString(): string {
    if (this.fields.length === 0) {
      return `MapConstructor[]`;
    }

    const body = this.fields.map((item) => `${item.start.line}: ${item.toString()}`)
      .join('\n')
      .split('\n')
      .map((item) => `\t${item}`)
      .join('\n');

    return `MapConstructor[\n${body}\n]`;
  }
}
