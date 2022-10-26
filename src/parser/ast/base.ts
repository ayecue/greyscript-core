import Position from '../../types/position';

export enum ASTType {
  BreakStatement = 'BreakStatement',
  ContinueStatement = 'ContinueStatement',
  ReturnStatement = 'ReturnStatement',
  IfShortcutStatement = 'IfShortcutStatement',
  IfShortcutClause = 'IfShortcutClause',
  ElseifShortcutClause = 'ElseifShortcutClause',
  ElseShortcutClause = 'ElseShortcutClause',
  IfStatement = 'IfStatement',
  IfClause = 'IfClause',
  ElseifClause = 'ElseifClause',
  ElseClause = 'ElseClause',
  WhileStatement = 'WhileStatement',
  AssignmentStatement = 'AssignmentStatement',
  CallStatement = 'CallStatement',
  FunctionDeclaration = 'FunctionDeclaration',
  ForGenericStatement = 'ForGenericStatement',
  Chunk = 'Chunk',
  Identifier = 'Identifier',
  StringLiteral = 'StringLiteral',
  NumericLiteral = 'NumericLiteral',
  BooleanLiteral = 'BooleanLiteral',
  NilLiteral = 'NilLiteral',
  MemberExpression = 'MemberExpression',
  CallExpression = 'CallExpression',
  Comment = 'Comment',
  NegationExpression = 'NegationExpression',
  BinaryNegatedExpression = 'BinaryNegatedExpression',
  UnaryExpression = 'UnaryExpression',
  MapKeyString = 'MapKeyString',
  MapValue = 'MapValue',
  MapConstructorExpression = 'MapConstructorExpression',
  MapCallExpression = 'MapCallExpression',
  ListValue = 'ListValue',
  ListConstructorExpression = 'ListConstructorExpression',
  EmptyExpression = 'EmptyExpression',
  IndexExpression = 'IndexExpression',
  BinaryExpression = 'BinaryExpression',
  LogicalExpression = 'LogicalExpression',
  IsaExpression = 'IsaExpression',
  SliceExpression = 'SliceExpression',
  ImportCodeExpression = 'ImportCodeExpression',
  InvalidCodeExpression = 'InvalidCodeExpression',
  ParenthesisExpression = 'ParenthesisExpression'
}

export interface ASTBaseOptions {
  start: Position | null;
  end: Position | null;
  scope?: ASTBaseBlockWithScope;
}

export class ASTBase {
  readonly type: string;
  start: Position | null;
  end: Position | null;
  scope?: ASTBaseBlockWithScope;

  constructor(type: string, options: ASTBaseOptions) {
    this.type = type;
    this.start = options.start;
    this.end = options.end;
    this.scope = options.scope || null;
  }

  toString(): string {
    return `${this.type}[]`;
  }
}

export interface ASTBaseBlockOptions extends ASTBaseOptions {
  body?: ASTBase[];
}

export class ASTBaseBlock extends ASTBase {
  body: ASTBase[];

  constructor(type: string, options: ASTBaseBlockOptions) {
    super(type, options);
    this.body = options.body || [];
  }

  toString(): string {
    const body = this.body.map((item) => `${item.start.line}: ${item.toString()}`)
      .join('\n')
      .split('\n')
      .map((item) => `\t${item}`)
      .join('\n');

    return `${this.type}[${body.length > 0 ? `\n${body}\n` : ''}]`;
  }
}

export interface ASTBaseBlockWithScopeOptions extends ASTBaseBlockOptions {
  assignments?: ASTBase[];
  namespaces?: Set<string>;
  parent?: ASTBaseBlockWithScope;
}

export class ASTBaseBlockWithScope extends ASTBaseBlock {
  assignments: ASTBase[];
  namespaces: Set<string>;

  constructor(type: string, options: ASTBaseBlockWithScopeOptions) {
    super(type, options);
    this.body = options.body;
    this.namespaces = options.namespaces || new Set<string>();
    this.assignments = options.assignments || [];
  }
}

export interface ASTCommentOptions extends ASTBaseOptions {
  value: string;
}

export class ASTComment extends ASTBase {
  value: string;

  constructor(options: ASTCommentOptions) {
    super(ASTType.Comment, options);
    this.value = options.value;
  }

  toString(): string {
    return `Comment[${this.value}]`;
  }
}
