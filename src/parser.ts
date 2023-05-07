import Lexer from './lexer';
import { Token, TokenType } from './lexer/token';
import {
  ASTBase,
  ASTBaseBlockWithScope,
  ASTChunk,
  ASTClause,
  ASTForGenericStatement,
  ASTFunctionStatement,
  ASTIdentifier,
  ASTIfStatement,
  ASTImportCodeExpression,
  ASTLiteral,
  ASTProvider,
  ASTReturnStatement,
  ASTWhileStatement
} from './parser/ast';
import Validator from './parser/validator';
import { ParserException } from './types/errors';
import { Keyword } from './types/keywords';
import { Operator } from './types/operators';
import ASTPosition from './types/position';
import { Selector, Selectors } from './types/selector';

export interface ParserOptions {
  validator?: Validator;
  astProvider?: ASTProvider;
  lexer?: Lexer;
  unsafe?: boolean;
  tabWidth?: number;
}

export default class Parser {
  // runtime
  history: Token[];
  prefetchedTokens: Token[];
  token: Token | null;
  previousToken: Token | null;
  currentBlock: ASTBase[];
  currentScope: ASTBaseBlockWithScope;
  outerScopes: ASTBaseBlockWithScope[];

  // helper
  nativeImports: ASTImportCodeExpression[];
  literals: ASTBase[];
  scopes: ASTBaseBlockWithScope[];
  lines: Map<number, ASTBase[]>;

  // settings
  content: string;
  lexer: Lexer;
  validator: Validator;
  astProvider: ASTProvider;
  unsafe: boolean;
  errors: Error[];

  constructor(content: string, options: ParserOptions = {}) {
    const me = this;

    me.content = content;
    me.lexer =
      options.lexer ||
      new Lexer(content, {
        unsafe: options.unsafe,
        tabWidth: options.tabWidth
      });
    me.history = [];
    me.prefetchedTokens = [];
    me.token = null;
    me.previousToken = null;
    me.nativeImports = [];
    me.lines = new Map<number, ASTBase[]>();
    me.scopes = [];
    me.currentBlock = null;
    me.currentScope = null;
    me.outerScopes = [];
    me.literals = [];
    me.validator = options.validator || new Validator();
    me.astProvider = options.astProvider || new ASTProvider();
    me.unsafe = options.unsafe || false;
    me.errors = [];
  }

  next(): Parser {
    const me = this;

    if (me.previousToken) {
      me.history.push(me.previousToken);
    }

    me.previousToken = me.token;
    me.token = me.fetch();

    return me;
  }

  isType(type: TokenType): boolean {
    const me = this;
    return me.token !== null && type === me.token.type;
  }

  is(selector: Selector): boolean {
    const me = this;
    return selector.is(me.token);
  }

  isOneOf(...selectors: Selector[]): boolean {
    const me = this;
    if (me.token == null) return false;
    for (let index = selectors.length - 1; index >= 0; index--) {
      const selector = selectors[index];
      if (selector.is(me.token)) return true;
    }
    return false;
  }

  consume(selector: Selector): boolean {
    const me = this;

    if (this.is(selector)) {
      me.next();
      return true;
    }

    return false;
  }

  consumeMany(...selectors: Selector[]): boolean {
    const me = this;

    if (me.isOneOf(...selectors)) {
      me.next();
      return true;
    }

    return false;
  }

  requireType(type: TokenType): Token | null {
    const me = this;
    const token = me.token;

    if (me.token.type !== type) {
      me.raise(`got ${me.token} where ${type} is required`, me.token);
      return null;
    }

    me.next();
    return token;
  }

  requireToken(selector: Selector): Token | null {
    const me = this;
    const token = me.token;

    if (!selector.is(me.token)) {
      me.raise(
        `got ${me.token} where "${selector.value}" is required`,
        me.token
      );
      return null;
    }

    me.next();
    return token;
  }

  requireTokenOfAny(...selectors: Selector[]): Token | null {
    const me = this;
    const token = me.token;

    for (let index = 0; index < selectors.length; index++) {
      const selector = selectors[index];

      if (selector.is(token)) {
        me.next();
        return token;
      }
    }

    me.raise(
      `got ${me.token} where any of ${selectors
        .map((selector: Selector) => `"${selector.value}"`)
        .join(', ')} is required`,
      me.token
    );

    return null;
  }

  fetch(): Token {
    const me = this;
    return me.prefetch() && me.prefetchedTokens.shift();
  }

