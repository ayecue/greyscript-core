import { Operator } from '../types/operators';
import { TokenType } from '../lexer/token';

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
	SliceExpression = 'SliceExpression',
	ImportCodeExpression = 'ImportCodeExpression',
	InvalidCodeExpression = 'InvalidCodeExpression'
}

export interface ASTPosition {
	line: number;
	character: number;
}

export interface ASTBase {
	type: string;
	start: ASTPosition;
	end: ASTPosition;
}

export interface ASTReturnStatement extends ASTBase {
	type: ASTType.ReturnStatement,
	argument?: ASTBase;
}

export interface ASTIfStatement extends ASTBase {
	type: ASTType.IfShortcutStatement | ASTType.IfStatement;
	clauses: ASTBase[];
}

export interface ASTIfClause extends ASTBase {
	type: ASTType.IfShortcutClause | ASTType.ElseifShortcutClause | ASTType.IfClause | ASTType.ElseifClause,
	condition: ASTBase;
	body: ASTBase[];
}

export interface ASTElseClause extends ASTBase {
	type: ASTType.ElseShortcutClause | ASTType.ElseClause;
	body: ASTBase[];
}

export interface ASTWhileStatement extends ASTBase {
	type: ASTType.WhileStatement;
	condition: ASTBase;
	body: ASTBase[];
}

export interface ASTAssignmentStatement extends ASTBase {
	type: ASTType.AssignmentStatement;
	variable: ASTBase;
	init: ASTBase;
}

export interface ASTCallStatement extends ASTBase {
	type: ASTType.CallStatement;
	expression: ASTBase;
}

export interface ASTFunctionStatement extends ASTBase {
	type: ASTType.FunctionDeclaration;
	parameters: ASTBase[];
	body: ASTBase[];
}

export interface ASTForGenericStatement extends ASTBase {
	type: ASTType.ForGenericStatement;
	variable: ASTBase;
	iterator: ASTBase;
	body: ASTBase[];
}

export interface ASTChunk extends ASTBase {
	type: ASTType.Chunk;
	body: ASTBase[];
	nativeImports: string[];
	namespaces: Set<string>;
	literals: ASTBase[];
}

export interface ASTIdentifier extends ASTBase {
	type: ASTType.Identifier;
	name: string;
}

export interface ASTLiteral extends ASTBase {
	value: string | number | boolean;
	raw: string | number | boolean;
}

export interface ASTMemberExpression extends ASTBase {
	type: ASTType.MemberExpression;
	indexer: string;
	identifier: ASTBase;
	base: ASTBase;
}

export interface ASTCallExpression extends ASTBase {
	type: ASTType.CallExpression;
	base: ASTBase;
	arguments: ASTBase[];
}

export interface ASTComment extends ASTBase {
	type: ASTType.Comment;
	value: string;
	raw: string;
}

export interface ASTUnaryExpression extends ASTBase {
	type: ASTType.NegationExpression | ASTType.BinaryNegatedExpression | ASTType.UnaryExpression;
	argument: ASTBase;
	operator?: string;
}

export interface ASTMapKeyString extends ASTBase {
	type: ASTType.MapKeyString;
	key: string;
	value: ASTBase;
}

export interface ASTMapConstructorExpression extends ASTBase {
	type: ASTType.MapConstructorExpression;
	fields: ASTBase[];
}

export interface ASTListValue extends ASTBase {
	type: ASTType.ListValue;
	value: ASTBase;
}

export interface ASTListConstructorExpression extends ASTBase {
	type: ASTType.ListConstructorExpression;
	fields: ASTBase[];
}

export interface ASTIndexExpression extends ASTBase {
	type: ASTType.IndexExpression;
	base: ASTBase;
	index: ASTBase;
}

export interface ASTEvaluationExpression extends ASTBase {
	type: ASTType.BinaryExpression | ASTType.LogicalExpression;
	operator: Operator;
	left: ASTBase;
	right: ASTBase;
}

export interface ASTSliceExpression extends ASTBase {
	type: ASTType.SliceExpression;
	left: ASTBase;
	right: ASTBase;
}

