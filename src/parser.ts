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
import ASTPosition from './utils/position';
import getPrecedence from './parser/precedence';
import Validator from './parser/validator';
import { Operator } from './types/operators';
import {
  ParserException
} from './utils/errors';

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
  endIfOnShortcutStack: {
    statement: ASTIfStatement;
    token: Token;
    previousEnd: ASTPosition;
  }[];

  // helper
  nativeImports: ASTImportCodeExpression[];
  literals: ASTBase[];
  scopes: ASTBaseBlockWithScope[];
  lines: Map<number, ASTBase>;

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
    me.lines = new Map<number, ASTBase>();
    me.scopes = [];
    me.currentScope = null;
    me.outerScopes = [];
    me.literals = [];
    me.validator = options.validator || new Validator();
    me.astProvider = options.astProvider || new ASTProvider();
    me.unsafe = options.unsafe || false;
    me.errors = [];
    me.endIfOnShortcutStack = [];
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

  is(type: TokenType, value: string): boolean {
    const me = this;
    return me.token !== null && value === me.token.value && type === me.token.type;
  }

  isOneOf(type: TokenType, ...values: string[]): boolean {
    const me = this;
    return me.token !== null && values.indexOf(me.token.value) !== -1 && type === me.token.type;
  }

  consume(type: TokenType, value: string): boolean {
    const me = this;

    if (this.is(type, value)) {
      me.next();
      return true;
    }

    return false;
  }

  consumeMany(type: TokenType, ...values: string[]): boolean {
    const me = this;

    if (me.isOneOf(type, ...values)) {
      me.next();
      return true;
    }

    return false;
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

  skipNewlines() {
    const me = this;
    while (me.consume(TokenType.EOL, ';'));
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

  isUnary(token: Token): boolean {
    const type = token.type;
    const value = token.value;

    switch (type) {
      case TokenType.Punctuator:
        return value === '@' || value === '-' || value === '+';
      case TokenType.Keyword:
        return value === 'new' || value === 'not';
      default:
        return false;
    }
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

    if (!me.consume(TokenType.Punctuator, '{')) {
      return me.raise(`Map requires opening bracket at line ${me.token.line}.`, me.token);
    }

    while (!me.is(TokenType.Punctuator, '}')) {
      me.skipNewlines();
      lastToken = me.token;
      const key = me.parseExpression();

      if (key == null) {
        return me.raise(`Missing key value in map at line ${me.token.line}.`, me.token);
      }

      me.skipNewlines();

      if (!me.consume(TokenType.SliceOperator, ':')) {
        return me.raise(`Map constructor requires seperator at line ${me.token.line}.`, me.token);
      }

      me.skipNewlines();
      lastToken = me.token;
      const value = me.parseExpression();

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

      if (!me.consume(TokenType.Punctuator, ',')) break;
    }

    if (!me.consume(TokenType.Punctuator, '}')) {
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

    if (!me.consume(TokenType.Punctuator, '[')) {
      return me.raise(`List requires opening bracket at line ${me.token.line}.`, me.token);
    }

    while (!me.is(TokenType.Punctuator, ']')) {
      me.skipNewlines();
      lastToken = me.token;
      value = me.parseExpression();

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
      if (!me.consume(TokenType.Punctuator, ',')) break;
    }

    if (!me.consume(TokenType.Punctuator, ']')) {
      return me.raise(`List requires closing bracket at line ${lastToken.line}.`, lastToken);
    }

    return me.astProvider.listConstructorExpression({
      fields,
      start,
      end: me.token.getStart(),
      scope: me.currentScope
    });
  }

  parseRighthandExpressionGreedy(base: ASTBase): ASTBase {
    const me = this;

    while (true) {
      const newBase = me.parseRighthandExpressionPart(base);

      if (newBase === null) {
        break;
      }

      base = newBase;
    }

    return base;
  }

  parseRighthandExpression(): ASTBase | null {
    const me = this;
    let base;

    if (TokenType.Identifier === me.token.type) {
      base = me.parseIdentifier();
    } else if (me.consume(TokenType.Punctuator, '(')) {
      base = me.parseExpectedExpression();

      if (!me.consume(TokenType.Punctuator, ')')) {
        return me.raise(`Expected closing ')' at line ${me.token.line}`, me.token)
      }
    } else {
      return null;
    }

    return me.parseRighthandExpressionGreedy(base);
  }

  parseAssignmentShorthandOperator(base: ASTBase): ASTAssignmentStatement {
    const me = this;
    const assignmentStart = base.start;
    const binaryExpressionStart = me.token.getStart();
    const operator = <Operator>me.previousToken.value.charAt(0);
    const value = me.parseSubExpression();
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

  parseIndexExpression(base: ASTBase): ASTBase {
    const me = this;
    const start = me.token.getStart();

    //right side slice
    if (me.consume(TokenType.SliceOperator, ':')) {
      const left = me.astProvider.emptyExpression({
        start: me.previousToken.getStart(),
        end: me.previousToken.getEnd(),
        scope: me.currentScope
      });
      const right = me.parseExpectedExpression();

      if (!me.consume(TokenType.Punctuator, ']')) {
        return me.raise(`Expected slice to be closed at line ${me.token.line}`, me.token);
      }

      const end = me.token.getEnd();
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

    const expression = me.parseExpectedExpression();

    //slice
    if (me.consume(TokenType.SliceOperator, ':')) {
      let right;

      if (!me.is(TokenType.Punctuator, ']')) {
        right = me.parseExpectedExpression();
      } else {
        //left slice
        right = me.astProvider.emptyExpression({
          start: me.token.getStart(),
          end: me.token.getEnd(),
          scope: me.currentScope
        });
      }

      if (!me.consume(TokenType.Punctuator, ']')) {
        return me.raise(`Expected slice to be closed at line ${me.token.line}`, me.token);
      }

      const end = me.token.getEnd();
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

    if (!me.consume(TokenType.Punctuator, ']')) {
      return me.raise(`Expected index expression to be closed at line ${me.token.line}`, me.token);
     }

    return me.astProvider.indexExpression({
      base,
      index: expression,
      start,
      end: me.token.getEnd(),
      scope: me.currentScope
    });
  }

  parseRighthandExpressionPart(base: ASTBase): ASTBase | null {
    const me = this;
    const start = me.token.getStart();
    let identifier;
    const type = me.token.type;

    if (TokenType.Punctuator === type) {
      const value = me.token.value;

      if (
        Operator.AddShorthand === value ||
        Operator.SubtractShorhand === value ||
        Operator.MultiplyShorthand === value ||
        Operator.DivideShorthand === value
      ) {
        me.next();
        return me.parseAssignmentShorthandOperator(base);
      } else if (value === '[') {
        me.next();
        return me.parseIndexExpression(base);
      } else if (value === '.') {
        me.next();
        me.consume(TokenType.EOL, ';');
        identifier = me.parseIdentifier();
        return me.astProvider.memberExpression({
          base,
          indexer: '.',
          identifier,
          start,
          end: me.token.getEnd(),
          scope: me.currentScope
        });
      } else if (me.is(TokenType.Punctuator, '(')) {
        return me.parseCallExpression(base);
      }
    }

    return null;
  }

  parseCallExpression(base: ASTBase):  ASTBase {
    const me = this;
    const start = me.token.getStart();

    if (!me.consume(TokenType.Punctuator, '(')) {
      return me.raise(`Expected call expression to be opened after line ${me.token.line}.`, me.token);
    }

    me.skipNewlines();

    const expressions = [];
    let expression;
    let lastToken = me.token;

    while (expression = me.parseExpression()) {
      lastToken = me.token;
      expressions.push(expression);
      me.skipNewlines();

      if (!me.consume(TokenType.Punctuator, ',')) {
        break;
      }

      me.skipNewlines();
    }

    if (!me.consume(TokenType.Punctuator, ')')) {
      return me.raise(`Expected call expression to be closed after line ${lastToken.line}.`, lastToken);
    }

    return me.astProvider.callExpression({
      base,
      arguments: expressions,
      start,
      end: me.token.getEnd(),
      scope: me.currentScope
    });
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
      end: me.token.getEnd(),
      scope: me.currentScope
    });

    me.literals.push(base);

    return base;
  }

  parsePrimaryExpression(): ASTBase | null {
    const me = this;
    const start = me.token.getStart();
    const value = me.token.value;
    const type = <TokenType>(<unknown>me.token.type);

    if (me.validator.isLiteral(type)) {
      const raw = me.content.slice(...me.token.range);
      let base: ASTBase = me.astProvider.literal(
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

      if (TokenType.NilLiteral !== type && me.prefetch().value === '.') {
        me.next();
        if (
          TokenType.NumericLiteral === type &&
          TokenType.NumericLiteral === me.prefetch().type
        ) {
          base = me.parseFloatExpression(parseInt(value));
        } else {
          base = me.parseRighthandExpressionGreedy(base);
        }
      } else {
        me.next();
      }

      return base;
    } else if (
      value === '.' &&
      TokenType.NumericLiteral === me.prefetch().type
    ) {
      return me.parseFloatExpression(0);
    } else if (TokenType.Keyword === type && value === 'function') {
      me.next();
      return me.parseFunctionDeclaration();
    } else if (me.is(TokenType.Punctuator, '[')) {
      let base = me.parseListConstructor();
      base = me.parseRighthandExpressionGreedy(base);
      return base;
    } else if (me.is(TokenType.Punctuator, '{')) {
      let base = me.parseMapConstructor();
      base = me.parseRighthandExpressionGreedy(base);
      return base;
    }

    return null;
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

      if (me.validator.isExpressionOperator(operator)) {
        precedence = getPrecedence(operator);
      } else {
        precedence = 0;
      }

      if (precedence === 0 || precedence <= minPrecedence) break;
      if (operator === '^') --precedence;
      me.next();

      let right = me.parseSubExpression(precedence);

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
        end: me.token.getEnd(),
        scope: me.currentScope
      });
    }

    return expression;
  }

  parseUnaryExpressionPart(...allowedSubUnaries: string[]): ASTBase {
    const me = this;
    const start = me.token.getStart();
    const operator = me.token.value;

    me.next();

    let argument = null;

    if (me.isUnary(me.token) && allowedSubUnaries.includes(me.token.value)) {
      argument = me.parseUnaryExpression();
    }
    if (argument == null) {
      argument = me.parsePrimaryExpression();

      if (argument == null) {
        argument = me.parseRighthandExpression();
      }
    }

    if (argument === null) {
      return me.raise(`Unexpected argument for "${me.previousToken.value}" at line ${me.previousToken.line}.`, me.previousToken);
    }

    const expr = me.astProvider.unaryExpression({
      operator: <Operator>operator,
      argument,
      start,
      end: me.token.getEnd(),
      scope: me.currentScope
    });

    return expr;
  }

  parseUnaryExpression(): ASTBase {
    const me = this;

    switch (me.token.value) {
      case 'not':
        return me.parseUnaryExpressionPart('-', '@');
      case '-':
        return me.parseUnaryExpressionPart('@');
      default:
        return me.parseUnaryExpressionPart();
    }
  }

  parseSubExpression(minPrecedence?: number) {
    const me = this;
    let expression = null;

    if (me.isUnary(me.token)) {
      expression = me.parseUnaryExpression();
    }
    if (expression == null) {
      expression = me.parsePrimaryExpression();

      if (expression == null) {
        expression = me.parseRighthandExpression();
      }
    }

    expression = me.parseBinaryExpression(expression, minPrecedence);

    return expression;
  }

  parseNativeImportCodeStatement(): ASTImportCodeExpression | ASTBase {
    const me = this;
    const start = me.previousToken.getStart();

    if (!me.consume(TokenType.Punctuator, '(')) {
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

    if (me.consume(TokenType.SliceOperator, ':')) {
      if (!me.isType(TokenType.StringLiteral)) {
        return me.raise(`Unexpected import path at ${me.token.line}. Import code only allows a hardcoded import path.`, me.token);
      }

      fileSystemDirectory = me.token.value;

      me.next();
    }

    if (!me.consume(TokenType.Punctuator, ')')) {
      return me.raise(`Expected import call to have closing operator at line ${me.token.line}.`, me.token);
    }

    const base = me.astProvider.importCodeExpression({
      gameDirectory,
      fileSystemDirectory,
      start,
      end: me.token.getEnd(),
      scope: me.currentScope
    });

    me.nativeImports.push(base);

    return base;
  }

  parseWhileStatement(): ASTWhileStatement | ASTBase {
    const me = this;
    const start = me.previousToken.getStart();
    const condition = me.parseExpectedExpression();

    let body;

    if (TokenType.EOL === me.token.type) {
      body = me.parseBlock(['end while']);

      if (!me.consume(TokenType.Keyword, 'end while')) {
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

  parseExpression(): ASTBase {
    const me = this;
    const expression = me.parseSubExpression();
    return expression;
  }

  parseExpectedExpression(): ASTBase {
    const me = this;
    const expression = me.parseExpression();

    if (expression == null) {
      return me.raise(`Unexpected expression at line ${me.token.line}.`, me.token);
    }

    return expression;
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

    me.consume(TokenType.EOL, ';');

    while (me.consume(TokenType.Keyword, 'else if')) {
      statementStart = me.token.getStart();
      condition = me.parseExpectedExpression();
      
      if (!me.consume(TokenType.Keyword, 'then')) {
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

      me.consume(TokenType.EOL, ';');
    }

    if (me.consume(TokenType.Keyword, 'else')) {
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

      me.consume(TokenType.EOL, ';');
    }

    me.consume(TokenType.EOL, ';');

    const currentEnd = me.previousToken.getEnd();

    if (me.consume(TokenType.Keyword, 'end if')) {
      me.endIfOnShortcutStack.push({
        statement: ifStatement,
        token: me.previousToken,
        previousEnd: currentEnd
      });
    }

    ifStatement.end = currentEnd;

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

    condition = me.parseExpectedExpression();

    if (!me.consume(TokenType.Keyword, 'then')) {
      return me.raise(`If requires 'then' keyword at line ${me.token.line}.`, me.token);
    }

    if (TokenType.EOL !== me.token.type)
      return me.parseIfShortcutStatement(condition, start);

    body = me.parseBlock(['else', 'end if']);
    clauses.push(
      me.astProvider.ifClause({
        condition,
        body,
        start: statementStart,
        end: me.token.getEnd(),
        scope: me.currentScope
      })
    );

    while (me.consume(TokenType.Keyword, 'else if')) {
      statementStart = me.token.getStart();
      condition = me.parseExpectedExpression();

      if (!me.consume(TokenType.Keyword, 'then')) {
        return me.raise(`Else if requires 'then' keyword at line ${me.token.line}.`, me.token);
      }

      body = me.parseBlock(['else', 'end if']);
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

    if (me.consume(TokenType.Keyword, 'else')) {
      statementStart = me.token.getStart();
      body = me.parseBlock(['else', 'end if']);
      clauses.push(
        me.astProvider.elseClause({
          body,
          start: statementStart,
          end: me.token.getEnd(),
          scope: me.currentScope
        })
      );
    }

    if (!me.consume(TokenType.Keyword, 'end if')) {
      const item = me.endIfOnShortcutStack.pop();

      if (!item) {
        return me.raise(`Unexpected end of if statement "${me.token.value}" at line ${me.token.line}.`, me.token); 
      }

      ifStatement.end = item.statement.end;
      item.statement.end = item.previousEnd;

      return ifStatement;
    }

    ifStatement.end = me.previousToken.getEnd();

    return ifStatement;
  }

  parseReturnStatement(): ASTReturnStatement {
    const me = this;
    const start = me.previousToken.getStart();
    const expression = me.parseExpression();

    return me.astProvider.returnStatement({
      argument: expression,
      start,
      end: me.token.getEnd(),
      scope: me.currentScope
    });
  }

  parseAssignmentOrCallStatement(): ASTBase {
    const me = this;
    const start = me.token.getStart();
    let base;
    let origin = me.token;

    if (TokenType.Identifier === origin.type) {
      base = me.parseIdentifier();
      //here
      base = me.parseRighthandExpressionGreedy(base);
    } else {
      base = me.parseExpectedExpression();
    }

    if (
      (me.token.type ===TokenType.Punctuator || me.token.type === TokenType.Keyword) &&
      me.validator.isExpressionOperator(me.token.value as Operator)
    ) {
      return me.parseBinaryExpression(base);
    } else if (me.validator.isLiteral(<TokenType>origin.type)) {
      return base;
    } else if (me.consume(TokenType.Punctuator, '=')) {
      const value = me.parseExpectedExpression();
      const assignmentStatement = me.astProvider.assignmentStatement({
        variable: base,
        init: value,
        start,
        end: me.token.getEnd(),
        scope: me.currentScope
      });

      me.currentScope.assignments.push(assignmentStatement);

      return assignmentStatement;
    } else if (
      me.token.type === TokenType.EOL ||
      me.token.type === TokenType.EOF ||
      me.token.type === TokenType.Keyword
    ) {
      return me.astProvider.callStatement({
        expression: base,
        start,
        end: me.previousToken.getEnd(),
        scope: me.currentScope
      });
    }

    return me.raise(`Unexpected assignment or call at line ${me.token.line}.`, me.token);
  }

  parseForStatement(): ASTForGenericStatement | ASTBase {
    const me = this;
    const start = me.previousToken.getStart();

    me.consume(TokenType.Punctuator, '(');

    const variable = me.parseIdentifier();

    if (!me.consume(TokenType.Keyword, 'in')) {
      return me.raise(`Missing in keyword in for statement at line ${me.token.line}`, me.token);
    }

    const iterator = me.parseExpectedExpression();

    me.consume(TokenType.Punctuator, ')');

    let body;

    if (TokenType.EOL === me.token.type) {
      body = me.parseBlock(['end for']);

      if (!me.consume(TokenType.Keyword, 'end for')) {
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

    if (!me.consume(TokenType.Punctuator, '(')) {
      return me.raise(`Missing left parenthesis in function declaration at line ${me.token.line}`, me.token);
    }

    if (!me.consume(TokenType.Punctuator, ')')) {
      while (true) {
        if (TokenType.Identifier === me.token.type) {
          let parameter: ASTBase = me.parseIdentifier();
          const paramterStart = parameter.start;

          if (me.consume(TokenType.Punctuator, '=')) {
            const value = me.parseExpectedExpression();
            parameter = me.astProvider.assignmentStatement({
              variable: parameter,
              init: value,
              start: paramterStart,
              end: me.token.getEnd(),
              scope: me.currentScope
            });

            me.currentScope.assignments.push(parameter);
          }

          parameters.push(parameter);
          if (me.consume(TokenType.Punctuator, ',')) continue;
        } else {
          return me.raise(`Unexpected parameter in function declaration at line ${me.token.line}.`, me.token);
        }

        if (!me.consume(TokenType.Punctuator, ')')) {
          return me.raise(`Missing right parenthesis in function declaration at line ${me.token.line}`, me.token);
        }
        break;
      }
    }

    let body;

    if (TokenType.EOL === me.token.type) {
      body = me.parseBlock(['end function']);

      if (!me.consume(TokenType.Keyword, 'end function')) {
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
        case 'if':
          me.next();
          return me.parseIfStatement();
        case 'return':
          me.next();
          return me.parseReturnStatement();
        case 'function':
          me.next();
          return me.parseFunctionDeclaration();
        case 'while':
          me.next();
          return me.parseWhileStatement();
        case 'for':
          me.next();
          return me.parseForStatement();
        case 'continue':
          me.next();
          return me.astProvider.continueStatement({
            start: me.previousToken.getStart(),
            end: me.previousToken.getEnd(),
            scope: me.currentScope
          });
        case 'break':
          me.next();
          return me.astProvider.breakStatement({
            start: me.previousToken.getStart(),
            end: me.previousToken.getEnd(),
            scope: me.currentScope
          });
        case 'import_code':
          me.next();
          return me.parseNativeImportCodeStatement();
        default:
          break;
      }
    } else if (TokenType.EOL === me.token.type) {
      me.next();
      return null;
    }

    return me.parseAssignmentOrCallStatement();
  }

  parseBlockShortcut(): ASTBase[] {
    const me = this;
    const block = [];
    let statement;
    let value = me.token.value;

    while (
      me.token.type !== TokenType.EOL &&
      !me.validator.isBreakingBlockShortcutKeyword(value)
    ) {
      statement = me.parseStatement();
      if (statement) {
        this.lines.set(statement.start.line, statement);
        block.push(statement);
      }
      value = me.token.value;
    }

    return block;
  }

  parseBlock(endBlocks?: string[]): ASTBase[] {
    const me = this;
    const block: ASTBase[] = [];
    let statement;

    while (!me.isBlockEnd(me.token, endBlocks)) {
      statement = me.parseStatement();
      me.consume(TokenType.EOL, ';');
      if (statement) {
        this.lines.set(statement.start.line, statement);
        block.push(statement);
      }
    }

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

      me.next();

      while (
        me.token.type !== TokenType.EOL &&
        me.token.type !== TokenType.EOF
      ) {
        me.next();
      }

      return base;
    }

    throw err;
  }
}
