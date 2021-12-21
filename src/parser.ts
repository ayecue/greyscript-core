import Lexer from './lexer';
import {
	Token,
	TokenType
} from './lexer/token';
import {
	ASTType,
	ASTBase,
	ASTReturnStatement,
	ASTIfStatement,
	ASTIfClause,
	ASTElseClause,
	ASTWhileStatement,
	ASTAssignmentStatement,
	ASTCallStatement,
	ASTFunctionStatement,
	ASTForGenericStatement,
	ASTChunk,
	ASTIdentifier,
	ASTLiteral,
	ASTMemberExpression,
	ASTCallExpression,
	ASTComment,
	ASTUnaryExpression,
	ASTMapKeyString,
	ASTMapConstructorExpression,
	ASTListValue,
	ASTListConstructorExpression,
	ASTIndexExpression,
	ASTEvaluationExpression,
	ASTSliceExpression,
	ASTImportCodeExpression,
	ASTProvider
} from './parser/ast';
import Validator from './parser/validator';
import {
	UnexpectedValue,
	UnexpectedValues,
	UnexpectedIdentifier,
	UnexpectedArguments,
	CallExpressionEOL,
	UnexpectedExpression,
	UnexpectedAssignmentOrCall,
	UnexpectedParameterInFunction,
	UnexpectedEOF,
	UnexpectedNonStringLiteralInImportCode
} from './utils/errors';
import getPrecedence from './parser/precedence';
import { Operator } from './types/operators';

export interface ParserOptions {
	validator?: Validator;
	astProvider?: ASTProvider;
	lexer?: Lexer;
}

export default class Parser {
	content: string;
	lexer: Lexer;
	history: Token[];
	prefetchedTokens: Token[];
	token: Token | null;
	previousToken: Token | null;
	nativeImports: string[];
	namespaces: Set<string>;
	literals: ASTBase[];
	validator: Validator;
	astProvider: ASTProvider;

	constructor(content: string, options: ParserOptions = {}) {
		const me = this;

		me.content = content;
		me.lexer = options.lexer || new Lexer(content);
		me.history = [];
		me.prefetchedTokens = [];
		me.token = null;
		me.previousToken = null;
		me.nativeImports = [];
		me.namespaces = new Set<string>();
		me.literals = [];
		me.validator = options.validator || new Validator();
		me.astProvider = options.astProvider || new ASTProvider();
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

		if (values.indexOf(me.token.value) != -1 && TokenType.StringLiteral !== me.token.type) {
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
			throw new UnexpectedValue(me.token, value);
		}
	}

	expectMany(values: string[]) {
		const me = this;

		if (values.indexOf(me.token.value) != -1 && TokenType.StringLiteral !== me.token.type) {
			me.next();
		} else {
			throw new UnexpectedValues(me.token, values);
		}
	}

	isUnary(token: Token): boolean {
		const type = token.type;
		const value = token.value;

		switch (type) {
			case TokenType.Punctuator:
				return '@' === value || '-' === value || '+' === value;
			case TokenType.Keyword:
				 return 'new' === value || 'not' === value;
			default:
				return false;
		}
	}

	parseIdentifier(): ASTIdentifier {
		const me = this;
		const mainStatementLine = me.token.line;
		const identifier = me.token.value;

		if (TokenType.Identifier !== me.token.type) {
			throw new UnexpectedIdentifier(me.token);
		}

		me.namespaces.add(identifier);
		me.next();

		return me.astProvider.identifier(identifier, mainStatementLine);
	}

	parseMapConstructor(): ASTMapConstructorExpression {
		const me = this;
		const mainStatementLine = me.token.line;
		const fields = []
		let key;
		let value;

		while (true) {
			if (TokenType.StringLiteral === me.token.type && ':' === me.prefetch(1).value) {
				const mapKeyStringLine = me.token.line;
				key = me.parsePrimaryExpression();
				me.next();
				value = me.parseExpectedExpression();
				fields.push(me.astProvider.mapKeyString(key, value, mapKeyStringLine));
			}
			if (',;'.indexOf(me.token.value) >= 0) {
				me.next();
				continue;
			}
			break;
		}

		me.expect('}');

		return me.astProvider.mapConstructorExpression(fields, mainStatementLine);
	}