  prefetch(offset: number = 1): Token {
    const me = this;
    const offsetIndex = offset - 1;

    while (me.prefetchedTokens.length < offset) {
      const next = me.lexer.next();
      if (!next) break;
      me.prefetchedTokens.push(next);
      if (next.type === TokenType.EOF) break;
    }

    return me.prefetchedTokens[offsetIndex];
  }

  addLine(item: ASTBase) {
    const me = this;
    const line = item.start.line;

    if (!me.lines.has(line)) {
      me.lines.set(line, []);
    }

    const statements = me.lines.get(line);
    statements.push(item);
  }

  skipNewlines() {
    const me = this;
    while (me.isOneOf(Selectors.EndOfLine, Selectors.Comment)) {
      if (me.is(Selectors.Comment)) {
        const comment = me.astProvider.comment({
          value: me.token.value,
          start: me.token.getStart(),
          end: me.token.getEnd(),
          scope: me.currentScope
        });

        me.currentBlock.push(comment);
      }

      me.next();
    }
  }

  pushScope(scope: ASTBaseBlockWithScope) {
    const me = this;

    if (me.currentScope !== null) {
      me.scopes.push(scope);
      me.outerScopes.push(me.currentScope);
    }

    me.currentScope = scope;
  }

  popScope() {
    const me = this;
    me.currentScope = me.outerScopes.pop();
  }

  parseBlock(...endSelector: Selector[]): ASTBase[] {
    const me = this;
    const block: ASTBase[] = [];
    const previousBlock = me.currentBlock;

    me.currentBlock = block;

    while (!me.isOneOf(Selectors.EndOfFile, ...endSelector)) {
      me.skipNewlines();

      if (me.isOneOf(Selectors.EndOfFile, ...endSelector)) break;

      const statement = me.parseStatement();

      if (statement) {
        me.addLine(statement);
        block.push(statement);
      }
    }

    me.currentBlock = previousBlock;

    return block;
  }

  parseChunk(): ASTChunk | ASTBase {
    const me = this;

    me.next();

    const start = me.token.getStart();
    const chunk = me.astProvider.chunk({ start, end: null });
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
    chunk.nativeImports = me.nativeImports;
    chunk.literals = me.literals;
    chunk.scopes = me.scopes;
    chunk.lines = me.lines;
    chunk.end = me.token.getEnd();

    me.currentBlock = null;

    return chunk;
  }

  parseStatement() {
    const me = this;

    if (TokenType.Keyword === me.token.type && Keyword.Not !== me.token.value) {
      const value = me.token.value;

      switch (value) {
        case Keyword.Return:
          me.next();
          return me.parseReturnStatement();
        case Keyword.If:
          me.next();
          return me.parseIfStatement();
        case Keyword.While:
          me.next();
          return me.parseWhileStatement();
        case Keyword.For:
          me.next();
          return me.parseForStatement();
        case Keyword.Continue:
          me.next();
          return me.astProvider.continueStatement({
            start: me.previousToken.getStart(),
            end: me.previousToken.getEnd(),
            scope: me.currentScope
          });
        case Keyword.Break:
          me.next();
          return me.astProvider.breakStatement({
            start: me.previousToken.getStart(),
            end: me.previousToken.getEnd(),
            scope: me.currentScope
          });
        case Keyword.ImportCode:
          me.next();
          return me.parseNativeImportCodeStatement();
        default:
          return me.raise(
            `unexpected keyword ${me.token} at start of line`,
            me.token
          );
      }
    } else {
      return me.parseAssignment();
    }
  }

