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

  clone(): ASTChunk {
    return new ASTChunk({
      nativeImports: this.nativeImports.map((it) => it.clone()),
      literals: this.literals.map((it) => it.clone()),
      scopes: this.scopes.map((it) => it.clone()),
      lines: this.lines,
      start: this.start,
      end: this.end,
      scope: this.scope
    });
  }
}
