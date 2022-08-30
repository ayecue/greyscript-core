import { TokenType } from '../lexer/token';
import {
  ASTAssignmentStatement,
  ASTAssignmentStatementOptions
} from './ast/assignment';
import {
  ASTBase,
  ASTBaseBlock,
  ASTBaseBlockOptions,
  ASTBaseOptions,
  ASTComment,
  ASTCommentOptions,
  ASTType
} from './ast/base';
import {
  ASTCallExpression,
  ASTCallExpressionOptions,
  ASTCallStatement,
  ASTCallStatementOptions
} from './ast/call';
import { ASTChunk, ASTChunkOptions } from './ast/chunk';
import {
  ASTEvaluationExpression,
  ASTEvaluationExpressionOptions
} from './ast/evaluation';
import {
  ASTForGenericStatement,
  ASTForGenericStatementOptions
} from './ast/for';
import {
  ASTFunctionStatement,
  ASTFunctionStatementOptions
} from './ast/function';
import {
  ASTIdentifier,
  ASTIdentifierOptions,
  ASTIndexExpression,
  ASTIndexExpressionOptions,
  ASTMemberExpression,
  ASTMemberExpressionOptions
} from './ast/identifier';
import {
  ASTElseClause,
  ASTIfClause,
  ASTIfClauseOptions,
  ASTIfStatement,
  ASTIfStatementOptions
} from './ast/if';
import {
  ASTImportCodeExpression,
  ASTImportCodeExpressionOptions
} from './ast/import-code';
import {
  ASTListConstructorExpression,
  ASTListConstructorExpressionOptions,
  ASTListValue,
  ASTListValueOptions
} from './ast/list';
import { ASTLiteral, ASTLiteralOptions } from './ast/literal';
import {
  ASTMapConstructorExpression,
  ASTMapConstructorExpressionOptions,
  ASTMapKeyString,
  ASTMapKeyStringOptions
} from './ast/map';
import { ASTReturnStatement, ASTReturnStatementOptions } from './ast/return';
import { ASTSliceExpression, ASTSliceExpressionOptions } from './ast/slice';
import { ASTUnaryExpression, ASTUnaryExpressionOptions } from './ast/unary';
import { ASTWhileStatement, ASTWhileStatementOptions } from './ast/while';

export class ASTProvider {
  lines: Map<number, ASTBase> = new Map<number, ASTBase>();

  addLines(item: ASTBaseBlock): ASTBaseBlock {
    for (const line of item.body) {
      this.lines.set(line.start.line, line);
    }
    return item;
  }

  breakStatement(options: ASTBaseOptions): ASTBase {
    return new ASTBase(ASTType.BreakStatement, options);
  }

  continueStatement(options: ASTBaseOptions): ASTBase {
    return new ASTBase(ASTType.ContinueStatement, options);
  }

  returnStatement(options: ASTReturnStatementOptions): ASTReturnStatement {
    return new ASTReturnStatement(options);
  }

  ifShortcutStatement(options: ASTIfStatementOptions): ASTIfStatement {
    return new ASTIfStatement(ASTType.IfShortcutStatement, options);
  }

  ifShortcutClause(options: ASTIfClauseOptions): ASTIfClause {
    return this.addLines(
      new ASTIfClause(ASTType.IfShortcutClause, options)
    ) as ASTIfClause;
  }

  elseifShortcutClause(options: ASTIfClauseOptions): ASTIfClause {
    return this.addLines(
      new ASTIfClause(ASTType.ElseifShortcutClause, options)
    ) as ASTIfClause;
  }

  elseShortcutClause(options: ASTBaseBlockOptions): ASTElseClause {
    return this.addLines(
      new ASTElseClause(ASTType.ElseShortcutClause, options)
    ) as ASTElseClause;
  }

  ifStatement(options: ASTIfStatementOptions): ASTIfStatement {
    return new ASTIfStatement(ASTType.IfStatement, options);
  }

  ifClause(options: ASTIfClauseOptions): ASTIfClause {
    return this.addLines(
      new ASTIfClause(ASTType.IfClause, options)
    ) as ASTIfClause;
  }

  elseifClause(options: ASTIfClauseOptions): ASTIfClause {
    return this.addLines(
      new ASTIfClause(ASTType.ElseifClause, options)
    ) as ASTIfClause;
  }

  elseClause(options: ASTBaseBlockOptions): ASTElseClause {
    return this.addLines(
      new ASTElseClause(ASTType.ElseClause, options)
    ) as ASTElseClause;
  }

  whileStatement(options: ASTWhileStatementOptions): ASTWhileStatement {
    return this.addLines(new ASTWhileStatement(options)) as ASTWhileStatement;
  }

  assignmentStatement(
    options: ASTAssignmentStatementOptions
  ): ASTAssignmentStatement {
    return new ASTAssignmentStatement(options);
  }

  callStatement(options: ASTCallStatementOptions): ASTCallStatement {
    return new ASTCallStatement(options);
  }

  functionStatement(
    options: ASTFunctionStatementOptions
  ): ASTFunctionStatement {
    return this.addLines(
      new ASTFunctionStatement(options)
    ) as ASTFunctionStatement;
  }