  parseAssignment(): ASTBase {
    const me = this;
    const start = me.token.getStart();
    const expr = me.parseExpr();

    if (
      me.isOneOf(
        Selectors.EndOfFile,
        Selectors.EndOfLine,
        Selectors.Comment,
        Selectors.Else
      )
    ) {
      return expr;
    }

    if (me.is(Selectors.Assign)) {
      me.next();

      const init = me.parseExpr();

      const assignmentStatement = me.astProvider.assignmentStatement({
        variable: expr,
        init,
        start,
        end: me.previousToken.getEnd(),
        scope: me.currentScope
      });

      me.currentScope.assignments.push(assignmentStatement);

      return assignmentStatement;
    } else if (
      me.isOneOf(
        Selectors.AddShorthand,
        Selectors.SubtractShorthand,
        Selectors.MultiplyShorthand,
        Selectors.DivideShorthand
      )
    ) {
      const op = me.token;

      me.next();

      const binaryExpressionStart = me.token.getStart();
      const operator = <Operator>op.value.charAt(0);
      const right = me.parseExpr();
      const binaryExpression = me.astProvider.binaryExpression({
        operator,
        left: expr,
        right,
        start: binaryExpressionStart,
        end: me.previousToken.getEnd(),
        scope: me.currentScope
      });
      const assignmentStatement = me.astProvider.assignmentStatement({
        variable: expr,
        init: binaryExpression,
        start,
        end: me.previousToken.getEnd(),
        scope: me.currentScope
      });

      me.currentScope.assignments.push(assignmentStatement);

      return assignmentStatement;
    }

    const expressions = [];

    while (!me.is(Selectors.EndOfFile)) {
      const arg = me.parseExpr();
      expressions.push(arg);

      if (me.isOneOf(Selectors.EndOfLine, Selectors.Comment)) break;
      if (me.is(Selectors.Else)) break;
      if (me.is(Selectors.ArgumentSeperator)) {
        me.next();
        me.skipNewlines();
        continue;
      }

      const requiredToken = me.requireTokenOfAny(
        Selectors.ArgumentSeperator,
        Selectors.EndOfLine
      );

      if (Selectors.EndOfLine.is(requiredToken)) break;
    }

    if (expressions.length === 0) {
      return me.astProvider.callStatement({
        expression: expr,
        start,
        end: me.previousToken.getEnd(),
        scope: me.currentScope
      });
    }

    return me.astProvider.callExpression({
      base: expr,
      arguments: expressions,
      start,
      end: me.previousToken.getEnd(),
      scope: me.currentScope
    });
  }

  parseReturnStatement(): ASTReturnStatement {
    const me = this;
    const start = me.previousToken.getStart();
    let expression = null;

    if (!me.isOneOf(Selectors.EndOfLine, Selectors.Comment)) {
      expression = me.parseExpr();
    }

    return me.astProvider.returnStatement({
      argument: expression,
      start,
      end: me.previousToken.getEnd(),
      scope: me.currentScope
    });
  }

  parseIfStatement(): ASTBase {
    const me = this;
    const clauses: ASTClause[] = [];
    const start = me.previousToken.getStart();
    const ifStatement = me.astProvider.ifStatement({
      clauses,
      start,
      end: null,
      scope: me.currentScope
    });
    const ifStatementStart = start;
    const ifCondition = me.parseExpr();

    me.addLine(ifCondition);
    me.requireToken(Selectors.Then);

    if (!me.isOneOf(Selectors.EndOfLine, Selectors.Comment)) {
      return me.parseIfShortcutStatement(ifCondition, start);
    }

    me.skipNewlines();

    const ifBody: ASTBase[] = me.parseBlock(
      Selectors.ElseIf,
      Selectors.Else,
      Selectors.EndIf
    );

    clauses.push(
      me.astProvider.ifClause({
        condition: ifCondition,
        body: ifBody,
        start: ifStatementStart,
        end: me.token.getEnd(),
        scope: me.currentScope
      })
    );

    while (me.consume(Selectors.ElseIf)) {
      const elseIfStatementStart = me.token.getStart();
      const elseIfCondition = me.parseExpr();

      me.addLine(elseIfCondition);
      me.requireToken(Selectors.Then);

      const elseIfBody: ASTBase[] = me.parseBlock(
        Selectors.ElseIf,
        Selectors.Else,
        Selectors.EndIf
      );

      clauses.push(
        me.astProvider.elseifClause({
          condition: elseIfCondition,
          body: elseIfBody,
          start: elseIfStatementStart,
          end: me.token.getEnd(),
          scope: me.currentScope
        })
      );
    }

    me.skipNewlines();

    if (me.consume(Selectors.Else)) {
      const elseStatementStart = me.token.getStart();
      const elseBody: ASTBase[] = me.parseBlock(Selectors.EndIf);

      clauses.push(
        me.astProvider.elseClause({
          body: elseBody,
          start: elseStatementStart,
          end: me.token.getEnd(),
          scope: me.currentScope
        })
      );
    }

    me.skipNewlines();

    me.requireToken(Selectors.EndIf);

    ifStatement.end = me.previousToken.getEnd();

    return ifStatement;
  }

