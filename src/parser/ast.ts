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
	ListCallExpression = 'ListCallExpression',
	EmptyExpression = 'EmptyExpression',
	IndexExpression = 'IndexExpression',
	BinaryExpression = 'BinaryExpression',
	LogicalExpression = 'LogicalExpression',
	SliceExpression = 'SliceExpression',
	ImportCodeExpression = 'ImportCodeExpression'
}

export interface ASTBase {
	type: string;
	line: number;
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
	key: ASTBase;
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
	gameDirectory: ASTBase;
	fileSystemDirectory: ASTBase;
}

export class ASTProvider {
	breakStatement(line: number): ASTBase {
		return {
			type: ASTType.BreakStatement,
			line
		};
	}

	continueStatement(line: number): ASTBase {
		return {
			type: ASTType.ContinueStatement,
			line
		};
	}

	returnStatement(arg: ASTBase, line: number): ASTReturnStatement {
		return {
			type: ASTType.ReturnStatement,
			argument: arg,
			line: line
		};
	}

	ifShortcutStatement(clauses: ASTBase[], line: number): ASTIfStatement {
		return {
			type: ASTType.IfShortcutStatement,
			clauses,
			line
		};
	}

	ifShortcutClause(condition: ASTBase, body: ASTBase[], line: number): ASTIfClause {
		return {
			type: ASTType.IfShortcutClause,
			condition,
			body,
			line
		};
	}

	elseifShortcutClause(condition: ASTBase, body: ASTBase[], line: number): ASTIfClause {
		return {
			type: ASTType.ElseifShortcutClause,
			condition,
			body,
			line
		};
	}

	elseShortcutClause(body: ASTBase[], line: number): ASTElseClause {
		return {
			type: ASTType.ElseShortcutClause,
			body,
			line
		};
	}

	ifStatement(clauses: ASTBase[], line: number): ASTIfStatement {
		return {
			type: ASTType.IfStatement,
			clauses,
			line
		};
	}

	ifClause(condition: ASTBase, body: ASTBase[], line: number): ASTIfClause {
		return {
			type: ASTType.IfClause,
			condition,
			body,
			line
		};
	}

	elseifClause(condition: ASTBase, body: ASTBase[], line: number): ASTIfClause {
		return {
			type: ASTType.ElseifClause,
			condition,
			body,
			line
		};
	}

	elseClause(body: ASTBase[], line: number): ASTElseClause {
		return {
			type: ASTType.ElseClause,
			body,
			line
		};
	}

	whileStatement(condition: ASTBase, body: ASTBase[], line: number): ASTWhileStatement {
		return {
			type: ASTType.WhileStatement,
			condition,
			body,
			line
		};
	}

	assignmentStatement(variable: ASTBase, init: ASTBase, line: number): ASTAssignmentStatement {
		return {
			type: ASTType.AssignmentStatement,
			variable,
			init,
			line
		};
	}

	callStatement(expression: ASTBase, line: number): ASTCallStatement {
		return {
			type: ASTType.CallStatement,
			expression,
			line
		};
	}

	functionStatement(parameters: ASTBase[], body: ASTBase[], line: number): ASTFunctionStatement {
		return {
			type: ASTType.FunctionDeclaration,
			parameters,
			body,
			line
		};
	}

	forGenericStatement(variable: ASTBase, iterator: ASTBase, body: ASTBase[], line: number): ASTForGenericStatement {
		return {
			type: ASTType.ForGenericStatement,
			variable,
			iterator,
			body,
			line
		};
	}

	chunk(body: ASTBase[], nativeImports: string[], namespaces: Set<string>, literals: ASTBase[], line: number): ASTChunk {
		return {
			type: ASTType.Chunk,
			body,
			nativeImports,
			namespaces,
			literals,
			line
		};
	}

	identifier(name: string, line: number): ASTIdentifier {
		return {
			type: ASTType.Identifier,
			name,
			line
		};
	}

	literal(
		type: TokenType.StringLiteral | TokenType.NumericLiteral | TokenType.BooleanLiteral | TokenType.NilLiteral,
		value: string | number | boolean,
		raw: string | number | boolean,
		line: number
	): ASTLiteral {
		return {
			type,
			value,
			raw,
			line
		};
	}

	memberExpression(base: ASTBase, indexer: string, identifier: ASTBase, line: number): ASTMemberExpression {
		return {
			type: ASTType.MemberExpression,
			indexer,
			identifier,
			base,
			line
		};
	}

	callExpression(base: ASTBase, args: ASTBase[], line: number): ASTCallExpression {
		return {
			type: ASTType.CallExpression,
			base,
			'arguments': args,
			line
		};
	}

	comment(value: string, raw: string, line: number): ASTComment {
		return {
			type: ASTType.Comment,
			value,
			raw,
			line
		};
	}

	unaryExpression(operator: Operator, arg: ASTBase, line: number): ASTUnaryExpression {
		if (operator === Operator.Not) {
			return {
				type: ASTType.NegationExpression,
				argument: arg,
				line
			};
		} else if (operator === Operator.Plus || operator === Operator.Minus) {
			return {
				type: ASTType.BinaryNegatedExpression,
				argument: arg,
				operator,
				line
			};
		}

		return {
			type: ASTType.UnaryExpression,
			operator,
			argument: arg,
			line
		};
	}

	mapKeyString(key: ASTBase, value: ASTBase, line: number): ASTMapKeyString {
		return {
			type: ASTType.MapKeyString,
			key,
			value,
			line
		};
	}

	mapConstructorExpression(fields: ASTMapKeyString[], line: number): ASTMapConstructorExpression {
		return {
			type: ASTType.MapConstructorExpression,
			fields,
			line
		};
	}

	listValue(value: ASTBase, line: number): ASTListValue {
		return {
			type: ASTType.ListValue,
			value,
			line
		};
	}

	listConstructorExpression(fields: ASTListValue[], line: number): ASTListConstructorExpression {
		return {
			type: ASTType.ListConstructorExpression,
			fields,
			line
		};
	}

	emptyExpression(line: number): ASTBase {
		return {
			type: ASTType.EmptyExpression,
			line
		};
	}

	indexExpression(base: ASTBase, index: ASTBase, line: number): ASTIndexExpression {
		return {
			type: ASTType.IndexExpression,
			base,
			index,
			line
		};
	}

	binaryExpression(operator: Operator, left: ASTBase, right: ASTBase, line: number): ASTEvaluationExpression {
		let type = ASTType.BinaryExpression;
		if (Operator.And === operator || Operator.Or === operator) type = ASTType.LogicalExpression;

		return {
			type,
			operator,
			left,
			right,
			line
		};
	}
	
	sliceExpression(left: ASTBase, right: ASTBase, line: number): ASTSliceExpression {
		return {
			type: ASTType.SliceExpression,
			left,
			right,
			line
		};
	}

	importCodeExpression(gameDirectory: ASTBase, fileSystemDirectory: ASTBase | null, line: number): ASTImportCodeExpression {
		return {
			type: ASTType.ImportCodeExpression,
			gameDirectory,
			fileSystemDirectory,
			line
		};
	}
}