	parseListConstructor(): ASTListConstructorExpression {
		const me = this;
		const mainStatementLine = me.token.line;
		const fields = []
		let key;
		let value;

		while (true) {
			const listValueLine = me.token.line;
			value = me.parseExpression()
			if (value != null) fields.push(me.astProvider.listValue(value, listValueLine));
			if (',;'.indexOf(me.token.value) >= 0) {
				me.next();
				continue;
			}
			break;
		}

		me.expect(']');

		return me.astProvider.listConstructorExpression(fields, mainStatementLine);
	}

	parseRighthandExpressionGreedy(base: ASTBase): ASTBase {
		const me = this;

		while (true) {
			const newBase = me.parseRighthandExpressionPart(base);
			if (newBase === null) break;
			base = newBase;
		}

		return base;
	}

	parseRighthandExpression(): ASTBase | null {
		const me = this;
		let base;
		let name;

		if (TokenType.Identifier === me.token.type) {
			name = me.token.value;
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
		const mainStatementLine = me.token.line;
		const operator = <Operator>me.previousToken.value.charAt(0);
		const value = me.parseSubExpression();
		const expression = me.astProvider.binaryExpression(operator, base, value, mainStatementLine);

		return me.astProvider.assignmentStatement(base, expression, mainStatementLine);
	}

	parseIndexExpression(base: ASTBase): ASTIndexExpression {
		const me = this;
		const mainStatementLine = me.token.line;
		let offset = 1;
		let token = me.token;

		while (true) {
			if (token.value === ']') break;
			if (token.value === ':' && token.type !== TokenType.StringLiteral) {
				let left;
				let right;

				if (!me.consume(':')) {
					left = me.parseExpectedExpression();
					me.expect(':');
				} else {
					left = me.astProvider.emptyExpression(mainStatementLine);
				}

				if (!me.consume(']')) {
					right = me.parseExpectedExpression();
					me.expect(']');
				} else {
					right = me.astProvider.emptyExpression(mainStatementLine);
				}

				const sliceExpression = me.astProvider.sliceExpression(left, right, mainStatementLine);

				return  me.astProvider.indexExpression(base, sliceExpression, mainStatementLine);
			}

			token = me.prefetch(offset);
			offset = offset + 1;
		}

		const expression = me.parseExpectedExpression();
		me.expect(']');

		return me.astProvider.indexExpression(base, expression, mainStatementLine);
	}

	parseRighthandExpressionPart(base: ASTBase): ASTBase | null {
		const me = this;
		const mainStatementLine = me.token.line;
		let expression;
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
				return  me.parseAssignmentShorthandOperator(base);
			} else if ('[' === value) {
				me.next();
				return me.parseIndexExpression(base);
			} else if ('.' === value) {
				me.next();
				identifier = me.parseIdentifier();
				return me.astProvider.memberExpression(base, '.', identifier, mainStatementLine);
			} else if ('(' === value) {
				return me.parseCallExpression(base);
			}
		}