  parseIfShortcutStatement(
    condition: ASTBase,
    start: ASTPosition
  ): ASTIfStatement | ASTBase {
    const me = this;
    const clauses: ASTClause[] = [];
    const ifStatement = me.astProvider.ifShortcutStatement({
      clauses,
      start,
      end: null,
      scope: me.currentScope
    });
    const statement = me.parseStatement();

    me.addLine(statement);

    clauses.push(
      me.astProvider.ifShortcutClause({
        condition,
        body: [statement],
        start,
        end: me.token.getEnd(),
        scope: me.currentScope
      })
    );

    if (me.is(Selectors.Else)) {
      me.next();

      const elseStatementStart = me.token.getStart();
      const elseStatement = me.parseStatement();

      me.addLine(elseStatement);

      clauses.push(
        me.astProvider.elseShortcutClause({
          body: [elseStatement],
          start: elseStatementStart,
          end: me.token.getEnd(),
          scope: me.currentScope
        })
      );
    }

    ifStatement.end = me.token.getEnd();

    return ifStatement;
  }

  parseWhileStatement(): ASTWhileStatement | ASTBase {
    const me = this;
    const start = me.previousToken.getStart();
    const condition = me.parseExpr();

    if (!condition) {
      return me.raise(`while requires a condition at line`, me.token);
    }

    if (!me.isOneOf(Selectors.EndOfLine, Selectors.Comment)) {
      return me.parseWhileShortcutStatement(condition, start);
    }

    const body: ASTBase[] = me.parseBlock(Selectors.EndWhile);

    me.requireToken(Selectors.EndWhile);

    return me.astProvider.whileStatement({
      condition,
      body,
      start,
      end: me.previousToken.getEnd(),
      scope: me.currentScope
    });
  }

  parseWhileShortcutStatement(condition: ASTBase, start: ASTPosition): ASTBase {
    const me = this;
    const statement = me.parseStatement();

    me.addLine(statement);

    return me.astProvider.whileStatement({
      condition,
      body: [statement],
      start,
      end: me.previousToken.getEnd(),
      scope: me.currentScope
    });
  }

  parseForStatement(): ASTForGenericStatement | ASTBase {
    const me = this;
    const start = me.previousToken.getStart();
    const variable = me.parseIdentifier();

    me.requireToken(Selectors.In);

    const iterator = me.parseExpr();

    if (!iterator) {
      return me.raise(`sequence expression expected for 'for' loop`, me.token);
    }

    if (!me.isOneOf(Selectors.EndOfLine, Selectors.Comment)) {
      return me.parseForShortcutStatement(variable, iterator, start);
    }

    const body: ASTBase[] = me.parseBlock(Selectors.EndFor);

    me.requireToken(Selectors.EndFor);

    return me.astProvider.forGenericStatement({
      variable,
      iterator,
      body,
      start,
      end: me.previousToken.getEnd(),
      scope: me.currentScope
    });
  }

  parseForShortcutStatement(
    variable: ASTBase,
    iterator: ASTBase,
    start: ASTPosition
  ): ASTBase {
    const me = this;
    const statement = me.parseStatement();

    me.addLine(statement);

    return me.astProvider.forGenericStatement({
      variable,
      iterator,
      body: [statement],
      start,
      end: me.previousToken.getEnd(),
      scope: me.currentScope
    });
  }

  parseExpr(): ASTBase {
    const me = this;
    return me.parseFunctionDeclaration();
  }

  parseFunctionDeclaration(): ASTFunctionStatement | ASTBase {
    const me = this;

    if (!me.is(Selectors.Function)) return me.parseOr();

    me.next();

    const functionStart = me.previousToken.getStart();
    const functionStatement = me.astProvider.functionStatement({
      start: functionStart,
      end: null,
      scope: me.currentScope,
      parent: me.outerScopes[me.outerScopes.length - 1]
    });
    const parameters = [];

    if (!me.isOneOf(Selectors.EndOfLine, Selectors.Comment)) {
      me.requireToken(Selectors.LParenthesis);

      while (!me.is(Selectors.RParenthesis)) {
        const parameter = me.parseIdentifier();
        const parameterStart = parameter.start;

        if (me.consume(Selectors.Assign)) {
          const defaultValue = me.parseExpr();

          if (!(defaultValue instanceof ASTLiteral)) {
            parameters.push(
              me.raise(
                `parameter default value must be a literal value`,
                me.token
              )
            );
          } else {
            const assign = me.astProvider.assignmentStatement({
              variable: parameter,
              init: defaultValue,
              start: parameterStart,
              end: me.previousToken.getEnd(),
              scope: me.currentScope
            });

            me.currentScope.assignments.push(assign);
            parameters.push(assign);
          }
        } else {
          parameters.push(parameter);
        }

        if (me.is(Selectors.RParenthesis)) break;
        me.requireToken(Selectors.ArgumentSeperator);
      }

      me.requireToken(Selectors.RParenthesis);
    }

    me.pushScope(functionStatement);

    let body: ASTBase[] = [];

    if (!me.isOneOf(Selectors.EndOfLine, Selectors.Comment)) {
      const statement = me.parseStatement();
      me.addLine(statement);
      body.push(statement);
    } else {
      body = me.parseBlock(Selectors.EndFunction);
      me.requireToken(Selectors.EndFunction);
    }

    me.popScope();

    functionStatement.parameters = parameters;
    functionStatement.body = body;
    functionStatement.end = me.previousToken.getEnd();

    return functionStatement;
  }

