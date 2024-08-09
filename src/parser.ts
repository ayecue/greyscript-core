import {
  ASTBase,
  TokenType,
  ASTFunctionStatement,
  isPendingChunk,
  PendingChunk,
  PendingFunction
} from 'miniscript-core';
import {
  Parser as ParserBase,
  ParserOptions as ParserOptionsBase,
  SelectorGroups,
  Selectors
} from 'greybel-core';
import { Position } from 'miniscript-core/dist/types/position';
import { Range } from 'miniscript-core/dist/types/range';
import { ASTChunkGreyScript, ASTImportCodeExpression, ASTProvider } from './parser/ast';
import Lexer from './lexer';
import { GreyScriptKeyword } from './types/keywords';

export interface ParserOptions extends ParserOptionsBase {
  astProvider?: ASTProvider;
  lexer?: Lexer;
}

export default class Parser extends ParserBase {
  nativeImports: ASTImportCodeExpression[];
  astProvider: ASTProvider;

  constructor(content: string, options: ParserOptions = {}) {
    options.lexer =
      options.lexer ||
      new Lexer(content, {
        unsafe: options.unsafe,
        tabWidth: options.tabWidth
      });
    options.astProvider = options.astProvider || new ASTProvider();
    super(content, options);

    const me = this;

    me.nativeImports = [];
  }

  parseStatement(): void {
    const me = this;

    if (me.isType(TokenType.Keyword)) {
      const value = me.token.value;

      switch (value) {
        case GreyScriptKeyword.ImportCode:
          me.next();
          const item = me.parseNativeImportCodeStatement();
          me.addItemToLines(item);
          me.backpatches.peek().body.push(item);
          return;
        default:
          break;
      }
    }

    return super.parseStatement();
  }

  parseFunctionDeclaration(
    base: ASTBase,
    asLval: boolean = false,
    statementStart: boolean = false
  ): ASTFunctionStatement | ASTBase {
    const me = this;

    if (!Selectors.Function(me.token)) return me.parseOr(asLval, statementStart);

    me.next();

    const functionStart = me.previousToken.start;
    const functionStatement = me.astProvider.functionStatement({
      start: functionStart,
      end: null,
      scope: me.currentScope,
      parent: me.outerScopes[me.outerScopes.length - 1],
      assignment: me.currentAssignment
    });
    const parameters = [];

    me.pushScope(functionStatement);

    if (!SelectorGroups.BlockEndOfLine(me.token)) {
      me.requireToken(Selectors.LParenthesis, functionStart);

      while (!SelectorGroups.FunctionDeclarationArgEnd(me.token)) {
        const parameter = me.parseIdentifier();
        const parameterStart = parameter.start;

        if (me.consume(Selectors.Assign)) {
          const defaultValue = me.parseExpr(null);
          const assign = me.astProvider.assignmentStatement({
            variable: parameter,
            init: defaultValue,
            start: parameterStart,
            end: me.previousToken.end,
            scope: me.currentScope
          });

          me.currentScope.assignments.push(assign);
          parameters.push(assign);
        } else {
          const assign = me.astProvider.assignmentStatement({
            variable: parameter,
            init: me.astProvider.unknown({
              start: parameterStart,
              end: me.previousToken.end,
              scope: me.currentScope
            }),
            start: parameterStart,
            end: me.previousToken.end,
            scope: me.currentScope
          });

          me.currentScope.assignments.push(assign);
          parameters.push(parameter);
        }

        if (Selectors.RParenthesis(me.token)) break;
        me.requireToken(Selectors.ArgumentSeperator, functionStart);
        if (Selectors.RParenthesis(me.token)) {
          me.raise('expected argument instead received right parenthesis', new Range(
            me.previousToken.end,
            me.previousToken.end
          ));
          break;
        }
      }

      me.requireToken(Selectors.RParenthesis, functionStart);
    }

    functionStatement.parameters = parameters;

    const pendingBlock = new PendingFunction(functionStatement);
    me.backpatches.push(pendingBlock);
    pendingBlock.onComplete = (it) => {
      if (base !== null) {
        base.end = it.block.end;
        me.addItemToLines(base);
      } else {
        me.addItemToLines(it.block);
      }
    };

    return functionStatement;
  }

  parseNativeImportCodeStatement(): ASTImportCodeExpression | ASTBase {
    const me = this;
    const start = me.previousToken.start;

    if (!me.consume(Selectors.LParenthesis)) {
      me.raise(
        `expected import_code to have opening parenthesis`,
        new Range(
          start,
          new Position(
            me.token.lastLine ?? me.token.line,
            me.token.end.character
          )
        )
      );

      return me.parseInvalidCode();
    }

    let directory;

    if (TokenType.StringLiteral === me.token.type) {
      directory = me.token.value;
      me.next();
    } else {
      me.raise(
        `expected import_code argument to be string literal`,
        new Range(
          start,
          new Position(
            me.token.lastLine ?? me.token.line,
            me.token.end.character
          )
        )
      );

      return me.parseInvalidCode();
    }

    if (me.consume(Selectors.ImportCodeSeperator)) {
      if (!me.isType(TokenType.StringLiteral)) {
        me.raise(
          `expected import_code argument to be string literal`,
          new Range(
            start,
            new Position(
              me.token.lastLine ?? me.token.line,
              me.token.end.character
            )
          )
        );

        return me.parseInvalidCode();
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
        new Range(
          start,
          new Position(
            me.token.lastLine ?? me.token.line,
            me.token.end.character
          )
        )
      );

      return me.parseInvalidCode();
    }

    const base = me.astProvider.importCodeExpression({
      directory,
      start,
      end: me.previousToken.end,
      scope: me.currentScope
    });

    me.nativeImports.push(base);

    return base;
  }

  parseChunk(): ASTChunkGreyScript | ASTBase {
    const me = this;

    me.next();

    const start = me.token.start;
    const chunk = me.astProvider.chunkAdvanced({ start, end: null });
    const pending = new PendingChunk(chunk);

    me.backpatches.setDefault(pending);
    me.pushScope(chunk);

    while (!Selectors.EndOfFile(me.token)) {
      me.skipNewlines();

      if (Selectors.EndOfFile(me.token)) break;

      me.lexer.recordSnapshot();
      me.statementErrors = [];

      me.parseStatement();

      if (me.statementErrors.length > 0) {
        me.tryToRecover();
      }
    }

    let last = me.backpatches.pop();

    while (!isPendingChunk(last)) {
      const exception = me.raise(
        `found open block ${last.block.type}`,
        new Range(last.block.start, last.block.start)
      );

      last.complete(me.previousToken);

      me.errors.push(exception);

      if (!me.unsafe) {
        throw exception;
      }

      last = me.backpatches.pop();
    }

    me.finishRemaingScopes();
    me.popScope();
    pending.complete(me.token);

    chunk.literals = me.literals;
    chunk.scopes = me.scopes;
    chunk.lines = me.lines;
    chunk.nativeImports = me.nativeImports;
    chunk.imports = me.imports;
    chunk.includes = me.includes;
    chunk.injects = me.injects;

    return chunk;
  }
}
