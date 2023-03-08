import Lexer from './lexer';
import { Token, TokenType } from './lexer/token';
import {
  ASTAssignmentStatement,
  ASTBase,
  ASTBaseBlockWithScope,
  ASTCallExpression,
  ASTChunk,
  ASTClause,
  ASTForGenericStatement,
  ASTFunctionStatement,
  ASTIdentifier,
  ASTIfStatement,
  ASTImportCodeExpression,
  ASTIndexExpression,
  ASTListConstructorExpression,
  ASTLiteral,
  ASTMapConstructorExpression,
  ASTProvider,
  ASTReturnStatement,
  ASTWhileStatement
} from './parser/ast';
import ASTPosition from './types/position';
import getPrecedence from './parser/precedence';
import Validator from './parser/validator';
import { Operator } from './types/operators';
import {
  ParserException
} from './types/errors';
import { Selector, Selectors } from './types/selector';
import { Keyword } from './types/keywords';

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
  currentScope: ASTBaseBlockWithScope;
  outerScopes: ASTBaseBlockWithScope[];
  currentBlock: ASTBase[];

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

  isBlockEnd(token: Token, endBlocks?: string[]): boolean {
    const type = token.type;
    const value = token.value;
    if (TokenType.EOF === type) return true;
    if (endBlocks && type === TokenType.Keyword) {
      for (let index = endBlocks.length - 1; index >= 0; index--) {
        if (value.startsWith(endBlocks[index])) return true;
      }
    }
    return false;
  }

  isType(type: TokenType): boolean {
    const me = this;
    return me.token !== null && type === me.token.type;
  }

  isEOL() {
    const me = this;
    return me.isOneOf(Selectors.EndOfLine, Selectors.Comment);
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

  consumeEOL() {
    const me = this;

    if (me.consume(Selectors.Comment)) {
      const comment = me.astProvider.comment({
        value: me.previousToken.value,
        start: me.previousToken.getStart(),
        end: me.previousToken.getEnd(),
        scope: me.currentScope
      });

      me.currentBlock.push(comment);
    }

    return me.consume(Selectors.EndOfLine);
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
    while (me.consumeEOL());
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

  parseExpr(): ASTBase {
    const me = this;

    if (me.is(Selectors.Function)) {
      me.next();
      return me.parseFunctionDeclaration();
    }

    return me.parseSubExpr();
  }

  parsePrimary(): ASTBase | null {
    const me = this;
    const { type } = me.token;

    if (me.validator.isLiteral(<TokenType>type)) {
      return me.parseLiteral();
    } else if (me.isType(TokenType.Identifier)) {
      return me.parseIdentifier();
    } else if (me.is(Selectors.LParenthesis)) {
      return me.parseParenthesis();
    } else if (me.is(Selectors.SLBracket)) {
      return me.parseListConstructor();
    } else if (me.is(Selectors.CLBracket)) {
      return me.parseMapConstructor();
    } else if (me.is(Selectors.NumberSeperator) && me.prefetch().type === TokenType.NumericLiteral) {
      return me.parseFloatExpression(0);
    }

    return null;
  }

  parseUnary(): ASTBase | null {
    const me = this;

    if (me.is(Selectors.Not)) {
      return me.parseUnaryExpression();
    } else if (me.is(Selectors.New)) {
      return me.parseUnaryExpression();
    } else if (me.is(Selectors.Minus)) {
      return me.parseUnaryExpression();
    } else if (me.is(Selectors.Plus)) {
      return me.parseUnaryExpression();
    } else if (me.is(Selectors.Reference)) {
      return me.parseUnaryExpression();
    }

    return null;
  }

  parseSubExpr(minPrecedence?: number): ASTBase {
    const me = this;
    const { value, type } = me.token;
    let base: ASTBase | null = me.parseUnary() || me.parsePrimary();

    if (base) {
      base = me.parseRightExpr(base);
      base = me.parseBinaryExpression(base, minPrecedence);
    }

    return base;
  }

  parseRightExpr(base: ASTBase): ASTBase {
    const me = this;
    const start = me.token.getStart();

    if (me.is(Selectors.SLBracket)) {
      const nextBase = me.parseIndexExpression(base);
      return me.parseRightExpr(nextBase);
    } else if (me.is(Selectors.MemberSeperator)) {
      me.next();
      me.consumeEOL();
      const identifier = me.parseIdentifier();
      const nextBase = me.astProvider.memberExpression({
        base,
        indexer: Operator.Member,
        identifier,
        start,
        end: me.previousToken.getEnd(),
        scope: me.currentScope
      });
      return me.parseRightExpr(nextBase);
    } else if (me.is(Selectors.LParenthesis)) {
      const nextBase = me.parseCallExpression(base);
      return me.parseRightExpr(nextBase);
    }

    return base;
  }

  parseUnaryExpression(): ASTBase {
    const me = this;
    const start = me.token.getStart();
    const currentToken = me.token;

    me.next();

    let argument = me.parseUnary() || me.parsePrimary();

    if (argument) {
      argument = me.parseRightExpr(argument);
    }

    if (argument == null) {
      return me.raise(`Unexpected argument for "${currentToken.value}" at line ${currentToken.line}.`, currentToken);
    }

    const expr = me.astProvider.unaryExpression({
      operator: <Operator>currentToken.value,
      argument,
      start,
      end: me.previousToken.getEnd(),
      scope: me.currentScope
    });

    return expr;
  }

  parseParenthesis(): ASTBase {
    const me = this;
    const start = me.token.getStart();
    let base;

    if (!me.consume(Selectors.LParenthesis)) {
      return me.raise(`Requires opening parenthesis at line ${me.token.line}.`, me.token);
    }

    base = me.parseExpr();

    if (!me.consume(Selectors.RParenthesis)) {
      return me.raise(`Requires closing parenthesis at line ${me.token.line}.`, me.token);
    }

    return me.astProvider.parenthesisExpression({
      expression: base,
      start,
      end: me.previousToken.getEnd(),
      scope: me.currentScope
    });
  }

  parseLiteral(): ASTLiteral {
    const me = this;
    const start = me.token.getStart();
    const value = me.token.value;
    const type = <TokenType>me.token.type;
    const raw = me.content.slice(...me.token.range);
    let base: ASTLiteral = me.astProvider.literal(
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

    if (Selectors.NumberSeperator.is(nextToken) && afterNextToken?.type === TokenType.NumericLiteral) {
      me.next();
      return me.parseFloatExpression(parseInt(value));
    } else {
      me.next();
    }

    return base;
  }

  parseIdentifier(): ASTIdentifier | ASTBase {
    const me = this;
    const start = me.token.getStart();
    const end = me.token.getEnd();
    const identifier = me.token.value;

    if (!me.isType(TokenType.Identifier)) {
      return me.raise(`Unexpected identifier "${me.token.value}" at line ${me.token.line}.`, me.token);
    }

    if (!me.validator.isNative(identifier)) {
      me.currentScope.namespaces.add(identifier);
    }

    me.next();

    return me.astProvider.identifier({
      name: identifier,
      start,
      end,
      scope: me.currentScope
    });
  }

  parseMapConstructor(): ASTMapConstructorExpression | ASTBase {
    const me = this;
    const start = me.token.getStart();
    const fields = [];
    let lastToken = me.token;

    if (!me.consume(Selectors.CLBracket)) {
      return me.raise(`Map requires opening bracket at line ${me.token.line}.`, me.token);
    }

    me.skipNewlines();

    while (!me.is(Selectors.CRBracket)) {
      lastToken = me.token;
      const key = me.parseExpr();

      if (key == null) {
        return me.raise(`Missing key value in map at line ${me.token.line}.`, me.token);
      }

      me.skipNewlines();

      if (!me.consume(Selectors.MapKeyValueSeperator)) {
        return me.raise(`Map constructor requires seperator at line ${me.token.line}.`, me.token);
      }

      me.skipNewlines();
      lastToken = me.token;
      const value = me.parseExpr();

      if (value == null) {
        me.raise(`Missing value in map at line ${me.token.line}.`, me.token);
      }

      me.skipNewlines();

      fields.push(
        me.astProvider.mapKeyString({
          key,
          value,
          start: key.start,
          end: value.end,
          scope: me.currentScope
        })
      );

      if (!me.consume(Selectors.MapSeperator)) break;
      me.skipNewlines();
    }

    if (!me.consume(Selectors.CRBracket)) {
      return me.raise(`Map requires closing bracket at line ${lastToken.line}.`, lastToken);
    }

    return me.astProvider.mapConstructorExpression({
      fields,
      start,
      end: me.token.getStart(),
      scope: me.currentScope
    });
  }

  parseListConstructor(): ASTListConstructorExpression |ASTBase {
    const me = this;
    const start = me.token.getStart();
    const fields = [];
    let value;
    let lastToken = me.token;

    if (!me.consume(Selectors.SLBracket)) {
      return me.raise(`List requires opening bracket at line ${me.token.line}.`, me.token);
    }

    me.skipNewlines();

    while (!me.is(Selectors.SRBracket)) {
      lastToken = me.token;
      value = me.parseExpr();

      if (value == null) {
        return me.raise(`Expect value in list at line ${me.token.line}.`, me.token);
      }

      fields.push(
        me.astProvider.listValue({
          value,
          start: value.start,
          end: value.end,
          scope: me.currentScope
        })
      );

      me.skipNewlines();
      
      if (!me.consume(Selectors.ListSeperator)) break;
      me.skipNewlines();
    }

    if (!me.consume(Selectors.SRBracket)) {
      return me.raise(`List requires closing bracket at line ${lastToken.line}.`, lastToken);
    }

    return me.astProvider.listConstructorExpression({
      fields,
      start,
      end: me.token.getStart(),
      scope: me.currentScope
    });
  }

  parseAssignmentShorthandOperator(base: ASTBase): ASTAssignmentStatement {
    const me = this;
    const assignmentStart = base.start;
    const binaryExpressionStart = me.token.getStart();
    const operator = <Operator>me.previousToken.value.charAt(0);
    const value = me.parseSubExpr();
    const end = me.token.getEnd();
    const expression = me.astProvider.binaryExpression({
      operator,
      left: base,
      right: value,
      start: binaryExpressionStart,
      end,
      scope: me.currentScope
    });
    const assignmentStatement = me.astProvider.assignmentStatement({
      variable: base,
      init: expression,
      start: assignmentStart,
      end,
      scope: me.currentScope
    });

    me.currentScope.assignments.push(assignmentStatement);

    return assignmentStatement;
  }

  parseIndexExpression(base: ASTBase): ASTIndexExpression | ASTBase {
    const me = this;
    const start = me.token.getStart();

    me.consume(Selectors.SLBracket);

    //right side slice
    if (me.consume(Selectors.SliceSeperator)) {
      const left = me.astProvider.emptyExpression({
        start: me.previousToken.getStart(),
        end: me.previousToken.getEnd(),
        scope: me.currentScope
      });
      let right = me.parseExpr();

      if (!right) {
        right = me.astProvider.emptyExpression({
          start: me.previousToken.getStart(),
          end: me.previousToken.getEnd(),
          scope: me.currentScope
        });
      }

      if (!me.consume(Selectors.SRBracket)) {
        return me.raise(`Expected slice to be closed at line ${me.token.line}`, me.token);
      }

      const end = me.previousToken.getEnd();
      const sliceExpression = me.astProvider.sliceExpression({
        left,
        right,
        start,
        end,
        scope: me.currentScope
      });

      return me.astProvider.indexExpression({
        base,
        index: sliceExpression,
        start,
        end,
        scope: me.currentScope
      });
    }

    let expression = me.parseExpr();

    //slice
    if (me.consume(Selectors.SliceSeperator)) {
      let right;

      if (!expression) {
        expression = me.astProvider.emptyExpression({
          start: me.token.getStart(),
          end: me.token.getEnd(),
          scope: me.currentScope
        });
      }

      if (!me.is(Selectors.SRBracket)) {
        right = me.parseExpr();

        if (!right) {
          right = me.astProvider.emptyExpression({
            start: me.token.getStart(),
            end: me.token.getEnd(),
            scope: me.currentScope
          });
        }
      } else {
        //left slice
        right = me.astProvider.emptyExpression({
          start: me.token.getStart(),
          end: me.token.getEnd(),
          scope: me.currentScope
        });
      }

      if (!me.consume(Selectors.SRBracket)) {
        return me.raise(`Expected slice to be closed at line ${me.token.line}`, me.token);
      }

      const end = me.previousToken.getEnd();
      const sliceExpression = me.astProvider.sliceExpression({
        left: expression,
        right,
        start,
        end,
        scope: me.currentScope
      });

      return me.astProvider.indexExpression({
        base,
        index: sliceExpression,
        start,
        end,
        scope: me.currentScope
      });
    }

    if (!expression) {
      return me.raise(`Expected expression inside of brackets at line ${me.token.line}`, me.token);
    }

    if (!me.consume(Selectors.SRBracket)) {
      return me.raise(`Expected index expression to be closed at line ${me.token.line}`, me.token);
     }

    return me.astProvider.indexExpression({
      base,
      index: expression,
      start,
      end: me.previousToken.getEnd(),
      scope: me.currentScope
    });
  }

  parseCallExpression(base: ASTBase): ASTCallExpression | ASTBase {
    const me = this;
    const start = me.token.getStart();
    const usesWhitespace = me.token.afterSpace;

    if (!me.consume(Selectors.LParenthesis)) {
      return me.raise(`Expected call expression to be opened after line ${me.token.line}.`, me.token);
    }

    const expressions = me.parseCallExpressionArgs();

    if (!me.consume(Selectors.RParenthesis)) {
      return me.raise(`Expected call expression to be closed after line ${me.token.line}.`, me.token);
    }

    return me.astProvider.callExpression({
      base,
      arguments: expressions,
      start,
      end: me.previousToken.getEnd(),
      scope: me.currentScope
    });
  }

  parseCallStatement(base: ASTBase): ASTCallExpression | ASTBase {
    const me = this;
    const start = me.token.getStart();
    const expressions = me.parseCallExpressionArgs(false);

    if (!me.consumeEOL() && !me.consume(Selectors.EndOfFile)) {
      return null;
    }

    return me.astProvider.callExpression({
      base,
      arguments: expressions,
      start,
      end: me.previousToken.getEnd(),
      scope: me.currentScope
    });
  }

  parseCallExpressionArgs(skip: boolean = true): ASTBase[] {
    const me = this;

    me.skipNewlines();

    const expressions = [];
    let expression;
    let lastToken = me.token;

    while (expression = me.parseExpr()) {
      lastToken = me.token;
      expressions.push(expression);
      if (skip) me.skipNewlines();

      if (!me.consume(Selectors.CallSeperator)) {
        break;
      }

      if (skip) me.skipNewlines();
    }

    return expressions;
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

  parseBinaryExpression(
    expression: ASTBase,
    minPrecedence: number = 0
  ): ASTBase {
    const me = this;
    const start = me.token.getStart();
    let precedence;

    while (true) {
      const operator = <Operator>me.token.value;
      const type = <TokenType>me.token.type;

      if (me.validator.isExpressionOperator(new Selector({
        type,
        value: operator
      }))) {
        precedence = getPrecedence(operator);
      } else {
        precedence = 0;
      }

      if (precedence === 0 || precedence <= minPrecedence) break;
      if (operator === '^') --precedence;
      me.next();

      let right = me.parseSubExpr(precedence);

      if (right == null) {
        right = me.astProvider.emptyExpression({
          start,
          end: me.token.getEnd(),
          scope: me.currentScope
        });
      }

      expression = me.astProvider.binaryExpression({
        operator,
        left: expression,
        right,
        start,
        end: me.previousToken.getEnd(),
        scope: me.currentScope
      });
    }

    return expression;
  }

  parseNativeImportCodeStatement(): ASTImportCodeExpression | ASTBase {
    const me = this;
    const start = me.previousToken.getStart();

    if (!me.consume(Selectors.LParenthesis)) {
      return me.raise(`Expected import call to have opening operator at line ${me.token.line}.`, me.token);
    }

    let gameDirectory;
    let fileSystemDirectory = null;

    if (TokenType.StringLiteral === me.token.type) {
      gameDirectory = me.token.value;
      me.next();
    } else {
      return me.raise(`Unexpected import path at ${me.token.line}. Import code only allows a hardcoded import path.`, me.token);
    }

    if (me.consume(Selectors.ImportCodeSeperator)) {
      if (!me.isType(TokenType.StringLiteral)) {
        return me.raise(`Unexpected import path at ${me.token.line}. Import code only allows a hardcoded import path.`, me.token);
      }

      fileSystemDirectory = me.token.value;

      me.next();
    }

    if (!me.consume(Selectors.RParenthesis)) {
      return me.raise(`Expected import call to have closing operator at line ${me.token.line}.`, me.token);
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

  parseWhileStatement(): ASTWhileStatement | ASTBase {
    const me = this;
    const start = me.previousToken.getStart();
    const condition = me.parseExpr();

    if (!condition) {
      return me.raise(`While requires a condition at line ${me.token.line}.`, me.token);
    }

    let body;

    if (me.isEOL()) {
      body = me.parseBlock([Keyword.EndWhile]);

      if (!me.consume(Selectors.EndWhile)) {
        return me.raise(`Expected 'end while' for while statement at line ${me.token.line}.`, me.token);
      }
    } else {
      body = me.parseBlockShortcut();
    }

    return me.astProvider.whileStatement({
      condition,
      body,
      start,
      end: me.previousToken.getEnd(),
      scope: me.currentScope
    });
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
    let statementStart = start;
    let body = [];

    body = me.parseBlockShortcut();

    clauses.push(
      me.astProvider.ifShortcutClause({
        condition,
        body,
        start,
        end: me.token.getEnd(),
        scope: me.currentScope
      })
    );

    me.consumeEOL();

    while (me.consume(Selectors.ElseIf)) {
      statementStart = me.token.getStart();
      condition = me.parseExpr();

      if (!condition) {
        return me.raise(`Else if requires a condition at line ${me.token.line}.`, me.token);
      }
      
      if (!me.consume(Selectors.Then)) {
        return me.raise(`Else if requires 'then' keyword at line ${me.token.line}.`, me.token);
      }

      body = me.parseBlockShortcut();

      clauses.push(
        me.astProvider.elseifShortcutClause({
          condition,
          body,
          start: statementStart,
          end: me.token.getEnd(),
          scope: me.currentScope
        })
      );

      me.consumeEOL();
    }

    if (me.consume(Selectors.Else)) {
      statementStart = me.token.getStart();
      body = me.parseBlockShortcut();

      clauses.push(
        me.astProvider.elseShortcutClause({
          body,
          start: statementStart,
          end: me.token.getEnd(),
          scope: me.currentScope
        })
      );

      me.consumeEOL();
    }

    ifStatement.end = me.token.getEnd();

    return ifStatement;
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
    let statementStart = start;
    let condition;
    let body;

    condition = me.parseExpr();

    if (!condition) {
      return me.raise(`If statement requires a condition at line ${me.token.line}.`, me.token);
    }

    if (!me.consume(Selectors.Then)) {
      return me.raise(`If requires 'then' keyword at line ${me.token.line}.`, me.token);
    }

    if (!me.isEOL()) {
      return me.parseIfShortcutStatement(condition, start);
    }

    body = me.parseBlock([Keyword.Else, Keyword.EndIf]);
    clauses.push(
      me.astProvider.ifClause({
        condition,
        body,
        start: statementStart,
        end: me.token.getEnd(),
        scope: me.currentScope
      })
    );

    while (me.consume(Selectors.ElseIf)) {
      statementStart = me.token.getStart();
      condition = me.parseExpr();

      if (!me.consume(Selectors.Then)) {
        return me.raise(`Else if requires 'then' keyword at line ${me.token.line}.`, me.token);
      }

      body = me.parseBlock([Keyword.Else, Keyword.EndIf]);
      clauses.push(
        me.astProvider.elseifClause({
          condition,
          body,
          start: statementStart,
          end: me.token.getEnd(),
          scope: me.currentScope
        })
      );
    }

    if (me.consume(Selectors.Else)) {
      statementStart = me.token.getStart();
      body = me.parseBlock([Keyword.Else, Keyword.EndIf]);
      clauses.push(
        me.astProvider.elseClause({
          body,
          start: statementStart,
          end: me.token.getEnd(),
          scope: me.currentScope
        })
      );
    }

    if (!me.consume(Selectors.EndIf)) {
      return me.raise(`Unexpected end of if statement "${me.token.value}" at line ${me.token.line}.`, me.token); 
    }

    ifStatement.end = me.previousToken.getEnd();

    return ifStatement;
  }

  parseReturnStatement(): ASTReturnStatement {
    const me = this;
    const start = me.previousToken.getStart();
    const expression = me.parseExpr();

    return me.astProvider.returnStatement({
      argument: expression,
      start,
      end: me.previousToken.getEnd(),
      scope: me.currentScope
    });
  }

  parseAssignmentOrCallStatement(): ASTBase {
    const me = this;
    const start = me.token.getStart();
    let base = me.parseExpr();

    if (!base) {
      return me.raise(`Unexpected expression at line ${me.token.line}.`, me.token);
    }

    if (me.consumeMany(Selectors.AddShorthand, Selectors.SubtractShorthand, Selectors.MultiplyShorthand, Selectors.DivideShorthand)) {
      return me.parseAssignmentShorthandOperator(base);
    } else if (me.consume(Selectors.Assign)) {
      const value = me.parseExpr();
      const assignmentStatement = me.astProvider.assignmentStatement({
        variable: base,
        init: value,
        start,
        end: me.previousToken.getEnd(),
        scope: me.currentScope
      });

      me.currentScope.assignments.push(assignmentStatement);

      return assignmentStatement;
    } else if (
      me.isEOL() ||
      me.isType(TokenType.EOF) ||
      me.isType(TokenType.Keyword)
    ) {
      return me.astProvider.callStatement({
        expression: base,
        start,
        end: me.previousToken.getEnd(),
        scope: me.currentScope
      });
    }

    base = me.parseCallStatement(base);

    if (base) {
      return base;
    }

    return me.raise(`Unexpected assignment or call at line ${me.token.line}.`, me.token);
  }

  parseForStatement(): ASTForGenericStatement | ASTBase {
    const me = this;
    const start = me.previousToken.getStart();

    me.consume(Selectors.LParenthesis);

    const variable = me.parseIdentifier();

    if (!me.consume(Selectors.In)) {
      return me.raise(`Missing in keyword in for statement at line ${me.token.line}`, me.token);
    }

    const iterator = me.parseExpr();

    if (!iterator) {
      return me.raise(`For requires an iterator at line ${me.token.line}.`, me.token);
    }

    me.consume(Selectors.RParenthesis);

    let body;

    if (me.isEOL()) {
      body = me.parseBlock([Keyword.EndFor]);

      if (!me.consume(Selectors.EndFor)) {
        return me.raise(`Expected 'end for' in for statement at line ${me.token.line}.`, me.token);
      }
    } else {
      body = me.parseBlockShortcut();
    }

    return me.astProvider.forGenericStatement({
      variable,
      iterator,
      body,
      start,
      end: me.previousToken.getEnd(),
      scope: me.currentScope
    });
  }

  parseFunctionDeclaration(): ASTFunctionStatement | ASTBase {
    const me = this;
    const start = me.previousToken.getStart();
    const functionStatement = me.astProvider.functionStatement({
      start,
      end: null,
      scope: me.currentScope
    });
    const parameters = [];

    me.pushScope(functionStatement);

    if (me.consume(Selectors.LParenthesis)) {
      if (!me.consume(Selectors.RParenthesis)) {
        while (true) {
          if (TokenType.Identifier === me.token.type) {
            let parameter: ASTBase = me.parseIdentifier();
            const parameterStart = parameter.start;
  
            if (me.consume(Selectors.Assign)) {
              const value = me.parseExpr();
  
              if (!value) {
                return me.raise(`Default in function declaration requires value at line ${me.token.line}`, me.token);
              }
  
              parameter = me.astProvider.assignmentStatement({
                variable: parameter,
                init: value,
                start: parameterStart,
                end: me.previousToken.getEnd(),
                scope: me.currentScope
              });
  
              me.currentScope.assignments.push(parameter);
            }
  
            parameters.push(parameter);
            if (me.consume(Selectors.ArgumentSeperator)) continue;
          } else {
            return me.raise(`Unexpected parameter in function declaration at line ${me.token.line}.`, me.token);
          }
  
          if (!me.consume(Selectors.RParenthesis)) {
            return me.raise(`Missing right parenthesis in function declaration at line ${me.token.line}`, me.token);
          }
          break;
        }
      }
    }

    let body;

    if (me.isEOL()) {
      body = me.parseBlock([Keyword.EndFunction]);

      if (!me.consume(Selectors.EndFunction)) {
        return me.raise(`Expected 'end function' in function declaration at line ${me.token.line}.`, me.token);
      }
    } else {
      body = me.parseBlockShortcut();
    }

    me.popScope();

    functionStatement.parameters = parameters;
    functionStatement.body = body;
    functionStatement.end = me.previousToken.getEnd();

    return functionStatement;
  }

  parseStatement(): ASTBase | null {
    const me = this;

    if (TokenType.Keyword === me.token.type) {
      const value = me.token.value;

      switch (value) {
        case Keyword.If:
          me.next();
          return me.parseIfStatement();
        case Keyword.Return:
          me.next();
          return me.parseReturnStatement();
        case Keyword.Function:
          me.next();
          return me.parseFunctionDeclaration();
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
          break;
      }
    } else if (me.isType(TokenType.Comment)) {
      me.next();
      return me.astProvider.comment({
        value: me.previousToken.value,
        start: me.previousToken.getStart(),
        end: me.previousToken.getEnd(),
        scope: me.currentScope
      });
    } else if (me.isType(TokenType.EOL)) {
      me.next();
      return null;
    }

    return me.parseAssignmentOrCallStatement();
  }

  parseBlockShortcut(): ASTBase[] {
    const me = this;
    const block: ASTBase[] = [];
    const previousBlock = me.currentBlock;
    let statement;
    let value = me.token.value;

    me.currentBlock = block;

    while (
      !me.isEOL() &&
      !me.validator.isBreakingBlockShortcutKeyword(value)
    ) {
      statement = me.parseStatement();
      if (statement) {
        me.addLine(statement);
        block.push(statement);
      }
      value = me.token.value;
    }

    me.currentBlock = previousBlock;

    return block;
  }

  parseBlock(endBlocks?: string[]): ASTBase[] {
    const me = this;
    const block: ASTBase[] = [];
    const previousBlock = me.currentBlock;
    let statement;

    me.currentBlock = block;

    while (!me.isBlockEnd(me.token, endBlocks)) {
      statement = me.parseStatement();
      me.consumeEOL();
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

    me.pushScope(chunk);

    const body = me.parseBlock();

    me.popScope();

    if (TokenType.EOF !== me.token.type) {
      return me.raise(`Unexpected end of file at line ${me.token.line}.`, me.token);
    }

    chunk.body = body;
    chunk.nativeImports = me.nativeImports;
    chunk.literals = me.literals;
    chunk.scopes = me.scopes;
    chunk.lines = me.lines;
    chunk.end = me.token.getEnd();

    return chunk;
  }

  raise(message: string, token: Token): ASTBase {
    const me = this;
    const err = new ParserException(message, token);

    me.errors.push(err);

    if (me.unsafe) {
      const start = me.token.getStart();
      const end = me.token.getEnd();
      const base = me.astProvider.invalidCodeExpression({ start, end });

      while (
        !me.isType(TokenType.EOL) &&
        !me.isType(TokenType.EOF)
      ) {
        me.next();
      }

      return base;
    }

    throw err;
  }
}
