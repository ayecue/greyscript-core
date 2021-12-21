import { CharacterCode } from '../utils/codes';

export default class Validator {
	getKeywords(index: number): string[] {
		switch (index) {
			case 2:
				return ['if', 'in', 'or'];
			case 3:
				return ['and', 'end', 'for', 'not', 'new'];
			case 4:
				return ['else', 'then'];
			case 5:
				return ['break', 'while'];
			case 6:
				return ['return'];
			case 8:
				return ['function', 'continue'];
			case 11:
				return ['import_code'];
			default:
				return [];
		}
	}

	isKeyword(value: string): boolean {
		const length = value.length;
		const keywords = this.getKeywords(length);
		
		return keywords.indexOf(value) != -1;
	}

	isWhiteSpace(code: CharacterCode): boolean {
		return CharacterCode.WHITESPACE == code || CharacterCode.TAB == code;
	}

	isEndOfLine(code: CharacterCode): boolean {
		return CharacterCode.NEW_LINE == code || CharacterCode.RETURN_LINE == code;
	}

	isComment(code: CharacterCode, nextCode: CharacterCode): boolean {
		return CharacterCode.SLASH == code && CharacterCode.SLASH == nextCode;
	}

	isIdentifierStart (code: number): boolean {
		return (code >= 65 && code <= 90) || 
			(code >= 97 && code <= 122) || 
			95 === code || code >= 128;
	}

	isIdentifierPart (code: number): boolean {
		return  (code >= 65 && code <= 90) || 
			(code >= 97 && code <= 122) || 95 === code || 
			(code >= 48 && code <= 57) || code >= 128;
	}

	isDecDigit (code: CharacterCode): boolean {
		return code >= CharacterCode.NUMBER_0 && code <= CharacterCode.NUMBER_9;
	}
}