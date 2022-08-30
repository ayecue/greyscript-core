import Lexer from './lexer';
import { Token, TokenType } from './lexer/token';
import {
  ASTAssignmentStatement,
  ASTBase,
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
  ASTPosition,
  ASTProvider,
  ASTReturnStatement,
  ASTWhileStatement,
  ASTBaseBlockWithScope
} from './parser/ast';
import getPrecedence from './parser/precedence';
import Validator from './parser/validator';
import { Operator } from './types/operators';
import {
  CallExpressionEOL,
  UnexpectedArguments,
  UnexpectedAssignmentOrCall,
  UnexpectedEndOfIfStatement,
  UnexpectedEOF,
  UnexpectedExpression,
  UnexpectedIdentifier,
  UnexpectedNonStringLiteralInImportCode,
  UnexpectedParameterInFunction,
  UnexpectedValue,
  UnexpectedValues
} from './utils/errors';

export interface ParserOptions {
  validator?: Validator;
  astProvider?: ASTProvider;
  lexer?: Lexer;
  unsafe?: boolean;
  tabWidth?: number;
}

export default class Parser {
  //runtime
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

  //helper
  nativeImports: string[];
  literals: ASTBase[];
  scopes: ASTBaseBlockWithScope[];

  //settings
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

  isBlockFollow(token: Token): boolean {
    const type = token.type;
    const value = token.value;
    if (TokenType.EOF === type) return true;
    if (TokenType.Keyword !== type) return false;
    return value.indexOf('else') === 0 || value.indexOf('end') === 0;
  }