  parseOr(): ASTBase {
    const me = this;
    const start = me.token.getStart();
    const val = me.parseAnd();

    if (me.is(Selectors.Or)) {
      me.next();

      const opB = me.parseOr();

      const newExpression = me.astProvider.binaryExpression({
        operator: Operator.Or,
        left: val,
        right: opB,
        start,
        end: me.previousToken.getEnd(),
        scope: me.currentScope
      });

      return newExpression;
    }

    return val;
  }

  parseAnd(): ASTBase {
    const me = this;
    const start = me.token.getStart();
    const val = me.parseNot();

    if (me.is(Selectors.And)) {
      me.next();

      const opB = me.parseOr();

      const newExpression = me.astProvider.binaryExpression({
        operator: Operator.And,
        left: val,
        right: opB,
        start,
        end: me.previousToken.getEnd(),
        scope: me.currentScope
      });

      return newExpression;
    }

    return val;
  }

  parseNot(): ASTBase {
    const me = this;
    const start = me.token.getStart();

    if (me.is(Selectors.Not)) {
      me.next();

      me.skipNewlines();

      const val = me.parseIsa();

      return me.astProvider.unaryExpression({
        operator: Operator.Not,
        argument: val,
        start,
        end: me.previousToken.getEnd(),
        scope: me.currentScope
      });
    }

    return me.parseIsa();
  }

  parseIsa(): ASTBase {
    const me = this;
    const start = me.token.getStart();
    const val = me.parseBitwiseOr();

    if (me.is(Selectors.Isa)) {
      me.next();

      me.skipNewlines();

      const opB = me.parseComparisons();

      return me.astProvider.binaryExpression({
        operator: Operator.Isa,
        left: val,
        right: opB,
        start,
        end: me.previousToken.getEnd(),
        scope: me.currentScope
      });
    }

    return val;
  }

  parseBitwiseOr(): ASTBase {
    const me = this;
    const start = me.token.getStart();
    const val = me.parseBitwiseAnd();

    if (me.is(Selectors.BitwiseOr)) {
      me.next();

      const opB = me.parseBitwiseOr();

      const newExpression = me.astProvider.binaryExpression({
        operator: Operator.BitwiseOr,
        left: val,
        right: opB,
        start,
        end: me.previousToken.getEnd(),
        scope: me.currentScope
      });

      return newExpression;
    }

    return val;
  }

  parseBitwiseAnd(): ASTBase {
    const me = this;
    const start = me.token.getStart();
    const val = me.parseComparisons();

    if (me.is(Selectors.BitwiseAnd)) {
      me.next();

      const opB = me.parseBitwiseAnd();

      const newExpression = me.astProvider.binaryExpression({
        operator: Operator.BitwiseAnd,
        left: val,
        right: opB,
        start,
        end: me.previousToken.getEnd(),
        scope: me.currentScope
      });

      return newExpression;
    }

    return val;
  }

  parseComparisons(): ASTBase {
    const me = this;
    const start = me.token.getStart();
    const val = me.parseAddSub();

    if (
      me.isOneOf(
        Selectors.Equal,
        Selectors.NotEqual,
        Selectors.Greater,
        Selectors.GreaterEqual,
        Selectors.Lesser,
        Selectors.LessEqual
      )
    ) {
      const token = me.token;

      me.next();
      me.skipNewlines();

      const opB = me.parseComparisons();

      return me.astProvider.binaryExpression({
        operator: <Operator>token.value,
        left: val,
        right: opB,
        start,
        end: me.previousToken.getEnd(),
        scope: me.currentScope
      });
    }

    return val;
  }

