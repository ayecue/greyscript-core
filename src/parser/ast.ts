import { ASTProvider as BaseAstProvider } from 'greybel-core';

import { ASTChunkGreyScript, ASTChunkGreyScriptOptions } from './ast/chunk';
import {
  ASTImportCodeExpression,
  ASTImportCodeExpressionOptions
} from './ast/import-code';

export class ASTProvider extends BaseAstProvider {
  chunkAdvanced(options: ASTChunkGreyScriptOptions): ASTChunkGreyScript {
    return new ASTChunkGreyScript(options);
  }

  importCodeExpression(
    options: ASTImportCodeExpressionOptions
  ): ASTImportCodeExpression {
    return new ASTImportCodeExpression(options);
  }
}

export { ASTType } from './ast/base';
export { ASTChunkGreyScript, ASTChunkGreyScriptOptions } from './ast/chunk';
export {
  ASTImportCodeExpression,
  ASTImportCodeExpressionOptions
} from './ast/import-code';
