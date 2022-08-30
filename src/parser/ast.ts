import { TokenType } from '../lexer/token';
import {
  ASTAssignmentStatement,
  ASTAssignmentStatementOptions
} from './ast/assignment';
import {
  ASTBase,
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
  lines: Map<number, ASTBase[]> = new Map<number, ASTBase[]>();

  addLine(item: ASTBase): ASTBase {
    const line = this.lines.get(item.start.line) || [];
    line.push(item);
    this.lines.set(item.start.line, line);
    return item;
  }

  breakStatement(options: ASTBaseOptions): ASTBase {
    return this.addLine(new ASTBase(ASTType.BreakStatement, options));
  }

  continueStatement(options: ASTBaseOptions): ASTBase {
    return this.addLine(new ASTBase(ASTType.ContinueStatement, options));
  }

  returnStatement(options: ASTReturnStatementOptions): ASTReturnStatement {
    return this.addLine(new ASTReturnStatement(options));
  }

  ifShortcutStatement(options: ASTIfStatementOptions): ASTIfStatement {
    return this.addLine(
      new ASTIfStatement(ASTType.IfShortcutStatement, options)
    ) as ASTIfStatement;
  }

  ifShortcutClause(options: ASTIfClauseOptions): ASTIfClause {
    return this.addLine(
      new ASTIfClause(ASTType.IfShortcutClause, options)
    ) as ASTIfClause;
  }

  elseifShortcutClause(options: ASTIfClauseOptions): ASTIfClause {
    return this.addLine(
      new ASTIfClause(ASTType.ElseifShortcutClause, options)
    ) as ASTIfClause;
  }

  elseShortcutClause(options: ASTBaseBlockOptions): ASTElseClause {
    return this.addLine(
      new ASTElseClause(ASTType.ElseShortcutClause, options)
    ) as ASTElseClause;
  }

  ifStatement(options: ASTIfStatementOptions): ASTIfStatement {
    return this.addLine(
      new ASTIfStatement(ASTType.IfStatement, options)
    ) as ASTIfStatement;
  }

  ifClause(options: ASTIfClauseOptions): ASTIfClause {
    return this.addLine(
      new ASTIfClause(ASTType.IfClause, options)
    ) as ASTIfClause;
  }

  elseifClause(options: ASTIfClauseOptions): ASTIfClause {
    return this.addLine(
      new ASTIfClause(ASTType.ElseifClause, options)
    ) as ASTIfClause;
  }

  elseClause(options: ASTBaseBlockOptions): ASTElseClause {
    return this.addLine(
      new ASTElseClause(ASTType.ElseClause, options)
    ) as ASTElseClause;
  }

  whileStatement(options: ASTWhileStatementOptions): ASTWhileStatement {
    return this.addLine(new ASTWhileStatement(options)) as ASTWhileStatement;
  }

  assignmentStatement(
    options: ASTAssignmentStatementOptions
  ): ASTAssignmentStatement {
    return this.addLine(
      new ASTAssignmentStatement(options)
    ) as ASTAssignmentStatement;
  }

  callStatement(options: ASTCallStatementOptions): ASTCallStatement {
    return this.addLine(new ASTCallStatement(options)) as ASTCallStatement;
  }

  functionStatement(
    options: ASTFunctionStatementOptions
  ): ASTFunctionStatement {
    return this.addLine(
      new ASTFunctionStatement(options)
    ) as ASTFunctionStatement;
  }

  forGenericStatement(
    options: ASTForGenericStatementOptions
  ): ASTForGenericStatement {
    return this.addLine(
      new ASTForGenericStatement(options)
    ) as ASTForGenericStatement;
  }

  chunk(options: ASTChunkOptions): ASTChunk {
    return this.addLine(new ASTChunk(options)) as ASTChunk;
  }

  identifier(options: ASTIdentifierOptions): ASTIdentifier {
    return this.addLine(new ASTIdentifier(options)) as ASTIdentifier;
  }

  literal(
    type:
      | TokenType.StringLiteral
      | TokenType.NumericLiteral
      | TokenType.BooleanLiteral
      | TokenType.NilLiteral,
    options: ASTLiteralOptions
  ): ASTLiteral {
    return this.addLine(new ASTLiteral(type, options)) as ASTLiteral;
  }

  memberExpression(options: ASTMemberExpressionOptions): ASTMemberExpression {
    return this.addLine(
      new ASTMemberExpression(options)
    ) as ASTMemberExpression;
  }

  callExpression(options: ASTCallExpressionOptions): ASTCallExpression {
    return this.addLine(new ASTCallExpression(options)) as ASTCallExpression;
  }

  comment(options: ASTCommentOptions): ASTComment {
    return this.addLine(new ASTComment(options)) as ASTComment;
  }

  unaryExpression(options: ASTUnaryExpressionOptions): ASTUnaryExpression {
    return this.addLine(new ASTUnaryExpression(options)) as ASTUnaryExpression;
  }

  mapKeyString(options: ASTMapKeyStringOptions): ASTMapKeyString {
    return this.addLine(new ASTMapKeyString(options)) as ASTMapKeyString;
  }

  mapConstructorExpression(
    options: ASTMapConstructorExpressionOptions
  ): ASTMapConstructorExpression {
    return this.addLine(
      new ASTMapConstructorExpression(options)
    ) as ASTMapConstructorExpression;
  }

  listValue(options: ASTListValueOptions): ASTListValue {
    return this.addLine(new ASTListValue(options)) as ASTListValue;
  }

  listConstructorExpression(
    options: ASTListConstructorExpressionOptions
  ): ASTListConstructorExpression {
    return this.addLine(
      new ASTListConstructorExpression(options)
    ) as ASTListConstructorExpression;
  }

  emptyExpression(options: ASTBaseOptions): ASTBase {
    return this.addLine(new ASTBase(ASTType.EmptyExpression, options));
  }

  invalidCodeExpression(options: ASTBaseOptions): ASTBase {
    return this.addLine(new ASTBase(ASTType.InvalidCodeExpression, options));
  }

  indexExpression(options: ASTIndexExpressionOptions): ASTIndexExpression {
    return this.addLine(new ASTIndexExpression(options)) as ASTIndexExpression;
  }

  binaryExpression(
    options: ASTEvaluationExpressionOptions
  ): ASTEvaluationExpression {
    return this.addLine(
      new ASTEvaluationExpression(options)
    ) as ASTEvaluationExpression;
  }

  sliceExpression(options: ASTSliceExpressionOptions): ASTSliceExpression {
    return this.addLine(new ASTSliceExpression(options)) as ASTSliceExpression;
  }

  importCodeExpression(
    options: ASTImportCodeExpressionOptions
  ): ASTImportCodeExpression {
    return this.addLine(
      new ASTImportCodeExpression(options)
    ) as ASTImportCodeExpression;
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