  parseAddSub(): ASTBase {
    const me = this;
    const start = me.token.getStart();
    const val = me.parseBitwise();

    if (me.isOneOf(Selectors.Plus, Selectors.Minus)) {
      const token = me.token;

      me.next();
      me.skipNewlines();

      const opB = me.parseAddSub();

      return me.astProvider.binaryExpression({
        operator: <Operator>token.value,
        left: val,
        right: opB,
        start,
        end: me.previousToken.getEnd(),
        scope: me.currentScope
      });
    }

    return val;
  }

  parseBitwise(): ASTBase {
    const me = this;
    const start = me.token.getStart();
    const val = me.parseMultDiv();

    if (
      me.isOneOf(
        Selectors.LeftShift,
        Selectors.RightShift,
        Selectors.UnsignedRightShift
      )
    ) {
      const token = me.token;

      me.next();
      me.skipNewlines();

      const opB = me.parseBitwise();

      return me.astProvider.binaryExpression({
        operator: <Operator>token.value,
        left: val,
        right: opB,
        start,
        end: me.previousToken.getEnd(),
        scope: me.currentScope
      });
    }

    return val;
  }

  parseMultDiv(): ASTBase {
    const me = this;
    const start = me.token.getStart();
    const val = me.parseUnaryMinus();

    if (me.isOneOf(Selectors.Times, Selectors.Divide, Selectors.Mod)) {
      const token = me.token;

      me.next();
      me.skipNewlines();

      const opB = me.parseMultDiv();

      return me.astProvider.binaryExpression({
        operator: <Operator>token.value,
        left: val,
        right: opB,
        start,
        end: me.previousToken.getEnd(),
        scope: me.currentScope
      });
    }

    return val;
  }

  parseUnaryMinus(): ASTBase {
    const me = this;

    if (!me.is(Selectors.Minus)) {
      return me.parseNew();
    }

    const start = me.token.getStart();

    me.next();
    me.skipNewlines();

    const val = me.parseNew();

    return me.astProvider.unaryExpression({
      operator: Operator.Minus,
      argument: val,
      start,
      end: me.previousToken.getEnd(),
      scope: me.currentScope
    });
  }

  parseNew(): ASTBase {
    const me = this;

    if (!me.is(Selectors.New)) {
      return me.parseAddressOf();
    }

    const start = me.token.getStart();

    me.next();
    me.skipNewlines();

    const val = me.parseNew();

    return me.astProvider.unaryExpression({
      operator: Operator.New,
      argument: val,
      start,
      end: me.previousToken.getEnd(),
      scope: me.currentScope
    });
  }

  parseAddressOf(): ASTBase {
    const me = this;

    if (!me.is(Selectors.Reference)) {
      return me.parsePower();
    }

    const start = me.token.getStart();

    me.next();
    me.skipNewlines();

    const val = me.parsePower();

    return me.astProvider.unaryExpression({
      operator: Operator.Reference,
      argument: val,
      start,
      end: me.previousToken.getEnd(),
      scope: me.currentScope
    });
  }

  parsePower(): ASTBase {
    const me = this;
    const start = me.token.getStart();
    const val = me.parseCallExpr();

    if (me.isOneOf(Selectors.Power)) {
      me.next();
      me.skipNewlines();

      const opB = me.parseCallExpr();

      return me.astProvider.binaryExpression({
        operator: Operator.Power,
        left: val,
        right: opB,
        start,
        end: me.previousToken.getEnd(),
        scope: me.currentScope
      });
    }

    return val;
  }