export interface ASTImportCodeExpression extends ASTBase {
	type: ASTType.ImportCodeExpression;
	gameDirectory: string;
	fileSystemDirectory: string;
}

export class ASTProvider {
	breakStatement(start: ASTPosition, end: ASTPosition): ASTBase {
		return {
			type: ASTType.BreakStatement,
			start,
			end
		};
	}

	continueStatement(start: ASTPosition, end: ASTPosition): ASTBase {
		return {
			type: ASTType.ContinueStatement,
			start,
			end
		};
	}

	returnStatement(arg: ASTBase, start: ASTPosition, end: ASTPosition): ASTReturnStatement {
		return {
			type: ASTType.ReturnStatement,
			argument: arg,
			start,
			end
		};
	}

	ifShortcutStatement(clauses: ASTBase[], start: ASTPosition, end: ASTPosition): ASTIfStatement {
		return {
			type: ASTType.IfShortcutStatement,
			clauses,
			start,
			end
		};
	}

	ifShortcutClause(condition: ASTBase, body: ASTBase[], start: ASTPosition, end: ASTPosition): ASTIfClause {
		return {
			type: ASTType.IfShortcutClause,
			condition,
			body,
			start,
			end
		};
	}

	elseifShortcutClause(condition: ASTBase, body: ASTBase[], start: ASTPosition, end: ASTPosition): ASTIfClause {
		return {
			type: ASTType.ElseifShortcutClause,
			condition,
			body,
			start,
			end
		};
	}

	elseShortcutClause(body: ASTBase[], start: ASTPosition, end: ASTPosition): ASTElseClause {
		return {
			type: ASTType.ElseShortcutClause,
			body,
			start,
			end
		};
	}

	ifStatement(clauses: ASTBase[], start: ASTPosition, end: ASTPosition): ASTIfStatement {
		return {
			type: ASTType.IfStatement,
			clauses,
			start,
			end
		};
	}

	ifClause(condition: ASTBase, body: ASTBase[], start: ASTPosition, end: ASTPosition): ASTIfClause {
		return {
			type: ASTType.IfClause,
			condition,
			body,
			start,
			end
		};
	}

	elseifClause(condition: ASTBase, body: ASTBase[], start: ASTPosition, end: ASTPosition): ASTIfClause {
		return {
			type: ASTType.ElseifClause,
			condition,
			body,
			start,
			end
		};
	}

	elseClause(body: ASTBase[], start: ASTPosition, end: ASTPosition): ASTElseClause {
		return {
			type: ASTType.ElseClause,
			body,
			start,
			end
		};
	}

	whileStatement(condition: ASTBase, body: ASTBase[], start: ASTPosition, end: ASTPosition): ASTWhileStatement {
		return {
			type: ASTType.WhileStatement,
			condition,
			body,
			start,
			end
		};
	}

	assignmentStatement(variable: ASTBase, init: ASTBase, start: ASTPosition, end: ASTPosition): ASTAssignmentStatement {
		return {
			type: ASTType.AssignmentStatement,
			variable,
			init,
			start,
			end
		};
	}

	callStatement(expression: ASTBase, start: ASTPosition, end: ASTPosition): ASTCallStatement {
		return {
			type: ASTType.CallStatement,
			expression,
			start,
			end
		};
	}

	functionStatement(parameters: ASTBase[], body: ASTBase[], start: ASTPosition, end: ASTPosition): ASTFunctionStatement {
		return {
			type: ASTType.FunctionDeclaration,
			parameters,
			body,
			start,
			end
		};
	}

	forGenericStatement(variable: ASTBase, iterator: ASTBase, body: ASTBase[], start: ASTPosition, end: ASTPosition): ASTForGenericStatement {
		return {
			type: ASTType.ForGenericStatement,
			variable,
			iterator,
			body,
			start,
			end
		};
	}

	chunk(body: ASTBase[], nativeImports: string[], namespaces: Set<string>, literals: ASTBase[], start: ASTPosition, end: ASTPosition): ASTChunk {
		return {
			type: ASTType.Chunk,
			body,
			nativeImports,
			namespaces,
			literals,
			start,
			end
		};
	}

	identifier(name: string, start: ASTPosition, end: ASTPosition): ASTIdentifier {
		return {
			type: ASTType.Identifier,
			name,
			start,
			end
		};
	}

