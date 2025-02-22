import { ASTBase, ASTBaseOptions } from 'miniscript-core';

import { ASTType } from './base';

export interface ASTImportCodeExpressionOptions extends ASTBaseOptions {
  originalDirectory: string;
  directory: string;
  eval: boolean;
  emit: boolean;
}

export class ASTImportCodeExpression extends ASTBase {
  originalDirectory: string;
  directory: string;
  eval: boolean;
  emit: boolean;

  static parseMetaOptions(meta: string): Partial<ASTImportCodeExpressionOptions> {
    const segments = meta.split(';');
    const metaTags = segments.reduce<Record<string, boolean | string>>((result, item) => {
      const [key, value] = item.trim().split('=');
      if (value == null) {
        result[key] = true;
      } else {
        result[key] = value;
      }
      return result;
    }, {});
    const options = {
      eval: metaTags['no-eval'] == null,
      emit: metaTags['no-emit'] == null
    } as Partial<ASTImportCodeExpressionOptions>;

    if (metaTags['override'] != null) {
      options.directory = metaTags['override'] as string;
    }

    return options;
  };

  /** @deprecated use gameDirectory for file system directory instead */
  fileSystemDirectory: string;

  constructor(options: ASTImportCodeExpressionOptions) {
    super(ASTType.ImportCodeExpression, options);
    this.originalDirectory = options.originalDirectory;
    this.directory = options.directory;
    this.eval = options.eval;
    this.emit = options.emit;
  }

  toString(): string {
    return `ImportCode[${this.start}-${this.end}][${this.directory};${this.eval};${this.emit}]`;
  }

  clone(): ASTImportCodeExpression {
    return new ASTImportCodeExpression({
      originalDirectory: this.originalDirectory,
      directory: this.directory,
      eval: this.eval,
      emit: this.emit,
      start: this.start,
      end: this.end,
      range: this.range,
      scope: this.scope
    });
  }
}