  parseCallExpr(): ASTBase {
    const me = this;
    let base = me.parseMap();

    while (!me.is(Selectors.EndOfFile)) {
      const start = me.token.getStart();

      if (me.is(Selectors.MemberSeperator)) {
        me.next();
        me.skipNewlines();

        const identifier = me.parseIdentifier();

        base = me.astProvider.memberExpression({
          base,
          indexer: Operator.Member,
          identifier,
          start,
          end: me.previousToken.getEnd(),
          scope: me.currentScope
        });
      } else if (me.is(Selectors.SLBracket)) {
        me.next();
        me.skipNewlines();

        if (me.is(Selectors.SliceSeperator)) {
          const left = me.astProvider.emptyExpression({
            start: me.previousToken.getStart(),
            end: me.previousToken.getEnd(),
            scope: me.currentScope
          });

          me.next();
          me.skipNewlines();

          const right = me.is(Selectors.SRBracket)
            ? me.astProvider.emptyExpression({
                start: me.previousToken.getStart(),
                end: me.previousToken.getEnd(),
                scope: me.currentScope
              })
            : me.parseExpr();

          const sliceExpression = me.astProvider.sliceExpression({
            left,
            right,
            start,
            end: me.token.getEnd(),
            scope: me.currentScope
          });

          base = me.astProvider.indexExpression({
            base,
            index: sliceExpression,
            start,
            end: me.token.getEnd(),
            scope: me.currentScope
          });
        } else {
          const index = me.parseExpr();

          if (me.is(Selectors.SliceSeperator)) {
            me.next();
            me.skipNewlines();

            const right = me.is(Selectors.SRBracket)
              ? me.astProvider.emptyExpression({
                  start: me.previousToken.getStart(),
                  end: me.previousToken.getEnd(),
                  scope: me.currentScope
                })
              : me.parseExpr();

            const sliceExpression = me.astProvider.sliceExpression({
              left: index,
              right,
              start,
              end: me.token.getEnd(),
              scope: me.currentScope
            });

            base = me.astProvider.indexExpression({
              base,
              index: sliceExpression,
              start,
              end: me.token.getEnd(),
              scope: me.currentScope
            });
          } else {
            base = me.astProvider.indexExpression({
              base,
              index,
              start,
              end: me.token.getEnd(),
              scope: me.currentScope
            });
          }
        }

        me.requireToken(Selectors.SRBracket);
      } else if (me.is(Selectors.LParenthesis)) {
        const expressions = me.parseCallArgs();

        base = me.astProvider.callExpression({
          base,
          arguments: expressions,
          start,
          end: me.previousToken.getEnd(),
          scope: me.currentScope
        });
      } else {
        break;
      }
    }

    return base;
  }

  parseCallArgs(): ASTBase[] {
    const me = this;
    const expressions = [];

    if (me.is(Selectors.LParenthesis)) {
      me.next();

      if (me.is(Selectors.RParenthesis)) {
        me.next();
      } else {
        while (!me.is(Selectors.EndOfFile)) {
          me.skipNewlines();
          const arg = me.parseExpr();
          expressions.push(arg);
          me.skipNewlines();
          if (
            Selectors.RParenthesis.is(
              me.requireTokenOfAny(
                Selectors.ArgumentSeperator,
                Selectors.RParenthesis
              )
            )
          )
            break;
        }
      }
    }

    return expressions;
  }

  parseMap(): ASTBase {
    const me = this;

    if (!me.is(Selectors.CLBracket)) {
      return me.parseList();
    }

    const start = me.token.getStart();
    const fields = [];

    me.next();

    if (me.is(Selectors.CRBracket)) {
      me.next();
    } else {
      while (!me.is(Selectors.EndOfFile)) {
        me.skipNewlines();

        if (me.is(Selectors.CRBracket)) {
          me.next();
          break;
        }

        const key = me.parseExpr();

        me.requireToken(Selectors.MapKeyValueSeperator);
        me.skipNewlines();

        const value = me.parseExpr();

        fields.push(
          me.astProvider.mapKeyString({
            key,
            value,
            start: key.start,
            end: value.end,
            scope: me.currentScope
          })
        );

        me.skipNewlines();

        if (
          Selectors.CRBracket.is(
            me.requireTokenOfAny(Selectors.MapSeperator, Selectors.CRBracket)
          )
        )
          break;
      }
    }

    return me.astProvider.mapConstructorExpression({
      fields,
      start,
      end: me.token.getStart(),
      scope: me.currentScope
    });
  }

  parseList(): ASTBase {
    const me = this;

    if (!me.is(Selectors.SLBracket)) {
      return me.parseQuantity();
    }

    const start = me.token.getStart();
    const fields = [];

    me.next();

    if (me.is(Selectors.SRBracket)) {
      me.next();
    } else {
      while (!me.is(Selectors.EndOfFile)) {
        me.skipNewlines();

        if (me.is(Selectors.SRBracket)) {
          me.next();
          break;
        }

        const value = me.parseExpr();

        fields.push(
          me.astProvider.listValue({
            value,
            start: value.start,
            end: value.end,
            scope: me.currentScope
          })
        );

        me.skipNewlines();

        if (
          Selectors.SRBracket.is(
            me.requireTokenOfAny(Selectors.ListSeperator, Selectors.SRBracket)
          )
        )
          break;
      }
    }

    return me.astProvider.listConstructorExpression({
      fields,
      start,
      end: me.token.getStart(),
      scope: me.currentScope
    });
  }