  consume(value: string): boolean {
    const me = this;

    if (me.token === null) {
      return false;
    }

    if (value === me.token.value && TokenType.StringLiteral !== me.token.type) {
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

  consumeMany(values: string[]): boolean {
    const me = this;

    if (
      values.indexOf(me.token.value) !== -1 &&
      TokenType.StringLiteral !== me.token.type
    ) {
      me.next();
      return true;
    }

    return false;
  }

  expect(value: string) {
    const me = this;

    if (value === me.token.value && TokenType.StringLiteral !== me.token.type) {
      me.next();
    } else {
      me.raise(new UnexpectedValue(me.token, value));
    }
  }

  expectMany(values: string[]) {
    const me = this;

    if (
      values.indexOf(me.token.value) !== -1 &&
      TokenType.StringLiteral !== me.token.type
    ) {
      me.next();
    } else {
      me.raise(new UnexpectedValues(me.token, values));
    }
  }

  pushScope(scope: ASTBaseBlockWithScope) {
    const me = this;

    if (me.currentScope !== null) {
      me.scopes.push(scope);
    }

    me.outerScopes.push(scope);
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
    const start = new ASTPosition(me.token.line, me.token.lineRange[0]);
    const end = new ASTPosition(me.token.line, me.token.lineRange[1]);
    const identifier = me.token.value;

    if (TokenType.Identifier !== me.token.type) {
      return me.raise(new UnexpectedIdentifier(me.token));
    }

    if (!me.validator.isNative(identifier)) {
      me.currentScope.namespaces.add(identifier);
    }

    me.next();

    return me.astProvider.identifier({ name: identifier, start, end, scope: me.currentScope });
  }

  parseMapConstructor(): ASTMapConstructorExpression {
    const me = this;
    const start = new ASTPosition(
      me.previousToken.line,
      me.previousToken.lineRange[0]
    );
    const fields = [];

    while (true) {
      if (me.token.type === TokenType.StringLiteral) {
        const key = me.parseExpectedExpression();
        me.expect(':');
        const value = me.parseExpectedExpression();

        fields.push(
          me.astProvider.mapKeyString({
            key,
            value,
            start: key.start,
            end: value.end, scope: me.currentScope
          })
        );
      }

      if (me.consumeMany(['}', '<eof>'])) {
        break;
      }

      me.next();
    }

    return me.astProvider.mapConstructorExpression({
      fields,
      start,
      end: new ASTPosition(me.token.line, me.token.lineRange[0]), scope: me.currentScope
    });
  }

  parseListConstructor(): ASTListConstructorExpression {
    const me = this;
    const start = new ASTPosition(
      me.previousToken.line,
      me.previousToken.lineRange[0]
    );
    const fields = [];
    let value;

    while (true) {
      value = me.parseExpression();
      if (value != null)
        fields.push(
          me.astProvider.listValue({
            value,
            start: value.start,
            end: value.end, scope: me.currentScope
          })
        );
      if (me.consumeMany([',', ';'])) continue;
      break;
    }

    me.expect(']');

    return me.astProvider.listConstructorExpression({
      fields,
      start,
      end: new ASTPosition(me.token.line, me.token.lineRange[0]), scope: me.currentScope
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
    } else if (me.consume('(')) {
      base = me.parseExpectedExpression();
      me.expect(')');
    } else {
      return null;
    }

    return me.parseRighthandExpressionGreedy(base);
  }

  parseAssignmentShorthandOperator(base: ASTBase): ASTAssignmentStatement {
    const me = this;
    const assignmentStart = base.start;
    const binaryExpressionStart = new ASTPosition(
      me.token.line,
      me.token.lineRange[0]
    );
    const operator = <Operator>me.previousToken.value.charAt(0);
    const value = me.parseSubExpression();
    const end = new ASTPosition(me.token.line, me.token.lineRange[1]);
    const expression = me.astProvider.binaryExpression({
      operator,
      left: base,
      right: value,
      start: binaryExpressionStart,
      end, scope: me.currentScope
    });
    const assignmentStatement = me.astProvider.assignmentStatement({
      variable: base,
      init: expression,
      start: assignmentStart,
      end, scope: me.currentScope
    });

    me.currentScope.assignments.push(assignmentStatement);

    return assignmentStatement;
  }

  parseIndexExpression(base: ASTBase): ASTIndexExpression {
    const me = this;
    const start = new ASTPosition(me.token.line, me.token.lineRange[0]);
    let offset = 1;
    let token = me.token;

    while (true) {
      if (token.value === ']' || token.value === '<eof>') break;
      if (token.value === ':' && token.type !== TokenType.StringLiteral) {
        let left;
        let right;

        if (!me.consume(':')) {
          left = me.parseExpectedExpression();
          me.expect(':');
        } else {
          left = me.astProvider.emptyExpression({
            start,
            end: new ASTPosition(me.token.line, me.token.lineRange[1]), scope: me.currentScope
          });
        }

        if (!me.consume(']')) {
          right = me.parseExpectedExpression();
          me.expect(']');
        } else {
          right = me.astProvider.emptyExpression({
            start,
            end: new ASTPosition(me.token.line, me.token.lineRange[1]), scope: me.currentScope
          });
        }

        const end = new ASTPosition(me.token.line, me.token.lineRange[1]);
        const sliceExpression = me.astProvider.sliceExpression({
          left,
          right,
          start,
          end, scope: me.currentScope
        });

        return me.astProvider.indexExpression({
          base,
          index: sliceExpression,
          start,
          end, scope: me.currentScope
        });
      }

      token = me.prefetch(offset);
      offset = offset + 1;
    }

    const expression = me.parseExpectedExpression();
    me.expect(']');

    return me.astProvider.indexExpression({
      base,
      index: expression,
      start,
      end: new ASTPosition(me.token.line, me.token.lineRange[1]), scope: me.currentScope
    });
  }

  parseRighthandExpressionPart(base: ASTBase): ASTBase | null {
    const me = this;
    const start = new ASTPosition(me.token.line, me.token.lineRange[0]);
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
        identifier = me.parseIdentifier();
        return me.astProvider.memberExpression({
          base,
          indexer: '.',
          identifier,
          start,
          end: new ASTPosition(me.token.line, me.token.lineRange[1]), scope: me.currentScope
        });
      } else if (value === '(') {
        return me.parseCallExpression(base);
      }
    }

    return null;
  }

  parseCallExpression(base: ASTBase): ASTCallExpression | ASTBase {
    const me = this;
    const start = new ASTPosition(me.token.line, me.token.lineRange[0]);
    const value = me.token.value;

    if (TokenType.Punctuator !== me.token.type || value !== '(') {
      return me.raise(new UnexpectedArguments(me.token, base));
    }

    if (me.token.line !== me.previousToken.line) {
      return me.raise(new CallExpressionEOL(me.token, me.previousToken));
    }

    me.next();
    const expressions = [];
    let expression = me.parseExpression();

    if (expression != null) expressions.push(expression);

    while (me.consume(',')) {
      expression = me.parseExpectedExpression();
      expressions.push(expression);
    }

    me.expect(')');

    return me.astProvider.callExpression({
      base,
      arguments: expressions,
      start,
      end: new ASTPosition(me.token.line, me.token.lineRange[1]), scope: me.currentScope
    });
  }

  parseFloatExpression(baseValue?: number): ASTLiteral {
    const me = this;
    const start = new ASTPosition(me.token.line, me.token.lineRange[0]);

    me.next();

    const floatValue = [baseValue || '', me.token.value].join('.');
    me.next();

    const base = me.astProvider.literal(TokenType.NumericLiteral, {
      value: floatValue,
      raw: floatValue,
      start,
      end: new ASTPosition(me.token.line, me.token.lineRange[1]), scope: me.currentScope
    });

    me.literals.push(base);

    return base;
  }

  parsePrimaryExpression(): ASTBase | null {
    const me = this;
    const start = new ASTPosition(me.token.line, me.token.lineRange[0]);
    const value = me.token.value;
    const type = <TokenType>(<unknown>me.token.type);

    if (me.validator.isLiteral(type)) {
      const raw = me.content.slice(me.token.range[0], me.token.range[1]);
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
          end: new ASTPosition(me.token.line, me.token.lineRange[1]), scope: me.currentScope
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
    } else if (me.consumeMany(['{', '['])) {
      let base;
      if (value === '{') {
        base = me.parseMapConstructor();
      } else {
        base = me.parseListConstructor();
      }

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
    const start = new ASTPosition(me.token.line, me.token.lineRange[0]);
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
          end: new ASTPosition(me.token.line, me.token.lineRange[1]), scope: me.currentScope
        });
      }

