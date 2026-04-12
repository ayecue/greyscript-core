import { ASTBase, ASTIdentifierKind } from 'miniscript-core/dist/parser/ast';
import { PendingFunction } from 'miniscript-core/dist/parser/pending-block';
import { Range as ASTRange } from 'miniscript-core/dist/types/range';
import { Precedence } from 'miniscript-core/dist/types/precedence';
import ParserBase, { ParserOptions as ParserOptionsBase } from 'greybel-core/dist/parser';
import UnsafeParserMixin from 'miniscript-core/dist/mixins/unsafe-parser-mixin';
import { SelectorGroups, Selectors } from 'greybel-core/dist/types/selector';
import { ASTChunkGreyScript, ASTProvider } from './parser/ast';
import { GreyscriptParserState } from './parser/state';
import Lexer from './lexer';
import { UnsafeLexer } from './lexer';
import {
  greyscriptKeywordOps
} from './parser/ops';

export interface ParserOptions extends ParserOptionsBase {
  astProvider?: ASTProvider;
  lexer?: Lexer;
}

export default class Parser extends ParserBase {
  declare state: GreyscriptParserState;
  astProvider: ASTProvider;

  constructor(content: string, options: ParserOptions = {}) {
    options.lexer =
      options.lexer ||
      new Lexer(content, {
        tabWidth: options.tabWidth
      });
    options.astProvider = options.astProvider || new ASTProvider();

    // Use prebuilt op index
    options.keywordOps = options.keywordOps || greyscriptKeywordOps;
    options.state = options.state || new GreyscriptParserState();

    super(content, options);
  }

  getState(): GreyscriptParserState {
    return super.getState() as GreyscriptParserState;
  }

  parseFunctionDeclaration(base: ASTBase, asLval: boolean, statementStart: boolean): ASTBase {
    const me = this;

    if (!Selectors.Function(me.token)) return me.parseExprPrecedence(Precedence.None, asLval, statementStart);

    me.next();

    const functionStartToken = me.previousToken;
    const functionStatement = me.astProvider.functionStatement({
      startLine: functionStartToken.line,
      startChar: functionStartToken.startChar,
      endLine: 0,
      endChar: 0,
      rangeStart: functionStartToken.rangeStart,
      rangeEnd: null,
      scope: me.currentScope,
      parent: me.outerScopes[me.outerScopes.length - 1],
      assignment: me.currentAssignment
    });
    const parameters = [];

    me.pushScope(functionStatement);

    if (!SelectorGroups.BlockEndOfLine(me.token)) {
      me.requireToken(Selectors.LParenthesis, functionStartToken.line, functionStartToken.startChar);

      while (!SelectorGroups.FunctionDeclarationArgEnd(me.token)) {
        const parameter = me.parseIdentifier(ASTIdentifierKind.Argument);
        const parameterStartToken = parameter;

        if (me.consume(Selectors.Assign)) {
          const defaultValue = me.parseExpr(null);
          const assign = me.astProvider.assignmentStatement({
            variable: parameter,
            init: defaultValue,
            startLine: parameterStartToken.startLine,
            startChar: parameterStartToken.startChar,
            endLine: me.previousToken.endLine,
            endChar: me.previousToken.endChar,
            rangeStart: parameterStartToken.rangeStart,
            rangeEnd: me.previousToken.rangeEnd,
            scope: me.currentScope
          });

          me.currentScope.definitions.push(assign);
          parameters.push(assign);
        } else {
          const assign = me.astProvider.assignmentStatement({
            variable: parameter,
            init: me.astProvider.unknown({
              startLine: parameterStartToken.startLine,
              startChar: parameterStartToken.startChar,
              endLine: me.previousToken.endLine,
              endChar: me.previousToken.endChar,
              rangeStart: parameterStartToken.rangeStart,
              rangeEnd: me.previousToken.rangeEnd,
              scope: me.currentScope
            }),
            startLine: parameterStartToken.startLine,
            startChar: parameterStartToken.startChar,
            endLine: me.previousToken.endLine,
            endChar: me.previousToken.endChar,
            rangeStart: parameterStartToken.rangeStart,
            rangeEnd: me.previousToken.rangeEnd,
            scope: me.currentScope
          });

          me.currentScope.definitions.push(assign);
          parameters.push(parameter);
        }

        if (Selectors.RParenthesis(me.token)) break;
        me.requireToken(Selectors.ArgumentSeparator, functionStartToken.line, functionStartToken.startChar);
        if (Selectors.RParenthesis(me.token)) {
          me.raise('expected argument instead received right parenthesis', new ASTRange(
            [me.previousToken.endLine, me.previousToken.endChar],
            [me.previousToken.endLine, me.previousToken.endChar]
          ));
          break;
        }
      }

      me.requireToken(Selectors.RParenthesis, functionStartToken.line, functionStartToken.startChar);
    }

    functionStatement.parameters = parameters;

    const pendingBlock = new PendingFunction(functionStatement, base, me.lineRegistry);
    me.backpatches.push(pendingBlock);

    return functionStatement;
  }

  parseChunk(): ASTChunkGreyScript | ASTBase {
    const chunk = super.parseChunk();
    const c = chunk as ASTChunkGreyScript;
    c.nativeImports = this.state.nativeImports;
    return c;
  }
}

export class UnsafeParser extends UnsafeParserMixin(Parser) {
  declare lexer: UnsafeLexer;

  constructor(content: string, options: ParserOptions = {}) {
    const lexer =
      (options.lexer as unknown as UnsafeLexer) ||
      new UnsafeLexer(content, {
        tabWidth: options.tabWidth
      });
    super(content, { ...options, lexer: lexer as any });
  }
}
