import { Token } from '../lexer/token';
import { ASTBase } from '../parser/ast';
import { CharacterCode } from './codes';

export class UnexpectedStringEOL extends Error {
	line: number;

	constructor(line: number) {
		super(`Unexpected string ending at line ${line}.`);
		const me = this;

		me.line = line;
	}	
}

export class InvalidCharacter extends Error {
	code: CharacterCode;
	line: number;

	constructor(code: CharacterCode, line: number) {
		super(`Invalid character ${code} (Code: ${String.fromCharCode(code)}) at line ${line}.`);
		const me = this;

		me.code = code;
		me.line = line;
	}	
}

export class UnexpectedValue extends Error {
	token: Token;
	expected: string;

	constructor(token: Token, expected: string) {
		super(`Unexpected value ${token.value} at line ${token.line}. Expected: ${expected}`);
		const me = this;

		me.token = token;
		me.expected = expected;
	}
}

export class UnexpectedValues extends Error {
	token: Token;
	expectedList: string[];

	constructor(token: Token, expectedList: string[]) {
		super(`Unexpected value ${token.value} at line ${token.line}. Expected one of: ${expectedList.join(', ')}`);
		const me = this;

		me.token = token;
		me.expectedList = expectedList;
	}
}

export class UnexpectedIdentifier extends Error {
	token: Token;

	constructor(token: Token) {
		super(`Unexpected identifier ${token.value} at line ${token.line}.`);
		const me = this;

		me.token = token;
	}
}

export class UnexpectedArguments extends Error {
	token: Token;
	base: ASTBase;

	constructor(token: Token, base: ASTBase) {
		super(`${base.type} received unexpected arguments ${token.value} at line ${token.line}.`);
		const me = this;

		me.token = token;
		me.base = base;
	}
}

export class UnexpectedAssignmentOrCall extends Error {
	token: Token;

	constructor(token: Token) {
		super(`Unexpected assignment or call at line ${token.line}.`);
		const me = this;

		me.token = token;
	}
}

export class UnexpectedExpression extends Error {
	token: Token;

	constructor(token: Token) {
		super(`Unexpected expression at line ${token.line}.`);
		const me = this;

		me.token = token;
	}
}

export class UnexpectedParameterInFunction extends Error {
	token: Token;

	constructor(token: Token) {
		super(`Unexpected parameter in function declaration at line ${token.line}.`);
		const me = this;

		me.token = token;
	}
} 

export class UnexpectedEOF extends Error {
	token: Token;

	constructor(token: Token) {
		super(`Unexpected end of file at line ${token.line}.`);
		const me = this;

		me.token = token;
	}
}

export class UnexpectedNonStringLiteralInImportCode extends Error {
	token: Token;

	constructor(token: Token) {
		super(`Unexpected import path at ${token.line}. Import code only allows a hardcoded import path.`);
		const me = this;

		me.token = token;
	}
} 

export class CallExpressionEOL extends Error {
	token: Token;
	previousToken: Token;

	constructor(token: Token, previousToken: Token) {
		super(`Call expressions do not support multiline arguments. Discrepancy found between ${previousToken.line} and ${token.line}.`);
		const me = this;

		me.token = token;
		me.previousToken = previousToken;
	}
}