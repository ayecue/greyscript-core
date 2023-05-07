import { ASTBase, ASTBaseOptions, ASTType } from './base';

export interface ASTImportCodeExpressionOptions extends ASTBaseOptions {
  gameDirectory: string;
  fileSystemDirectory: string;
}

export class ASTImportCodeExpression extends ASTBase {
  gameDirectory: string;
  fileSystemDirectory: string;

  constructor(options: ASTImportCodeExpressionOptions) {
    super(ASTType.ImportCodeExpression, options);
    this.gameDirectory = options.gameDirectory;
    this.fileSystemDirectory = options.fileSystemDirectory;
  }

  toString(): string {
    return `ImportCode[${this.start}-${this.end}][${this.gameDirectory}]`;
  }
}
