import { TokenType } from '../lexer/token';
import { Operator } from '../types/operators';

export default class Validator {
	getBreakingBlockShortcutKeywords(): string[] {
		return [
			'else',
			'else if',
			'<eof>',
			'end for',
			'end while',
			'end function',
			'end if'
		];
	}

	getNatives(): string[] {
		return [
			'globals',
			'locals',
			'sqrt',
			'hash',
			'abs',
			'floor',
			'range',
			'round',
			'sign',
			'str',
			'ceil',
			'acos',
			'asin',
			'atan',
			'tan',
			'cos',
			'sin',
			'launch_path',
			'hasIndex',
			'rnd',
			'slice',
			'pi',
			'typeof',
			'self',
			'params',
			'char',
			'globals',
			'locals',
			'print',
			'wait',
			'time',
			'typeof',
			'md5',
			'get_router',
			'get_shell',
			'nslookup',
			'whois',
			'is_valid_ip',
			'is_lan_ip',
			'command_info',
			'current_date',
			'current_path',
			'parent_path',
			'home_dir',
			'program_path',
			'active_user',
			'user_mail_address',
			'user_bank_number',
			'format_columns',
			'user_input',
			'include_lib',
			'bitwise',
			'clear_screen',
			'exit'
		];
	}

	getNonNilLiterals(): TokenType[] {
		return [
			TokenType.StringLiteral,
			TokenType.NumericLiteral,
			TokenType.BooleanLiteral
		];
	}

	getLiterals(): TokenType[] {
		return [
			...this.getNonNilLiterals(),
			TokenType.NilLiteral
		];
	}

	getExpressionOperators(): Operator[] {
		return [
			Operator.Plus,
			Operator.Asterik,
			Operator.Minus,
			Operator.Slash,
			Operator.PercentSign,
			Operator.LessThan,
			Operator.GreaterThan,
			Operator.LessThanOrEqual,
			Operator.GreaterThanOrEqual,
			Operator.NotEqual,
			Operator.Equal,
			Operator.Or,
			Operator.And,
			Operator.BitwiseAnd,
			Operator.BitwiseOr,
			Operator.Xor,
			Operator.LeftShift,
			Operator.RightShift,
			Operator.UnsignedRightShift
		];
	}

	isBreakingBlockShortcutKeyword(value: string): boolean {
		return this.getBreakingBlockShortcutKeywords().indexOf(value) !== -1;
	}

	isNative(value: string): boolean {
		return this.getNatives().indexOf(value) !== -1;
	}

	isNonNilLiteral(type: TokenType): boolean {
		return this.getNonNilLiterals().indexOf(type) !== -1;
	}

	isLiteral(type: TokenType): boolean {
		return this.getLiterals().indexOf(type) !== -1;
	}
	isExpressionOperator(value: Operator): boolean {
		return this.getExpressionOperators().indexOf(value) !== -1;
	}
}