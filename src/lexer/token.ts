import Position from '../types/position';

export enum TokenType {
  EOF = 'EOF',
  StringLiteral = 'StringLiteral',
  Keyword = 'Keyword',
  Identifier = 'Identifier',
  NumericLiteral = 'NumericLiteral',
  Punctuator = 'Punctuator',
  BooleanLiteral = 'BooleanLiteral',
  NilLiteral = 'NilLiteral',
  EOL = 'EOL',
  SliceOperator = 'SliceOperator',
  Comment = 'Comment'
}

export class TokenOptions {
  type: string;
  value: any;
  line: number;
  lineStart: number;
  range: [number, number];
  offset: number;
  afterSpace?: boolean;
  lastLine?: number;
  lastLineStart?: number;
}

export class Token {
  type: string;
  value: string;
  line: number;
  lineStart: number;
  range: [number, number];
  lineRange: [number, number];
  afterSpace: boolean;

  // used for string literals
  lastLine?: number;
  lastLineStart?: number;

  constructor(options: TokenOptions) {
    this.type = options.type;
    this.value = options.value;
    this.line = options.line;
    this.lineStart = options.lineStart;
    this.range = options.range;
    this.lastLine = options.lastLine;
    this.lastLineStart = options.lastLineStart;
    this.afterSpace = options.afterSpace;

    const offset = options.offset;
    const [start, end] = this.range;

    this.lineRange = [start - offset + 1, end - offset + 1];
  }

  getStart(): Position {
    return new Position(this.line, this.lineRange[0]);
  }

  getEnd(): Position {
    return new Position(this.lastLine || this.line, this.lineRange[1]);
  }

  toString(): string {
    const startLine = this.line;
    const endLine = this.lastLine !== undefined ? this.lastLine : this.line;
    const [columLeft, columRight] = this.range;
    const location = `${startLine}:${columLeft} - ${endLine}:${columRight}`;

    return `${this.type}[${location}: value = '${this.value}', isAfterSpace = ${this.afterSpace}]`;
  }
}
