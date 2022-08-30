import { ASTBase, ASTBaseOptions, ASTType } from './base';

export interface ASTListValueOptions extends ASTBaseOptions {
  value: ASTBase;
}

export class ASTListValue extends ASTBase {
  value: ASTBase;

  constructor(options: ASTListValueOptions) {
    super(ASTType.ListValue, options);
    this.value = options.value;
  }
}

export interface ASTListConstructorExpressionOptions extends ASTBaseOptions {
  fields?: ASTListValue[];
}

export class ASTListConstructorExpression extends ASTBase {
  fields: ASTListValue[];

  constructor(options: ASTListConstructorExpressionOptions) {
    super(ASTType.ListConstructorExpression, options);
    this.fields = options.fields || [];
  }
}