		return null;
	}

	parseCallExpression(base: ASTBase): ASTCallExpression {
		const me = this;
		const mainStatementLine = me.token.line;
		const value = me.token.value;

		if (TokenType.Punctuator !== me.token.type || '(' !== value) {
			throw new UnexpectedArguments(me.token, base);
		}

		if (me.token.line !== me.previousToken.line) {
			throw new CallExpressionEOL(me.token, me.previousToken);
		}

		me.next();
		const expressions = [];
		let expression = me.parseExpression();

		if (null != expression) expressions.push(expression);

		while (me.consume(',')) {
			expression = me.parseExpectedExpression();
			expressions.push(expression);
		}

		me.expect(')');
		return me.astProvider.callExpression(base, expressions, mainStatementLine);
	}

	parseFloatExpression(baseValue?: number): ASTLiteral {
		const me = this;
		const mainStatementLine = me.token.line;

		me.next();

		const floatValue = [baseValue || '', me.token.value].join('.');
		me.next();

		const base = me.astProvider.literal(TokenType.NumericLiteral, floatValue, floatValue, mainStatementLine);
		me.literals.push(base);

		return base;
	}

	parsePrimaryExpression(): ASTBase | null {
		const me = this;
		const mainStatementLine = me.token.line;
		const value = me.token.value;
		const type = <TokenType><unknown>me.token.type;

		if (me.validator.isLiteral(type)) {
			const raw = me.content.slice(me.token.range[0], me.token.range[1]);
			let base: ASTBase = me.astProvider.literal(<TokenType.StringLiteral | TokenType.NumericLiteral | TokenType.BooleanLiteral | TokenType.NilLiteral>type, value, raw, mainStatementLine);

			me.literals.push(<ASTLiteral>base);

			if (TokenType.NilLiteral !== type && me.prefetch().value === '.') {
				me.next();
				if (TokenType.NumericLiteral === type && TokenType.NumericLiteral === me.prefetch().type) {
					base = me.parseFloatExpression(parseInt(value));
				} else {
					base = me.parseRighthandExpressionGreedy(base);
				}
			} else {
				me.next();
			}

			return base;
		} else if ('.' === value && TokenType.NumericLiteral === me.prefetch().type) {
			return me.parseFloatExpression(0);
		} else if (TokenType.Keyword === type && 'function' === value) {
			me.next();
			return me.parseFunctionDeclaration();
		} else if (me.consumeMany(['{', '['])) {
			let base;
			if ('{' === value) {
				base = me.parseMapConstructor();
			} else {
				base = me.parseListConstructor();
			}

			base = me.parseRighthandExpressionGreedy(base);

			return base;
		}

		return null;
	}

	parseBinaryExpression(expression: ASTBase, minPrecedence: number = 0): ASTBase {
		const me = this;
		const mainStatementLine = me.token.line;

		let precedence;

		while (true) {
			const operator = <Operator>me.token.value;

			if (me.validator.isExpressionOperator(operator)) {
				precedence = getPrecedence(operator);
			} else {
				precedence = 0;
			}

			if (precedence === 0 || precedence <= minPrecedence) break;
			if ('^' === operator) --precedence;
			me.next();

			let right = me.parseSubExpression(precedence);

			if (null == right) {
				right = me.astProvider.emptyExpression(mainStatementLine);
			}

			expression = me.astProvider.binaryExpression(operator, expression, right, mainStatementLine);
		}

		return expression;
	}

	parseSubExpression (minPrecedence?: number) {
		const me = this;
		const mainStatementLine = me.token.line;
		const operator = me.token.value;
		let expression = null;

		if (me.isUnary(me.token)) {
			me.next();
			let argument = me.parsePrimaryExpression();
			if (null == argument) {
				argument = me.parseRighthandExpression();
			}
			expression = me.astProvider.unaryExpression(<Operator>operator, argument, mainStatementLine);
		}
		if (null == expression) {
			expression = me.parsePrimaryExpression();

			if (null == expression) {
				expression = me.parseRighthandExpression();
			}
		}

		expression = me.parseBinaryExpression(expression, minPrecedence);

		return expression;
	}

	parseNativeImportCodeStatement(): ASTImportCodeExpression {
		const me = this;
		const mainStatementLine = me.token.line;

		me.expect('(');

		let gameDirectory;
		let fileSystemDirectory = null;

		if (TokenType.StringLiteral === me.token.type) {
			gameDirectory = me.parsePrimaryExpression();
		} else {
			throw new UnexpectedNonStringLiteralInImportCode(me.token);
		}

		if (me.consume(':')) {
			fileSystemDirectory = me.parsePrimaryExpression();
			me.nativeImports.push((fileSystemDirectory as ASTLiteral).value.toString());
		}

		me.expect(')');
		me.expect(';');

		const base = me.astProvider.importCodeExpression(gameDirectory, fileSystemDirectory, mainStatementLine);

		return base;
	}

	parseWhileStatement(): ASTWhileStatement {
		const me = this;
		const mainStatementLine = me.token.line;
		const condition = me.parseExpectedExpression();

		let body;

		if (TokenType.EOL === me.token.type) {
			body = me.parseBlock();
			me.expect('end while');
		} else {
			body = me.parseBlockShortcut();
			me.expectMany(['end while', ';', '<eof>']);
		}

		return me.astProvider.whileStatement(condition, body, mainStatementLine);
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
			throw new UnexpectedExpression(me.token);
		}

		return expression;
	}

	parseIfShortcutStatement(condition: ASTBase): ASTIfStatement {
		const me = this;
		const clauses = [];
		const mainStatementLine = me.token.line;
		let statementLine = mainStatementLine;
		let body = [];

		body = me.parseBlockShortcut();

		const isActuallyShortcut = body.length === 1;

		if (isActuallyShortcut) {
			clauses.push(me.astProvider.ifShortcutClause(condition, body, statementLine));
		} else {
			clauses.push(me.astProvider.ifClause(condition, body, statementLine));
		}

		while (me.consume('else if')) {
			statementLine = me.token.line;
			condition = me.parseExpectedExpression();
			me.expect('then');
			body = me.parseBlockShortcut();

			if (isActuallyShortcut) {
				clauses.push(me.astProvider.elseifShortcutClause(condition, body, statementLine));
			} else {
				clauses.push(me.astProvider.elseifClause(condition, body, statementLine));
			}
		}

		if (me.consume('else')) {
			statementLine = me.token.line;
			body = me.parseBlockShortcut();

			if (isActuallyShortcut) {
				clauses.push(me.astProvider.elseShortcutClause(body, statementLine));
			} else {
				clauses.push(me.astProvider.elseClause(body, statementLine));
			}
		}

		me.consumeMany(['end if', ';', '<eof>']);

		if (isActuallyShortcut) {
			return me.astProvider.ifShortcutStatement(clauses, mainStatementLine);
		}

		return me.astProvider.ifStatement(clauses, mainStatementLine);
	}

	parseIfStatement(): ASTIfStatement {
		const me = this;
		const clauses = [];
		const mainStatementLine = me.token.line;
		let statementLine = mainStatementLine;
		let condition;
		let body;

		condition = me.parseExpectedExpression();
		me.expect('then');

		if (TokenType.EOL !== me.token.type) return me.parseIfShortcutStatement(condition);

		body = me.parseBlock();
		clauses.push(me.astProvider.ifClause(condition, body, statementLine));

		while (me.consume('else if')) {
			statementLine = mainStatementLine;
			condition = me.parseExpectedExpression();
			me.expect('then');
			body = me.parseBlock();
			clauses.push(me.astProvider.elseifClause(condition, body, statementLine));
		}

		if (me.consume('else')) {
			statementLine = mainStatementLine;
			body = me.parseBlock();
			clauses.push(me.astProvider.elseClause(body, statementLine));
		}

		me.expect('end if');

		return me.astProvider.ifStatement(clauses, mainStatementLine);
	}

	parseReturnStatement(isShortcutStatement: boolean = false): ASTReturnStatement {
		const me = this;
		const mainStatementLine = me.token.line;
		const expression = me.parseExpression();

		if (!isShortcutStatement) me.consume(';');

		return me.astProvider.returnStatement(expression, mainStatementLine);
	}

	parseFunctionName(): ASTBase {
		const me = this;
		const mainStatementLine = me.token.line;
		let base;
		let name;
		let marker;

		base = me.parseIdentifier();

		while (me.consume('.')) {
			name = me.parseIdentifier();
			base = me.astProvider.memberExpression(base, '.', name, mainStatementLine);
		}

		return base;
	}

	parseAssignmentOrCallStatement(): ASTBase {
		const me = this;
		const mainStatementLine = me.token.line;
		let base;
		let last = me.token;

		if (TokenType.Identifier === last.type) {
			base = me.parseIdentifier();
		} else if ('(' === last.value) {
			me.next();
			base = me.parseExpectedExpression();
			me.expect(')');
		} else if (me.validator.isNonNilLiteral(<TokenType>last.type)) {
			base = me.parseExpectedExpression();
		} else if ('[' === me.token.value || '{' === last.value) {
			base = me.parseExpectedExpression();
		} else {
			throw new UnexpectedAssignmentOrCall(me.token);
		}

		if (me.validator.isExpressionOperator(<Operator>me.token.value)) {
			return me.parseBinaryExpression(base);
		}

		while (TokenType.Punctuator === me.token.type && '=' !== me.token.value && ';' !== me.token.value && '<eof>' !== me.token.value) {
			last = me.token;
			base = me.parseRighthandExpressionGreedy(base);
		}

		if (';' === me.token.value || '<eof>' === me.token.value) {
			if (me.validator.isLiteral(<TokenType>last.type)) {
				return base;
			}

			return me.astProvider.callStatement(base, mainStatementLine);
		}

		me.expect('=');

		const value = me.parseExpectedExpression();

		return me.astProvider.assignmentStatement(base, value, mainStatementLine);
	}

	parseForStatement(): ASTForGenericStatement {
		const me = this;
		const mainStatementLine = me.token.line;

		me.consume('(');

		const variable = me.parseIdentifier();

		me.expect('in');

		const iterator = me.parseExpectedExpression();

		me.consume(')')

		let body;

		if (TokenType.EOL === me.token.type) {
			body = me.parseBlock();
			me.expect('end for');
		} else {
			body = me.parseBlockShortcut();
			me.expectMany(['end for', ';', '<eof>']);
		}

		return me.astProvider.forGenericStatement(variable, iterator, body, mainStatementLine);
	}

	parseFunctionDeclaration(): ASTFunctionStatement {
		const me = this;
		const mainStatementLine = me.token.line;
		const parameters = [];

		me.expect('(');

		if (!me.consume(')')) {
			while (true) {
				if (TokenType.Identifier === me.token.type) {
					let parameter: ASTBase = me.parseIdentifier();

					if (me.consume('=')) {
						const value = me.parseExpectedExpression();
						parameter = me.astProvider.assignmentStatement(parameter, value, mainStatementLine);
					}

					parameters.push(parameter);
					if (me.consume(',')) continue;
				} else {
					throw new UnexpectedParameterInFunction(me.token);
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
			me.expectMany(['end function', ';', '<eof>']);
		}

		return me.astProvider.functionStatement(parameters, body, mainStatementLine);
	};

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
					return me.astProvider.continueStatement(me.token.line);
				case 'break':
					me.next();
					return me.astProvider.breakStatement(me.token.line);
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
	};

	parseBlockShortcut(): ASTBase[] {
		const me = this;
		const block = [];
		let statement;
		let value;

		while (true) {
			value = me.token.value;
			if (me.token.type === TokenType.EOL || me.validator.isBreakingBlockShortcutKeyword(value)) {
				break;
			}
			statement = me.parseStatement('return' === value);
			if (statement) block.push(statement);
			if (me.token.type === TokenType.EOL) {
				break;
			}
			me.consume(';');
		}

		return block;
	};

	parseBlock(): ASTBase[] {
		const me = this;
		const block: ASTBase[] = [];
		let statement;
		let value;

		while (!me.isBlockFollow(me.token)) {
			value = me.token.value;
			statement = me.parseStatement();
			me.consume(';');
			if (statement) block.push(statement);
		}

		return block;
	};

	parseChunk(): ASTChunk {
		const me = this;

		me.next();

		const mainStatementLine = me.token.line;
		const body = me.parseBlock();

		if (TokenType.EOF !== me.token.type) {
			throw new UnexpectedEOF(me.token);
		}

		return me.astProvider.chunk(body, me.nativeImports, me.namespaces, me.literals, mainStatementLine);
	};
}