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
}

export class ASTChunk extends ASTBaseBlockWithScope {
  nativeImports: string[];
  literals: ASTBase[];
  scopes: ASTBaseBlockWithScope[];

  constructor(options: ASTChunkOptions) {
    super(ASTType.Chunk, options);
    this.nativeImports = options.nativeImports || [];
    this.literals = options.literals || [];
    this.scopes = options.scopes || [];
  }
}
