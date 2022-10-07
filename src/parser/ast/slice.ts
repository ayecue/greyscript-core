import { ASTBase, ASTBaseOptions, ASTType } from './base';

export interface ASTSliceExpressionOptions extends ASTBaseOptions {
  left: ASTBase;
  right: ASTBase;
}

export class ASTSliceExpression extends ASTBase {
  left: ASTBase;
  right: ASTBase;

  constructor(options: ASTSliceExpressionOptions) {
    super(ASTType.SliceExpression, options);
    this.left = options.left;
    this.right = options.right;
  }

  toString(): string {
    return `SliceExpression[${this.left.toString()}:${this.right.toString()}]`;
  }
}
