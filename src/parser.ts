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
	ASTProvider,
	ASTPosition
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
	UnexpectedNonStringLiteralInImportCode,
	UnexpectedEndOfIfStatement
} from './utils/errors';
import getPrecedence from './parser/precedence';
import { Operator } from './types/operators';

export interface ParserOptions {
	validator?: Validator;
	astProvider?: ASTProvider;
	lexer?: Lexer;
	unsafe?: boolean;
	tabWidth?: number;
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
	unsafe: boolean;
	errors: Error[];
	endIfOnShortcutStack: { statement: ASTIfStatement, token: Token, previousEnd: ASTPosition }[];

	constructor(content: string, options: ParserOptions = {}) {
		const me = this;

		me.content = content;
		me.lexer = options.lexer || new Lexer(content, {
			unsafe: options.unsafe,
			tabWidth: options.tabWidth
		});
		me.history = [];
		me.prefetchedTokens = [];
		me.token = null;
		me.previousToken = null;
		me.nativeImports = [];
		me.namespaces = new Set<string>();
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
			me.raise(new UnexpectedValue(me.token, value));
		}
	}

	expectMany(values: string[]) {
		const me = this;

		if (values.indexOf(me.token.value) != -1 && TokenType.StringLiteral !== me.token.type) {
			me.next();
		} else {
			me.raise(new UnexpectedValues(me.token, values));
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

	parseIdentifier(): ASTIdentifier | ASTBase {
		const me = this;
		const start = {
			line: me.token.line,
			character: me.token.lineRange[0]
		};
		const end = {
			line: me.token.line,
			character: me.token.lineRange[1]
		};
		const identifier = me.token.value;

		if (TokenType.Identifier !== me.token.type) {
			return me.raise(new UnexpectedIdentifier(me.token));
		}

		if (!me.validator.isNative(identifier)) {
			me.namespaces.add(identifier);
		}

		me.next();

		return me.astProvider.identifier(identifier, start, end);
	}

	parseMapConstructor(): ASTMapConstructorExpression {
		const me = this;
		const start = {
			line: me.previousToken.line,
			character: me.previousToken.lineRange[0]
		};
		const fields = [];

		while (true) {
			if (me.token.type === TokenType.StringLiteral) {
				const key = me.token.value;
				const startKey = {
					line: me.token.line,
					character: me.token.lineRange[0]
				};

				me.next();
				me.expect(':');

				const value = me.parseExpectedExpression();

				fields.push(me.astProvider.mapKeyString(
					key,
					value,
					startKey,
					value.end
				));
			}

			if (me.consumeMany(['}', '<eof>'])) {
				break;
			}

			me.next();
		}

		return me.astProvider.mapConstructorExpression(fields, start, {
			line: me.token.line,
			character: me.token.lineRange[0]
		});
	}

	parseListConstructor(): ASTListConstructorExpression {
		const me = this;
		const start = {
			line: me.previousToken.line,
			character: me.previousToken.lineRange[0]
		};
		const fields = []
		let key;
		let value;

		while (true) {
			value = me.parseExpression()
			if (value != null) fields.push(me.astProvider.listValue(value, value.start, value.end));
			if (me.consumeMany([',', ';'])) continue;
			break;
		}

		me.expect(']');

		return me.astProvider.listConstructorExpression(fields, start, {
			line: me.token.line,
			character: me.token.lineRange[0]
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
		const assignmentStart = base.start;
		const binaryExpressionStart = {
			line: me.token.line,
			character: me.token.lineRange[0]
		};
		const operator = <Operator>me.previousToken.value.charAt(0);
		const value = me.parseSubExpression();
		const end = {
			line: me.token.line,
			character: me.token.lineRange[1]
		};
		const expression = me.astProvider.binaryExpression(
			operator,
			base,
			value,
			binaryExpressionStart,
			end
		);

		return me.astProvider.assignmentStatement(
			base,
			expression,
			assignmentStart,
			end
		);
	}

	parseIndexExpression(base: ASTBase): ASTIndexExpression {
		const me = this;
		const start = {
			line: me.token.line,
			character: me.token.lineRange[0]
		};
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
					left = me.astProvider.emptyExpression(start, {
						line: me.token.line,
						character: me.token.lineRange[1]
					});
				}

				if (!me.consume(']')) {
					right = me.parseExpectedExpression();
					me.expect(']');
				} else {
					right = me.astProvider.emptyExpression(start, {
						line: me.token.line,
						character: me.token.lineRange[1]
					});
				}

				const end = {
					line: me.token.line,
					character: me.token.lineRange[1]
				};
				const sliceExpression = me.astProvider.sliceExpression(
					left,
					right,
					start,
					end
				);

				return  me.astProvider.indexExpression(
					base,
					sliceExpression,
					start,
					end
				);
			}

			token = me.prefetch(offset);
			offset = offset + 1;
		}

		const expression = me.parseExpectedExpression();
		me.expect(']');

		return me.astProvider.indexExpression(base, expression, start, {
			line: me.token.line,
			character: me.token.lineRange[1]
		});
	}

	parseRighthandExpressionPart(base: ASTBase): ASTBase | null {
		const me = this;
		const start = {
			line: me.token.line,
			character: me.token.lineRange[0]
		};
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
				return me.astProvider.memberExpression(
					base,
					'.',
					identifier,
					start,
					{
						line: me.token.line,
						character: me.token.lineRange[1]
					}
				);
			} else if ('(' === value) {
				return me.parseCallExpression(base);
			}
		}

		return null;
	}

	parseCallExpression(base: ASTBase): ASTCallExpression | ASTBase {
		const me = this;
		const start = {
			line: me.token.line,
			character: me.token.lineRange[0]
		};
		const value = me.token.value;

		if (TokenType.Punctuator !== me.token.type || '(' !== value) {
			return me.raise(new UnexpectedArguments(me.token, base));
		}

		if (me.token.line !== me.previousToken.line) {
			return me.raise(new CallExpressionEOL(me.token, me.previousToken));
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

		return me.astProvider.callExpression(
			base,
			expressions,
			start,
			{
				line: me.token.line,
				character: me.token.lineRange[1]
			}
		);
	}

	parseFloatExpression(baseValue?: number): ASTLiteral {
		const me = this;
		const start = {
			line: me.token.line,
			character: me.token.lineRange[0]
		};

		me.next();

		const floatValue = [baseValue || '', me.token.value].join('.');
		me.next();

		const base = me.astProvider.literal(
			TokenType.NumericLiteral,
			floatValue,
			floatValue,
			start,
			{
				line: me.token.line,
				character: me.token.lineRange[1]
			}
		);

		me.literals.push(base);

		return base;
	}

	parsePrimaryExpression(): ASTBase | null {
		const me = this;
		const start = {
			line: me.token.line,
			character: me.token.lineRange[0]
		};
		const value = me.token.value;
		const type = <TokenType><unknown>me.token.type;

		if (me.validator.isLiteral(type)) {
			const raw = me.content.slice(me.token.range[0], me.token.range[1]);
			let base: ASTBase = me.astProvider.literal(
				<TokenType.StringLiteral | TokenType.NumericLiteral | TokenType.BooleanLiteral | TokenType.NilLiteral>type,
				value,
				raw,
				start,
				{
					line: me.token.line,
					character: me.token.lineRange[1]
				}
			);

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
		const start = {
			line: me.token.line,
			character: me.token.lineRange[0]
		};
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
				right = me.astProvider.emptyExpression(start, {
					line: me.token.line,
					character: me.token.lineRange[1]
				});
			}

			expression = me.astProvider.binaryExpression(
				operator,
				expression,
				right,
				start,
				{
					line: me.token.line,
					character: me.token.lineRange[1]
				}
			);
		}

		return expression;
	}

	parseSubExpression(minPrecedence?: number) {
		const me = this;
		const start = {
			line: me.token.line,
			character: me.token.lineRange[0]
		};
		const operator = me.token.value;
		let expression = null;

		if (me.isUnary(me.token)) {
			me.next();

			let argument = me.parsePrimaryExpression();

			if (null == argument) {
				argument = me.parseRighthandExpression();
			}

			expression = me.astProvider.unaryExpression(
				<Operator>operator,
				argument,
				start,
				{
					line: me.token.line,
					character: me.token.lineRange[1]
				}
			);
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

	parseNativeImportCodeStatement(): ASTImportCodeExpression | ASTBase {
		const me = this;
		const start = {
			line: me.previousToken.line,
			character: me.previousToken.lineRange[0]
		};

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

		const base = me.astProvider.importCodeExpression(
			gameDirectory,
			fileSystemDirectory,
			start,
			{
				line: me.token.line,
				character: me.token.lineRange[1]
			}
		);

		return base;
	}

	parseWhileStatement(): ASTWhileStatement {
		const me = this;
		const start = {
			line: me.previousToken.line,
			character: me.previousToken.lineRange[0]
		};
		const condition = me.parseExpectedExpression();

		let body;

		if (TokenType.EOL === me.token.type) {
			body = me.parseBlock();
			me.expect('end while');
		} else {
			body = me.parseBlockShortcut();
			me.expectMany([';', '<eof>']);
		}

		return me.astProvider.whileStatement(
			condition,
			body,
			start,
			{
				line: me.previousToken.line,
				character: me.previousToken.lineRange[1]
			}
		);
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

	parseIfShortcutStatement(condition: ASTBase, start: ASTPosition): ASTIfStatement {
		const me = this;
		const clauses: ASTBase[] = [];
		const ifStatement = me.astProvider.ifShortcutStatement(
			clauses,
			start,
			null
		);
		let statementStart = start;
		let body = [];

		body = me.parseBlockShortcut();

		clauses.push(me.astProvider.ifShortcutClause(
			condition,
			body,
			start,
			{
				line: me.token.line,
				character: me.token.lineRange[1]
			}
		));

		me.consume(';');

		while (me.consume('else if')) {
			statementStart = {
				line: me.token.line,
				character: me.token.lineRange[0]
			};
			condition = me.parseExpectedExpression();
			me.expect('then');
			body = me.parseBlockShortcut();

			clauses.push(me.astProvider.elseifShortcutClause(
				condition,
				body,
				statementStart,
				{
					line: me.token.line,
					character: me.token.lineRange[1]
				}
			));

			me.consume(';');
		}

		if (me.consume('else')) {
			statementStart = {
				line: me.token.line,
				character: me.token.lineRange[0]
			};
			body = me.parseBlockShortcut();

			clauses.push(me.astProvider.elseShortcutClause(
				body,
				statementStart,
				{
					line: me.token.line,
					character: me.token.lineRange[1]
				}
			));

			me.consume(';');
		}

		me.consumeMany([';', '<eof>']);

		const currentEnd = {
			line: me.previousToken.line,
			character: me.previousToken.lineRange[1]
		};

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
		const clauses: ASTBase[] = [];
		const start = {
			line: me.previousToken.line,
			character: me.previousToken.lineRange[0]
		};
		const ifStatement = me.astProvider.ifStatement(
			clauses,
			start,
			null
		);
		let statementStart = start;
		let condition;
		let body;

		condition = me.parseExpectedExpression();
		me.expect('then');

		if (TokenType.EOL !== me.token.type) return me.parseIfShortcutStatement(condition, start);

		body = me.parseBlock();
		clauses.push(me.astProvider.ifClause(condition, body, statementStart, {
			line: me.token.line,
			character: me.token.lineRange[1]
		}));

		while (me.consume('else if')) {
			statementStart = {
				line: me.token.line,
				character: me.token.lineRange[0]
			};
			condition = me.parseExpectedExpression();
			me.expect('then');
			body = me.parseBlock();
			clauses.push(me.astProvider.elseifClause(condition, body, statementStart, {
				line: me.token.line,
				character: me.token.lineRange[1]
			}));
		}

		if (me.consume('else')) {
			statementStart = {
				line: me.token.line,
				character: me.token.lineRange[0]
			};
			body = me.parseBlock();
			clauses.push(me.astProvider.elseClause(body, statementStart, {
				line: me.token.line,
				character: me.token.lineRange[1]
			}));
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

		ifStatement.end = {
			line: me.previousToken.line,
			character: me.previousToken.lineRange[1]
		};

		return ifStatement;
	}

	parseReturnStatement(isShortcutStatement: boolean = false): ASTReturnStatement {
		const me = this;
		const start = {
			line: me.previousToken.line,
			character: me.previousToken.lineRange[0]
		};
		const expression = me.parseExpression();

		if (!isShortcutStatement) me.consume(';');

		return me.astProvider.returnStatement(
			expression,
			start,
			{
				line: me.token.line,
				character: me.token.lineRange[1]
			}
		);
	}

	parseFunctionName(): ASTBase {
		const me = this;
		const start = {
			line: me.token.line,
			character: me.token.lineRange[0]
		};
		let base;
		let name;
		let marker;

		base = me.parseIdentifier();

		while (me.consume('.')) {
			name = me.parseIdentifier();
			base = me.astProvider.memberExpression(
				base,
				'.',
				name,
				start,
				{
					line: me.token.line,
					character: me.token.lineRange[1]
				}
			);
		}

		return base;
	}

	parseAssignmentOrCallStatement(): ASTBase {
		const me = this;
		const start = {
			line: me.token.line,
			character: me.token.lineRange[0]
		};
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
			return me.raise(new UnexpectedAssignmentOrCall(me.token));
		}

		if (me.validator.isExpressionOperator(<Operator>me.token.value)) {
			return me.parseBinaryExpression(base);
		}

		while (
			TokenType.Punctuator === me.token.type &&
			'=' !== me.token.value &&
			';' !== me.token.value &&
			')' !== me.token.value &&
			'<eof>' !== me.token.value
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

			return me.astProvider.callStatement(base, start, {
				line: me.token.line,
				character: me.token.lineRange[1]
			});
		}

		me.expect('=');

		const value = me.parseExpectedExpression();

		return me.astProvider.assignmentStatement(
			base,
			value,
			start,
			{
				line: me.token.line,
				character: me.token.lineRange[1]
			}
		);
	}

	parseForStatement(): ASTForGenericStatement {
		const me = this;
		const start = {
			line: me.previousToken.line,
			character: me.previousToken.lineRange[0]
		};

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
			me.expectMany([';', '<eof>']);
		}

		return me.astProvider.forGenericStatement(
			variable,
			iterator,
			body,
			start,
			{
				line: me.previousToken.line,
				character: me.previousToken.lineRange[1]
			}
		);
	}

	parseFunctionDeclaration(): ASTFunctionStatement | ASTBase {
		const me = this;
		const start = {
			line: me.previousToken.line,
			character: me.previousToken.lineRange[0]
		};
		const parameters = [];

		me.expect('(');

		if (!me.consume(')')) {
			while (true) {
				if (TokenType.Identifier === me.token.type) {
					let parameter: ASTBase = me.parseIdentifier();
					const paramterStart = parameter.start;

					if (me.consume('=')) {
						const value = me.parseExpectedExpression();
						parameter = me.astProvider.assignmentStatement(
							parameter,
							value,
							paramterStart,
							{
								line: me.token.line,
								character: me.token.lineRange[1]
							}
						);
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

		return me.astProvider.functionStatement(
			parameters,
			body,
			start,
			{
				line: me.previousToken.line,
				character: me.previousToken.lineRange[1]
			}
		);
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
						line: me.previousToken.line,
						character: me.previousToken.lineRange[0]
					}, {
						line: me.previousToken.line,
						character: me.previousToken.lineRange[1]
					});
				case 'break':
					me.next();
					return me.astProvider.breakStatement({
						line: me.previousToken.line,
						character: me.previousToken.lineRange[0]
					}, {
						line: me.previousToken.line,
						character: me.previousToken.lineRange[1]
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
	};

	parseBlockShortcut(): ASTBase[] {
		const me = this;
		const block = [];
		let statement;
		let value = me.token.value;

		while (
			me.token.type !== TokenType.EOL &&
			!me.validator.isBreakingBlockShortcutKeyword(value)
		) {
			statement = me.parseStatement('return' === value);
			if (statement) block.push(statement);
			value = me.token.value;
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

	parseChunk(): ASTChunk | ASTBase {
		const me = this;

		me.next();

		const start = {
			line: me.token.line,
			character: me.token.lineRange[0]
		};
		const body = me.parseBlock();

		if (TokenType.EOF !== me.token.type) {
			return me.raise(new UnexpectedEOF(me.token));
		}

		return me.astProvider.chunk(
			body,
			me.nativeImports,
			me.namespaces,
			me.literals,
			start,
			{
				line: me.token.line,
				character: me.token.lineRange[1]
			}
		);
	};

	raise(err: Error): ASTBase {
		const me = this;

		me.errors.push(err);

		if (me.unsafe) {
			const start = {
				line: me.token.line,
				character: me.token.lineRange[0]
			};
			const end = {
				line: me.token.line,
				character: me.token.lineRange[1]
			};
			const base = me.astProvider.invalidCodeExpression(start, end);

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