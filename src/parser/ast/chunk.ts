import { ASTChunkAdvanced, ASTChunkAdvancedOptions } from 'greybel-core';
import { ASTImportCodeExpression } from './import-code';

export interface ASTChunkGreyScriptOptions extends ASTChunkAdvancedOptions {
  nativeImports?: ASTImportCodeExpression[];
}

export class ASTChunkGreyScript extends ASTChunkAdvanced {
  nativeImports: ASTImportCodeExpression[];

  constructor(options: ASTChunkGreyScriptOptions) {
    super(options);
    this.nativeImports = options.nativeImports || [];
  }

  clone(): ASTChunkGreyScript {
    return new ASTChunkGreyScript({
      nativeImports: this.nativeImports.map((it) => it.clone()),
      imports: this.imports.map((it) => it.clone()),
      includes: this.includes.map((it) => it.clone()),
      literals: this.literals.map((it) => it.clone()),
      scopes: this.scopes.map((it) => it.clone()),
      lines: this.lines,
      start: this.start,
      end: this.end,
      range: this.range,
      scope: this.scope
    });
  }
}