  forGenericStatement(
    options: ASTForGenericStatementOptions
  ): ASTForGenericStatement {
    return this.addLines(
      new ASTForGenericStatement(options)
    ) as ASTForGenericStatement;
  }

  chunk(options: ASTChunkOptions): ASTChunk {
    return this.addLines(new ASTChunk(options)) as ASTChunk;
  }

  identifier(options: ASTIdentifierOptions): ASTIdentifier {
    return new ASTIdentifier(options);
  }

  literal(
    type:
      | TokenType.StringLiteral
      | TokenType.NumericLiteral
      | TokenType.BooleanLiteral
      | TokenType.NilLiteral,
    options: ASTLiteralOptions
  ): ASTLiteral {
    return new ASTLiteral(type, options);
  }

  memberExpression(options: ASTMemberExpressionOptions): ASTMemberExpression {
    return new ASTMemberExpression(options);
  }

  callExpression(options: ASTCallExpressionOptions): ASTCallExpression {
    return new ASTCallExpression(options);
  }

  comment(options: ASTCommentOptions): ASTComment {
    return new ASTComment(options);
  }

  unaryExpression(options: ASTUnaryExpressionOptions): ASTUnaryExpression {
    return new ASTUnaryExpression(options);
  }

  mapKeyString(options: ASTMapKeyStringOptions): ASTMapKeyString {
    return new ASTMapKeyString(options);
  }

  mapConstructorExpression(
    options: ASTMapConstructorExpressionOptions
  ): ASTMapConstructorExpression {
    return new ASTMapConstructorExpression(options);
  }

  listValue(options: ASTListValueOptions): ASTListValue {
    return new ASTListValue(options);
  }

  listConstructorExpression(
    options: ASTListConstructorExpressionOptions
  ): ASTListConstructorExpression {
    return new ASTListConstructorExpression(options);
  }

  emptyExpression(options: ASTBaseOptions): ASTBase {
    return new ASTBase(ASTType.EmptyExpression, options);
  }

  invalidCodeExpression(options: ASTBaseOptions): ASTBase {
    return new ASTBase(ASTType.InvalidCodeExpression, options);
  }

  indexExpression(options: ASTIndexExpressionOptions): ASTIndexExpression {
    return new ASTIndexExpression(options);
  }

  binaryExpression(
    options: ASTEvaluationExpressionOptions
  ): ASTEvaluationExpression {
    return new ASTEvaluationExpression(options);
  }

  sliceExpression(options: ASTSliceExpressionOptions): ASTSliceExpression {
    return new ASTSliceExpression(options);
  }

  importCodeExpression(
    options: ASTImportCodeExpressionOptions
  ): ASTImportCodeExpression {
    return new ASTImportCodeExpression(options);
  }
}

export {
  ASTAssignmentStatement,
  ASTAssignmentStatementOptions
} from './ast/assignment';
export {
  ASTBase,
  ASTBaseBlock,
  ASTBaseBlockOptions,
  ASTBaseBlockWithScope,
  ASTBaseBlockWithScopeOptions,
  ASTBaseOptions,
  ASTComment,
  ASTCommentOptions,
  Position as ASTPosition,
  ASTType
} from './ast/base';
export {
  ASTCallExpression,
  ASTCallExpressionOptions,
  ASTCallStatement,
  ASTCallStatementOptions
} from './ast/call';
export { ASTChunk, ASTChunkOptions } from './ast/chunk';
export {
  ASTEvaluationExpression,
  ASTEvaluationExpressionOptions
} from './ast/evaluation';
export {
  ASTForGenericStatement,
  ASTForGenericStatementOptions
} from './ast/for';
export {
  ASTFunctionStatement,
  ASTFunctionStatementOptions
} from './ast/function';
export {
  ASTIdentifier,
  ASTIdentifierOptions,
  ASTIndexExpression,
  ASTIndexExpressionOptions,
  ASTMemberExpression,
  ASTMemberExpressionOptions
} from './ast/identifier';
export {
  ASTClause,
  ASTElseClause,
  ASTIfClause,
  ASTIfClauseOptions,
  ASTIfStatement,
  ASTIfStatementOptions
} from './ast/if';
export {
  ASTImportCodeExpression,
  ASTImportCodeExpressionOptions
} from './ast/import-code';
export {
  ASTListConstructorExpression,
  ASTListConstructorExpressionOptions,
  ASTListValue,
  ASTListValueOptions
} from './ast/list';
export { ASTLiteral, ASTLiteralOptions } from './ast/literal';
export {
  ASTMapConstructorExpression,
  ASTMapConstructorExpressionOptions,
  ASTMapKeyString,
  ASTMapKeyStringOptions
} from './ast/map';
export { ASTReturnStatement, ASTReturnStatementOptions } from './ast/return';
export { ASTSliceExpression, ASTSliceExpressionOptions } from './ast/slice';
export { ASTUnaryExpression, ASTUnaryExpressionOptions } from './ast/unary';
export { ASTWhileStatement, ASTWhileStatementOptions } from './ast/while';
