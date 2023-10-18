import {
  ASTBase,
  TokenType
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
