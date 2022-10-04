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
    const body = this.fields.map((item) => item.toString()).join('\n');

    return `MapConstructor[\n${body}\n]`;
  }
}
