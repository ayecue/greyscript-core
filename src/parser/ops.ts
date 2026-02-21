import { greybelKeywordHandlerBuilder } from 'greybel-core/dist/parser/ops';
import { TokenType } from 'miniscript-core/dist/lexer/token';
import MiniscriptParser from 'miniscript-core/dist/parser';
import {
  buildKeywordOpIndex,
  KeywordHandlerBuilder
} from 'miniscript-core/dist/parser/ops/keyword';
import { KeywordOp } from 'miniscript-core/dist/types/ops';
import { Range as ASTRange } from 'miniscript-core/dist/types/range';

import type Parser from '../parser';
import { Selectors } from '../types/selector';
import { ASTImportCodeExpression, ASTProvider } from './ast';

function handleImportCode(parser: MiniscriptParser): void {
  const me = parser as Parser;
  me.next();
  const startToken = me.previousToken;

  if (!me.consume(Selectors.LParenthesis)) {
    me.raise(
      `expected import_code to have opening parenthesis`,
      new ASTRange(
        [startToken.line, startToken.startChar],
        [me.token.lastLine ?? me.token.line, me.token.endChar]
      )
    );
    const invalid = me.parseInvalidCode();
    me.lineRegistry.register(invalid);
    me.attachPendingComments(invalid);
    me.backpatches.peek().body.push(invalid);
    return;
  }

  let directory: string | undefined;

  if (me.isType(TokenType.StringLiteral)) {
    directory = me.token.value;
    me.next();
  } else {
    me.raise(
      `expected import_code argument to be string literal`,
      new ASTRange(
        [startToken.line, startToken.startChar],
        [me.token.lastLine ?? me.token.line, me.token.endChar]
      )
    );
    const invalid = me.parseInvalidCode();
    me.lineRegistry.register(invalid);
    me.attachPendingComments(invalid);
    me.backpatches.peek().body.push(invalid);
    return;
  }

  if (me.consume(Selectors.ImportCodeSeparator)) {
    if (!me.isType(TokenType.StringLiteral)) {
      me.raise(
        `expected import_code argument to be string literal`,
        new ASTRange(
          [startToken.line, startToken.startChar],
          [me.token.lastLine ?? me.token.line, me.token.endChar]
        )
      );
      const invalid = me.parseInvalidCode();
      me.lineRegistry.register(invalid);
      me.attachPendingComments(invalid);
      me.backpatches.peek().body.push(invalid);
      return;
    }

    directory = me.token.value;
    console.warn(
      `Warning: Second import_code argument is deprecated. Use the first argument for the file system path instead.`
    );

    me.next();
  }

  if (!me.consume(Selectors.RParenthesis)) {
    me.raise(
      `expected import_code to have closing parenthesis`,
      new ASTRange(
        [startToken.line, startToken.startChar],
        [me.token.lastLine ?? me.token.line, me.token.endChar]
      )
    );
    const invalid = me.parseInvalidCode();
    me.lineRegistry.register(invalid);
    me.attachPendingComments(invalid);
    me.backpatches.peek().body.push(invalid);
    return;
  }

  const endToken = me.previousToken;
  let currentDirectory = directory;
  let shouldEmit = true;
  let shouldEval = true;

  if (me.isType(TokenType.Comment)) {
    const options = ASTImportCodeExpression.parseMetaOptions(me.token.value);

    shouldEmit = options.emit;
    shouldEval = options.eval;

    if (options.directory) {
      currentDirectory = options.directory;
    }
  }

  const item = (me.astProvider as ASTProvider).importCodeExpression({
    originalDirectory: directory!,
    directory: currentDirectory!,
    emit: shouldEmit,
    eval: shouldEval,
    startLine: startToken.line,
    startChar: startToken.startChar,
    endLine: endToken.endLine,
    endChar: endToken.endChar,
    rangeStart: startToken.rangeStart,
    rangeEnd: endToken.rangeEnd,
    scope: me.currentScope
  });

  me.nativeImports.push(item);
  me.lineRegistry.register(item);
  me.attachPendingComments(item);
  me.backpatches.peek().body.push(item);
}

export function greyscriptKeywordHandlerBuilder(): KeywordHandlerBuilder {
  return greybelKeywordHandlerBuilder().add(
    Selectors.ImportCode.selectorId,
    handleImportCode
  );
}

export const greyscriptKeywordOps: KeywordOp[] = buildKeywordOpIndex(
  greyscriptKeywordHandlerBuilder().build()
);
