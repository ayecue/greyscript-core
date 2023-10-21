import {
  ASTBase,
  ASTBaseBlockWithScope,
  ASTBaseBlockWithScopeOptions,
  ASTType
} from './base';
import { ASTImportCodeExpression } from './import-code';

export interface ASTChunkOptions extends ASTBaseBlockWithScopeOptions {
  nativeImports?: ASTImportCodeExpression[];
  literals?: ASTBase[];
  scopes?: ASTBaseBlockWithScope[];
  lines?: Map<number, ASTBase[]>;
}

export class ASTChunk extends ASTBaseBlockWithScope {
  nativeImports: ASTImportCodeExpression[];
  literals: ASTBase[];
  scopes: ASTBaseBlockWithScope[];
  lines: Map<number, ASTBase[]>;

  constructor(options: ASTChunkOptions) {
    super(ASTType.Chunk, options);
    this.nativeImports = options.nativeImports || [];
    this.literals = options.literals || [];
    this.scopes = options.scopes || [];
    this.lines = options.lines || new Map<number, ASTBase[]>();
  }

  toString(): string {
    if (this.body.length === 0) {
      return `Chunk[${this.start}-${this.end}][]`;
    }

    const body = this.body
      .map((item) => `${item}`)
      .join('\n')
      .split('\n')
      .map((item) => `\t${item}`)
      .join('\n');

    return `Chunk[${this.start}-${this.end}][\n${body}\n]`;
  }

  clone(): ASTChunk {
    return new ASTChunk({
      nativeImports: this.nativeImports,
      literals: this.literals,
      scopes: this.scopes,
      lines: this.lines,
      start: this.start,
      end: this.end,
      scope: this.scope
    });
  }
}
