import { ASTChunkGreybel, ASTChunkGreybelOptions } from 'greybel-core/dist/parser/ast';
import { ASTImportCodeExpression } from './import-code';

export interface ASTChunkGreyScriptOptions extends ASTChunkGreybelOptions {
  nativeImports?: ASTImportCodeExpression[];
}

export class ASTChunkGreyScript extends ASTChunkGreybel {
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
      registry: this._reg,
      startLine: this.startLine,
      startChar: this.startChar,
      endLine: this.endLine,
      endChar: this.endChar,
      rangeStart: this.rangeStart,
      rangeEnd: this.rangeEnd,
      scope: this.scope
    });
  }
}
