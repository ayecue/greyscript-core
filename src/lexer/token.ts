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
	type: string,
	value: string,
	line: number,
	lineStart: number,
	range: number[],
	lastLine?: number,
	lastLineStart?: number
}

export function createToken (
	type: TokenType,
	value: any,
	line: number,
	lineStart: number,
	range: number[],
	lastLine?: number,
	lastLineStart?: number
): Token {
	return {
		type,
		value,
		line,
		lineStart,
		range,
		lastLine,
		lastLineStart
	};
}