	literal(
		type: TokenType.StringLiteral | TokenType.NumericLiteral | TokenType.BooleanLiteral | TokenType.NilLiteral,
		value: string | number | boolean,
		raw: string | number | boolean,
		start: ASTPosition,
		end: ASTPosition
	): ASTLiteral {
		return {
			type,
			value,
			raw,
			start,
			end
		};
	}

	memberExpression(base: ASTBase, indexer: string, identifier: ASTBase, start: ASTPosition, end: ASTPosition): ASTMemberExpression {
		return {
			type: ASTType.MemberExpression,
			indexer,
			identifier,
			base,
			start,
			end
		};
	}

	callExpression(base: ASTBase, args: ASTBase[], start: ASTPosition, end: ASTPosition): ASTCallExpression {
		return {
			type: ASTType.CallExpression,
			base,
			'arguments': args,
			start,
			end
		};
	}

	comment(value: string, raw: string, start: ASTPosition, end: ASTPosition): ASTComment {
		return {
			type: ASTType.Comment,
			value,
			raw,
			start,
			end
		};
	}

	unaryExpression(operator: Operator, arg: ASTBase, start: ASTPosition, end: ASTPosition): ASTUnaryExpression {
		if (operator === Operator.Not) {
			return {
				type: ASTType.NegationExpression,
				argument: arg,
				start,
				end
			};
		} else if (operator === Operator.Plus || operator === Operator.Minus) {
			return {
				type: ASTType.BinaryNegatedExpression,
				argument: arg,
				operator,
				start,
				end
			};
		}

		return {
			type: ASTType.UnaryExpression,
			operator,
			argument: arg,
			start,
			end
		};
	}

	mapKeyString(key: string, value: ASTBase, start: ASTPosition, end: ASTPosition): ASTMapKeyString {
		return {
			type: ASTType.MapKeyString,
			key,
			value,
			start,
			end
		};
	}

	mapConstructorExpression(fields: ASTMapKeyString[], start: ASTPosition, end: ASTPosition): ASTMapConstructorExpression {
		return {
			type: ASTType.MapConstructorExpression,
			fields,
			start,
			end
		};
	}

	listValue(value: ASTBase, start: ASTPosition, end: ASTPosition): ASTListValue {
		return {
			type: ASTType.ListValue,
			value,
			start,
			end
		};
	}

	listConstructorExpression(fields: ASTListValue[], start: ASTPosition, end: ASTPosition): ASTListConstructorExpression {
		return {
			type: ASTType.ListConstructorExpression,
			fields,
			start,
			end
		};
	}

	emptyExpression(start: ASTPosition, end: ASTPosition): ASTBase {
		return {
			type: ASTType.EmptyExpression,
			start,
			end
		};
	}

	invalidCodeExpression(start: ASTPosition, end: ASTPosition): ASTBase {
		return {
			type: ASTType.InvalidCodeExpression,
			start,
			end
		};
	}

	indexExpression(base: ASTBase, index: ASTBase, start: ASTPosition, end: ASTPosition): ASTIndexExpression {
		return {
			type: ASTType.IndexExpression,
			base,
			index,
			start,
			end
		};
	}

	binaryExpression(operator: Operator, left: ASTBase, right: ASTBase, start: ASTPosition, end: ASTPosition): ASTEvaluationExpression {
		let type = ASTType.BinaryExpression;
		if (Operator.And === operator || Operator.Or === operator) type = ASTType.LogicalExpression;

		return {
			type,
			operator,
			left,
			right,
			start,
			end
		};
	}
	
	sliceExpression(left: ASTBase, right: ASTBase, start: ASTPosition, end: ASTPosition): ASTSliceExpression {
		return {
			type: ASTType.SliceExpression,
			left,
			right,
			start,
			end
		};
	}

	importCodeExpression(gameDirectory: string, fileSystemDirectory: string | null, start: ASTPosition, end: ASTPosition): ASTImportCodeExpression {
		return {
			type: ASTType.ImportCodeExpression,
			gameDirectory,
			fileSystemDirectory,
			start,
			end
		};
	}
}