      expression = me.astProvider.binaryExpression({
        operator,
        left: expression,
        right,
        start,
        end: new ASTPosition(me.token.line, me.token.lineRange[1]), scope: me.currentScope
      });
    }

    return expression;
  }

  parseSubExpression(minPrecedence?: number) {
    const me = this;
    const start = new ASTPosition(me.token.line, me.token.lineRange[0]);
    const operator = me.token.value;
    let expression = null;

    if (me.isUnary(me.token)) {
      me.next();

      let argument = me.parsePrimaryExpression();

      if (argument == null) {
        argument = me.parseRighthandExpression();
      }

      expression = me.astProvider.unaryExpression({
        operator: <Operator>operator,
        argument,
        start,
        end: new ASTPosition(me.token.line, me.token.lineRange[1]), scope: me.currentScope
      });
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
    const start = new ASTPosition(
      me.previousToken.line,
      me.previousToken.lineRange[0]
    );

    me.expect('(');

    let gameDirectory;
    let fileSystemDirectory = null;

    if (TokenType.StringLiteral === me.token.type) {
      gameDirectory = me.token.value;
      me.next();
    } else {
      return me.raise(new UnexpectedNonStringLiteralInImportCode(me.token));
    }

    if (me.consume(':')) {
      if (TokenType.StringLiteral !== me.token.type) {
        return me.raise(new UnexpectedNonStringLiteralInImportCode(me.token));
      }

      fileSystemDirectory = me.token.value;

      me.next();
      me.nativeImports.push(fileSystemDirectory);
    }

    me.expect(')');
    me.expect(';');

    const base = me.astProvider.importCodeExpression({
      gameDirectory,
      fileSystemDirectory,
      start,
      end: new ASTPosition(me.token.line, me.token.lineRange[1]), scope: me.currentScope
    });

    return base;
  }

  parseWhileStatement(): ASTWhileStatement {
    const me = this;
    const start = new ASTPosition(
      me.previousToken.line,
      me.previousToken.lineRange[0]
    );
    const condition = me.parseExpectedExpression();

    let body;

    if (TokenType.EOL === me.token.type) {
      body = me.parseBlock();
      me.expect('end while');
    } else {
      body = me.parseBlockShortcut();
      me.expectMany([';', '<eof>']);
    }

    return me.astProvider.whileStatement({
      condition,
      body,
      start,
      end: new ASTPosition(me.previousToken.line, me.previousToken.lineRange[1]), scope: me.currentScope
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
      return me.raise(new UnexpectedExpression(me.token));
    }

    return expression;
  }

  parseIfShortcutStatement(
    condition: ASTBase,
    start: ASTPosition
  ): ASTIfStatement {
    const me = this;
    const clauses: ASTClause[] = [];
    const ifStatement = me.astProvider.ifShortcutStatement({
      clauses,
      start,
      end: null, scope: me.currentScope
    });
    let statementStart = start;
    let body = [];

    body = me.parseBlockShortcut();

    clauses.push(
      me.astProvider.ifShortcutClause({
        condition,
        body,
        start,
        end: new ASTPosition(me.token.line, me.token.lineRange[1]), scope: me.currentScope
      })
    );

    me.consume(';');

    while (me.consume('else if')) {
      statementStart = new ASTPosition(me.token.line, me.token.lineRange[0]);
      condition = me.parseExpectedExpression();
      me.expect('then');
      body = me.parseBlockShortcut();

      clauses.push(
        me.astProvider.elseifShortcutClause({
          condition,
          body,
          start: statementStart,
          end: new ASTPosition(me.token.line, me.token.lineRange[1]), scope: me.currentScope
        })
      );

      me.consume(';');
    }

    if (me.consume('else')) {
      statementStart = new ASTPosition(me.token.line, me.token.lineRange[0]);
      body = me.parseBlockShortcut();

      clauses.push(
        me.astProvider.elseShortcutClause({
          body,
          start: statementStart,
          end: new ASTPosition(me.token.line, me.token.lineRange[1]), scope: me.currentScope
        })
      );

      me.consume(';');
    }

    me.consumeMany([';', '<eof>']);

    const currentEnd = new ASTPosition(
      me.previousToken.line,
      me.previousToken.lineRange[1]
    );

    if (me.consume('end if')) {
      me.endIfOnShortcutStack.push({
        statement: ifStatement,
        token: me.previousToken,
        previousEnd: currentEnd
      });
    }

    ifStatement.end = currentEnd;

    return ifStatement;
  }

  parseIfStatement(): ASTIfStatement {
    const me = this;
    const clauses: ASTClause[] = [];
    const start = new ASTPosition(
      me.previousToken.line,
      me.previousToken.lineRange[0]
    );
    const ifStatement = me.astProvider.ifStatement({
      clauses,
      start,
      end: null, scope: me.currentScope
    });
    let statementStart = start;
    let condition;
    let body;

    condition = me.parseExpectedExpression();
    me.expect('then');

    if (TokenType.EOL !== me.token.type)
      return me.parseIfShortcutStatement(condition, start);

    body = me.parseBlock();
    clauses.push(
      me.astProvider.ifClause({
        condition,
        body,
        start: statementStart,
        end: new ASTPosition(me.token.line, me.token.lineRange[1]), scope: me.currentScope
      })
    );

    while (me.consume('else if')) {
      statementStart = new ASTPosition(me.token.line, me.token.lineRange[0]);
      condition = me.parseExpectedExpression();
      me.expect('then');
      body = me.parseBlock();
      clauses.push(
        me.astProvider.elseifClause({
          condition,
          body,
          start: statementStart,
          end: new ASTPosition(me.token.line, me.token.lineRange[1]), scope: me.currentScope
        })
      );
    }

    if (me.consume('else')) {
      statementStart = new ASTPosition(me.token.line, me.token.lineRange[0]);
      body = me.parseBlock();
      clauses.push(
        me.astProvider.elseClause({
          body,
          start: statementStart,
          end: new ASTPosition(me.token.line, me.token.lineRange[1]), scope: me.currentScope
        })
      );
    }

    if (!me.consume('end if')) {
      const item = me.endIfOnShortcutStack.pop();

      if (!item) {
        me.raise(new UnexpectedEndOfIfStatement(me.token));
      }

      ifStatement.end = item.statement.end;
      item.statement.end = item.previousEnd;

      return ifStatement;
    }

    ifStatement.end = new ASTPosition(
      me.previousToken.line,
      me.previousToken.lineRange[1]
    );

    return ifStatement;
  }

  parseReturnStatement(
    isShortcutStatement: boolean = false
  ): ASTReturnStatement {
    const me = this;
    const start = new ASTPosition(
      me.previousToken.line,
      me.previousToken.lineRange[0]
    );
    const expression = me.parseExpression();

    if (!isShortcutStatement) me.consume(';');

    return me.astProvider.returnStatement({
      argument: expression,
      start,
      end: new ASTPosition(me.token.line, me.token.lineRange[1]), scope: me.currentScope
    });
  }

  parseFunctionName(): ASTBase {
    const me = this;
    const start = new ASTPosition(me.token.line, me.token.lineRange[0]);
    let base;
    let name;

    base = me.parseIdentifier();

    while (me.consume('.')) {
      name = me.parseIdentifier();
      base = me.astProvider.memberExpression({
        base,
        indexer: '.',
        identifier: name,
        start,
        end: new ASTPosition(me.token.line, me.token.lineRange[1]), scope: me.currentScope
      });
    }

    return base;
  }

  parseAssignmentOrCallStatement(): ASTBase {
    const me = this;
    const start = new ASTPosition(me.token.line, me.token.lineRange[0]);
    let base;
    let last = me.token;

    if (TokenType.Identifier === last.type) {
      base = me.parseIdentifier();
    } else if (last.value === '(') {
      me.next();
      base = me.parseExpectedExpression();
      me.expect(')');
    } else if (me.validator.isNonNilLiteral(<TokenType>last.type)) {
      base = me.parseExpectedExpression();
    } else if (me.token.value === '[' || last.value === '{') {
      base = me.parseExpectedExpression();
    } else {
      return me.raise(new UnexpectedAssignmentOrCall(me.token));
    }

    if (me.validator.isExpressionOperator(<Operator>me.token.value)) {
      return me.parseBinaryExpression(base);
    }

    while (
      TokenType.Punctuator === me.token.type &&
      me.token.value !== '=' &&
      me.token.value !== ';' &&
      me.token.value !== ')' &&
      me.token.value !== '<eof>'
    ) {
      last = me.token;
      base = me.parseRighthandExpressionGreedy(base);
    }

    if (
      me.token.type === TokenType.EOL ||
      me.token.type === TokenType.EOF ||
      me.token.value === 'else'
    ) {
      if (me.validator.isLiteral(<TokenType>last.type)) {
        return base;
      }

      return me.astProvider.callStatement({
        expression: base,
        start,
        end: new ASTPosition(me.token.line, me.token.lineRange[1]), scope: me.currentScope
      });
    }

    me.expect('=');

    const value = me.parseExpectedExpression();
    const assignmentStatement = me.astProvider.assignmentStatement({
      variable: base,
      init: value,
      start,
      end: new ASTPosition(me.token.line, me.token.lineRange[1]), scope: me.currentScope
    });

    me.currentScope.assignments.push(assignmentStatement);

    return assignmentStatement;
  }

  parseForStatement(): ASTForGenericStatement {
    const me = this;
    const start = new ASTPosition(
      me.previousToken.line,
      me.previousToken.lineRange[0]
    );

    me.consume('(');

    const variable = me.parseIdentifier();

    me.expect('in');

    const iterator = me.parseExpectedExpression();

    me.consume(')');

    let body;

    if (TokenType.EOL === me.token.type) {
      body = me.parseBlock();
      me.expect('end for');
    } else {
      body = me.parseBlockShortcut();
      me.expectMany([';', '<eof>']);
    }

    return me.astProvider.forGenericStatement({
      variable,
      iterator,
      body,
      start,
      end: new ASTPosition(me.previousToken.line, me.previousToken.lineRange[1]), scope: me.currentScope
    });
  }

  parseFunctionDeclaration(): ASTFunctionStatement | ASTBase {
    const me = this;
    const start = new ASTPosition(
      me.previousToken.line,
      me.previousToken.lineRange[0]
    );
    const functionStatement = me.astProvider.functionStatement({
      start,
      end: null, scope: me.currentScope
    });
    const parameters = [];

    me.pushScope(functionStatement);

    me.expect('(');

    if (!me.consume(')')) {
      while (true) {
        if (TokenType.Identifier === me.token.type) {
          let parameter: ASTBase = me.parseIdentifier();
          const paramterStart = parameter.start;

          if (me.consume('=')) {
            const value = me.parseExpectedExpression();
            parameter = me.astProvider.assignmentStatement({
              variable: parameter,
              init: value,
              start: paramterStart,
              end: new ASTPosition(me.token.line, me.token.lineRange[1]), scope: me.currentScope
            });

            me.currentScope.assignments.push(parameter);
          }

          parameters.push(parameter);
          if (me.consume(',')) continue;
        } else {
          return me.raise(new UnexpectedParameterInFunction(me.token));
        }

        me.expect(')');
        break;
      }
    }

    let body;

    if (TokenType.EOL === me.token.type) {
      body = me.parseBlock();
      me.expect('end function');
    } else {
      body = me.parseBlockShortcut();
      me.expectMany([';', '<eof>']);
    }

    me.popScope();

    functionStatement.parameters = parameters;
    functionStatement.body = body;
    functionStatement.end = new ASTPosition(me.previousToken.line, me.previousToken.lineRange[1]);

    return functionStatement;
  }

  parseStatement(isShortcutStatement: boolean = false): ASTBase | null {
    const me = this;

    if (TokenType.Keyword === me.token.type) {
      const value = me.token.value;

      switch (value) {
        case 'if':
          me.next();
          return me.parseIfStatement();
        case 'return':
          me.next();
          return me.parseReturnStatement(isShortcutStatement);
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
            start: new ASTPosition(
              me.previousToken.line,
              me.previousToken.lineRange[0]
            ),
            end: new ASTPosition(
              me.previousToken.line,
              me.previousToken.lineRange[1]
            ), scope: me.currentScope
          });
        case 'break':
          me.next();
          return me.astProvider.breakStatement({
            start: new ASTPosition(
              me.previousToken.line,
              me.previousToken.lineRange[0]
            ),
            end: new ASTPosition(
              me.previousToken.line,
              me.previousToken.lineRange[1]
            ), scope: me.currentScope
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
      statement = me.parseStatement(value === 'return');
      if (statement) block.push(statement);
      value = me.token.value;
    }

    return block;
  }

  parseBlock(): ASTBase[] {
    const me = this;
    const block: ASTBase[] = [];
    let statement;

    while (!me.isBlockFollow(me.token)) {
      statement = me.parseStatement();
      me.consume(';');
      if (statement) block.push(statement);
    }

    return block;
  }

  parseChunk(): ASTChunk | ASTBase {
    const me = this;

    me.next();

    const start = new ASTPosition(me.token.line, me.token.lineRange[0]);
    const chunk = me.astProvider.chunk({ start, end: null });

    me.pushScope(chunk);

    const body = me.parseBlock();

    me.popScope();

    if (TokenType.EOF !== me.token.type) {
      return me.raise(new UnexpectedEOF(me.token));
    }

    chunk.body = body;
    chunk.nativeImports = me.nativeImports;
    chunk.literals =  me.literals;
    chunk.scopes = me.scopes;
    chunk.end = new ASTPosition(me.token.line, me.token.lineRange[1]);

    return chunk;
  }

  raise(err: Error): ASTBase {
    const me = this;

    me.errors.push(err);

    if (me.unsafe) {
      const start = new ASTPosition(me.token.line, me.token.lineRange[0]);
      const end = new ASTPosition(me.token.line, me.token.lineRange[1]);
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
