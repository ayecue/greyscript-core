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
  SliceOperator = 'SliceOperator'
}

export interface Token {
  type: string;
  value: string;
  line: number;
  lineStart: number;
  range: number[];
  lineRange: number[];
  lastLine?: number;
  lastLineStart?: number;
  afterSpace: boolean;
}

export function createToken(
  type: string,
  value: any,
  line: number,
  lineStart: number,
  range: number[],
  offset: number,
  afterSpace: boolean,
  lastLine?: number,
  lastLineStart?: number
): Token {
  return {
    type,
    value,
    line,
    lineStart,
    range,
    lineRange: [range[0] - offset + 1, range[1] - offset + 1],
    afterSpace,
    lastLine,
    lastLineStart
  };
}
