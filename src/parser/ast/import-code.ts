import { ASTBase, ASTBaseOptions, ASTType } from './base';

export interface ASTImportCodeExpressionOptions extends ASTBaseOptions {
  directory: string;
}

export class ASTImportCodeExpression extends ASTBase {
  directory: string;

  /** @deprecated use gameDirectory for file system directory instead */
  fileSystemDirectory: string;

  constructor(options: ASTImportCodeExpressionOptions) {
    super(ASTType.ImportCodeExpression, options);
    this.directory = options.directory;
  }

  toString(): string {
    return `ImportCode[${this.start}-${this.end}][${this.directory}]`;
  }

  clone(): ASTImportCodeExpression {
    return new ASTImportCodeExpression({
      directory: this.directory,
      start: this.start,
      end: this.end,
      scope: this.scope
    });
  }
}
