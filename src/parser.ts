import {
  ASTBase,
  TokenType,
  ASTFunctionStatement
} from 'miniscript-core';
import {
  Parser as ParserBase,
  ParserOptions as ParserOptionsBase,
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

  parseStatement(): ASTBase | null {
    const me = this;

    if (me.isType(TokenType.Keyword)) {
      const value = me.token.value;

      switch (value) {
        case GreyScriptKeyword.ImportCode:
          me.next();
          return me.parseNativeImportCodeStatement();
        default:
          break;
      }
    }

    return super.parseStatement();
  }

  parseFunctionDeclaration(
    asLval: boolean = false,
    statementStart: boolean = false
  ): ASTFunctionStatement | ASTBase {
    const me = this;

    if (!me.is(Selectors.Function)) return me.parseOr(asLval, statementStart);

    me.next();

    const functionStart = me.previousToken.getStart();
    const functionStatement = me.astProvider.functionStatement({
      start: functionStart,
      end: null,
      scope: me.currentScope,
      parent: me.outerScopes[me.outerScopes.length - 1],
      assignment: me.currentAssignment
    });
    const parameters = [];

    me.pushScope(functionStatement);

    if (!me.isOneOf(Selectors.EndOfLine, Selectors.Comment)) {
      me.requireToken(Selectors.LParenthesis, functionStart);

      while (!me.isOneOf(Selectors.RParenthesis, Selectors.EndOfFile)) {
        const parameter = me.parseIdentifier();
        const parameterStart = parameter.start;

        if (me.consume(Selectors.Assign)) {
          const defaultValue = me.parseExpr();
          const assign = me.astProvider.assignmentStatement({
            variable: parameter,
            init: defaultValue,
            start: parameterStart,
            end: me.previousToken.getEnd(),
            scope: me.currentScope
          });

          me.currentScope.assignments.push(assign);
          parameters.push(assign);
        } else {
          const assign = me.astProvider.assignmentStatement({
            variable: parameter,
            init: me.astProvider.unknown({
              start: parameterStart,
              end: me.previousToken.getEnd(),
              scope: me.currentScope
            }),
            start: parameterStart,
            end: me.previousToken.getEnd(),
            scope: me.currentScope
          });

          me.currentScope.assignments.push(assign);
          parameters.push(parameter);
        }

        if (me.is(Selectors.RParenthesis)) break;
        me.requireToken(Selectors.ArgumentSeperator, functionStart);
      }

      me.requireToken(Selectors.RParenthesis, functionStart);
    }

    let body: ASTBase[] = [];

    if (!me.isOneOf(Selectors.EndOfLine, Selectors.Comment)) {
      const statement = me.parseStatement();
      me.addLine(statement);
      body.push(statement);
    } else {
      body = me.parseBlock(Selectors.EndFunction);
      me.requireToken(Selectors.EndFunction, functionStart);
    }

    me.popScope();

    functionStatement.parameters = parameters;
    functionStatement.body = body;
    functionStatement.end = me.previousToken.getEnd();

    return functionStatement;
  }

  parseNativeImportCodeStatement(): ASTImportCodeExpression | ASTBase {
    const me = this;
    const start = me.previousToken.getStart();

    if (!me.consume(Selectors.LParenthesis)) {
      return me.raise(
        `expected import_code to have opening parenthesis`,
        new Range(
          start,
          new Position(
            me.token.lastLine ?? me.token.line,
            me.token.lineRange[1]
          )
        ),
        false
      );
    }

    let directory;

    if (TokenType.StringLiteral === me.token.type) {
      directory = me.token.value;
      me.next();
    } else {
      return me.raise(
        `expected import_code argument to be string literal`,
        new Range(
          start,
          new Position(
            me.token.lastLine ?? me.token.line,
            me.token.lineRange[1]
          )
        ),
        false
      );
    }

    if (me.consume(Selectors.ImportCodeSeperator)) {
      if (!me.isType(TokenType.StringLiteral)) {
        return me.raise(
          `expected import_code argument to be string literal`,
          new Range(
            start,
            new Position(
              me.token.lastLine ?? me.token.line,
              me.token.lineRange[1]
            )
          ),
          false
        );
      }

      directory = me.token.value;
      console.warn(
        `Warning: Second import_code argument is deprecated. Use the first argument for the file system path instead.`
      );

      me.next();
    }

    if (!me.consume(Selectors.RParenthesis)) {
      return me.raise(
        `expected import_code to have closing parenthesis`,
        new Range(
          start,
          new Position(
            me.token.lastLine ?? me.token.line,
            me.token.lineRange[1]
          )
        ),
        false
      );
    }

    const base = me.astProvider.importCodeExpression({
      directory,
      start,
      end: me.previousToken.getEnd(),
      scope: me.currentScope
    });

    me.nativeImports.push(base);

    return base;
  }

  parseChunk(): ASTChunkGreyScript | ASTBase {
    const me = this;

    me.next();

    const start = me.token.getStart();
    const chunk = me.astProvider.chunkAdvanced({ start, end: null });
    const block: ASTBase[] = [];

    me.currentBlock = block;

    me.pushScope(chunk);

    while (!me.is(Selectors.EndOfFile)) {
      me.skipNewlines();

      if (me.is(Selectors.EndOfFile)) break;

      const statement = me.parseStatement();

      if (statement) {
        me.addLine(statement);
        block.push(statement);
      }
    }

    me.popScope();

    chunk.body = block;
    chunk.literals = me.literals;
    chunk.scopes = me.scopes;
    chunk.lines = me.lines;
    chunk.end = me.token.getEnd();
    chunk.nativeImports = me.nativeImports;
    chunk.imports = me.imports;
    chunk.includes = me.includes;

    me.currentBlock = null;

    return chunk;
  }
}
