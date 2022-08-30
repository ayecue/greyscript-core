import {
  ASTBase,
  ASTBaseBlockWithScope,
  ASTBaseBlockWithScopeOptions,
  ASTType
} from './base';

export interface ASTChunkOptions extends ASTBaseBlockWithScopeOptions {
  nativeImports?: string[];
  literals?: ASTBase[];
}

export class ASTChunk extends ASTBaseBlockWithScope {
  nativeImports: string[];
  literals: ASTBase[];

  constructor(options: ASTChunkOptions) {
    super(ASTType.Chunk, options);
    this.nativeImports = options.nativeImports || [];
    this.literals = options.literals || [];
  }
}
