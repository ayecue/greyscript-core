import { ASTBase, ASTBaseOptions } from 'miniscript-core';

import { ASTType } from './base';

export interface ASTImportCodeExpressionOptions extends ASTBaseOptions {
  directory: string;
  ignore: boolean;
  emit: boolean;
}

export class ASTImportCodeExpression extends ASTBase {
  directory: string;
  ignore: boolean;
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
      ignore: metaTags['ignore'] != null,
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
    this.directory = options.directory;
    this.ignore = options.ignore;
    this.emit = options.emit;
  }

  toString(): string {
    return `ImportCode[${this.start}-${this.end}][${this.directory};${this.ignore};${this.emit}]`;
  }

  clone(): ASTImportCodeExpression {
    return new ASTImportCodeExpression({
      directory: this.directory,
      ignore: this.ignore,
      emit: this.emit,
      start: this.start,
      end: this.end,
      range: this.range,
      scope: this.scope
    });
  }
}
