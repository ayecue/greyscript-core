import {
  ASTBase,
  ASTBaseBlockWithScope,
  ASTBaseBlockWithScopeOptions,
  ASTType
} from './base';

export interface ASTChunkOptions extends ASTBaseBlockWithScopeOptions {
  nativeImports?: string[];
  literals?: ASTBase[];
  scopes?: ASTBaseBlockWithScope[];
  lines?: Map<number, ASTBase[]>;
}

export class ASTChunk extends ASTBaseBlockWithScope {
  nativeImports: string[];
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
}