  parseQuantity(): ASTBase {
    const me = this;

    if (!me.is(Selectors.LParenthesis)) {
      return me.parseAtom();
    }

    const start = me.token.getStart();

    me.next();
    me.skipNewlines();

    const val = me.parseExpr();

    me.requireToken(Selectors.RParenthesis);

    return me.astProvider.parenthesisExpression({
      expression: val,
      start,
      end: me.previousToken.getEnd(),
      scope: me.currentScope
    });
  }

  parseAtom(): ASTBase {
    const me = this;

    if (me.validator.isLiteral(<TokenType>me.token.type)) {
      return me.parseLiteral();
    } else if (me.isType(TokenType.Identifier)) {
      return me.parseIdentifier();
    }

    return me.raise(
      `got ${me.token} where number, string, or identifier is required`,
      me.token
    );
  }

  parseLiteral(): ASTLiteral {
    const me = this;
    const start = me.token.getStart();
    const value = me.token.value;
    const type = <TokenType>me.token.type;
    const raw = me.content.slice(...me.token.range);
    const base: ASTLiteral = me.astProvider.literal(
      <
        | TokenType.StringLiteral
        | TokenType.NumericLiteral
        | TokenType.BooleanLiteral
        | TokenType.NilLiteral
      >type,
      {
        value,
        raw,
        start,
        end: me.token.getEnd(),
        scope: me.currentScope
      }
    );

    me.literals.push(<ASTLiteral>base);

    const nextToken = me.prefetch();
    const afterNextToken = me.prefetch(1);

    if (
      Selectors.NumberSeperator.is(nextToken) &&
      afterNextToken?.type === TokenType.NumericLiteral
    ) {
      me.next();
      return me.parseFloatExpression(parseInt(value));
    } else {
      me.next();
    }

    return base;
  }

  parseFloatExpression(baseValue?: number): ASTLiteral {
    const me = this;
    const start = me.token.getStart();

    me.next();

    const floatValue = [baseValue || '', me.token.value].join('.');
    me.next();

    const base = me.astProvider.literal(TokenType.NumericLiteral, {
      value: floatValue,
      raw: floatValue,
      start,
      end: me.previousToken.getEnd(),
      scope: me.currentScope
    });

    me.literals.push(base);

    return base;
  }

  parseIdentifier(): ASTIdentifier | ASTBase {
    const me = this;
    const start = me.token.getStart();
    const end = me.token.getEnd();
    const identifier = me.requireType(TokenType.Identifier);

    if (identifier === null) {
      return me.astProvider.invalidCodeExpression({
        start,
        end
      });
    }

    if (!me.validator.isNative(identifier.value)) {
      me.currentScope.namespaces.add(identifier.value);
    }

    return me.astProvider.identifier({
      name: identifier.value,
      start,
      end,
      scope: me.currentScope
    });
  }

  parseNativeImportCodeStatement(): ASTImportCodeExpression | ASTBase {
    const me = this;
    const start = me.previousToken.getStart();

    if (!me.consume(Selectors.LParenthesis)) {
      return me.raise(
        `Expected import call to have opening operator`,
        me.token
      );
    }

    let gameDirectory;
    let fileSystemDirectory = null;

    if (TokenType.StringLiteral === me.token.type) {
      gameDirectory = me.token.value;
      me.next();
    } else {
      return me.raise(
        `Import code only allows a hardcoded import path`,
        me.token
      );
    }

    if (me.consume(Selectors.ImportCodeSeperator)) {
      if (!me.isType(TokenType.StringLiteral)) {
        return me.raise(
          `Import code only allows a hardcoded import path`,
          me.token
        );
      }

      fileSystemDirectory = me.token.value;

      me.next();
    }

    if (!me.consume(Selectors.RParenthesis)) {
      return me.raise(
        `Expected import call to have closing operator`,
        me.token
      );
    }

    const base = me.astProvider.importCodeExpression({
      gameDirectory,
      fileSystemDirectory,
      start,
      end: me.previousToken.getEnd(),
      scope: me.currentScope
    });

    me.nativeImports.push(base);

    return base;
  }

  raise(message: string, token: Token): ASTBase {
    const me = this;
    const err = new ParserException(message, token);

    me.errors.push(err);

    if (me.unsafe) {
      const start = me.token.getStart();
      const end = me.token.getEnd();
      const base = me.astProvider.invalidCodeExpression({ start, end });

      me.next();

      while (!me.isOneOf(Selectors.EndOfFile, Selectors.EndOfLine)) {
        me.next();
      }

      return base;
    }

    throw err;
  }
}
