import { Token, TokenType } from './lexer/token';
import Validator from './lexer/validator';
import { CharacterCode } from './utils/codes';
import { LexerException } from './utils/errors';

export interface LexerOptions {
  validator?: Validator;
  unsafe?: boolean;
  tabWidth?: number;
}

export default class Lexer {
  content: string;
  length: number;
  index: number;
  tokenStart: number | null;
  line: number;
  lineStart: number;
  offset: number;
  tabWidth: number;

  validator: Validator;
  unsafe: boolean;
  errors: Error[];

  constructor(content: string, options: LexerOptions = {}) {
    const me = this;

    me.content = content;
    me.length = content.length;
    me.index = 0;
    me.tokenStart = null;
    me.tabWidth = options.tabWidth || 1;
    me.line = 1;
    me.lineStart = 0;
    me.offset = 0;
    me.validator = options.validator || new Validator();
    me.unsafe = options.unsafe;
    me.errors = [];
  }

  scan(
    code: CharacterCode,
    nextCode: CharacterCode | undefined,
    lastCode: CharacterCode | undefined,
    afterSpace: boolean
  ): Token | null {
    const me = this;
    const validator = me.validator;

    switch (code) {
      case CharacterCode.QUOTE:
        return me.scanStringLiteral(afterSpace);
      case CharacterCode.DOT:
        if (validator.isDecDigit(code)) return me.scanNumericLiteral(afterSpace);
        return me.scanPunctuator('.', afterSpace);
      case CharacterCode.EQUAL:
        if (CharacterCode.EQUAL === nextCode) return me.scanPunctuator('==', afterSpace);
        return me.scanPunctuator('=', afterSpace);
      case CharacterCode.ARROW_LEFT:
        if (CharacterCode.EQUAL === nextCode) return me.scanPunctuator('<=', afterSpace);
        if (CharacterCode.ARROW_LEFT === nextCode)
          return me.scanPunctuator('<<', afterSpace);
        return me.scanPunctuator('<', afterSpace);
      case CharacterCode.ARROW_RIGHT:
        if (CharacterCode.EQUAL === nextCode) return me.scanPunctuator('>=', afterSpace);
        if (CharacterCode.ARROW_RIGHT === nextCode) {
          if (CharacterCode.ARROW_RIGHT === lastCode)
            return me.scanPunctuator('>>>', afterSpace);
          return me.scanPunctuator('>>', afterSpace);
        }
        return me.scanPunctuator('>', afterSpace);
      case CharacterCode.EXCLAMATION_MARK:
        if (CharacterCode.EQUAL === nextCode) return me.scanPunctuator('!=', afterSpace);
        return null;
      case CharacterCode.MINUS:
        if (CharacterCode.EQUAL === nextCode) return me.scanPunctuator('-=', afterSpace);
        return me.scanPunctuator('-', afterSpace);
      case CharacterCode.PLUS:
        if (CharacterCode.EQUAL === nextCode) return me.scanPunctuator('+=', afterSpace);
        return me.scanPunctuator('+', afterSpace);
      case CharacterCode.ASTERISK:
        if (CharacterCode.EQUAL === nextCode) return me.scanPunctuator('*=', afterSpace);
        return me.scanPunctuator('*', afterSpace);
      case CharacterCode.SLASH:
        if (CharacterCode.EQUAL === nextCode) return me.scanPunctuator('/=', afterSpace);
        return me.scanPunctuator('/', afterSpace);
      case CharacterCode.COLON:
        return me.scanSliceOperator(afterSpace);
      case CharacterCode.CARET:
      case CharacterCode.PERCENT:
      case CharacterCode.COMMA:
      case CharacterCode.CURLY_BRACKET_LEFT:
      case CharacterCode.CURLY_BRACKET_RIGHT:
      case CharacterCode.SQUARE_BRACKETS_LEFT:
      case CharacterCode.SQUARE_BRACKETS_RIGHT:
      case CharacterCode.PARENTHESIS_LEFT:
      case CharacterCode.PARENTHESIS_RIGHT:
      case CharacterCode.AT_SIGN:
      case CharacterCode.AMPERSAND:
      case CharacterCode.VERTICAL_LINE:
        return me.scanPunctuator(String.fromCharCode(code), afterSpace);
      case CharacterCode.NUMBER_0:
      case CharacterCode.NUMBER_1:
      case CharacterCode.NUMBER_2:
      case CharacterCode.NUMBER_3:
      case CharacterCode.NUMBER_4:
      case CharacterCode.NUMBER_5:
      case CharacterCode.NUMBER_6:
      case CharacterCode.NUMBER_7:
      case CharacterCode.NUMBER_8:
      case CharacterCode.NUMBER_9:
        return me.scanNumericLiteral(afterSpace);
      case CharacterCode.SEMICOLON:
        me.nextIndex();
        return me.createEOL(afterSpace);
      default:
        return null;
    }
  }

  isNotEOF(): boolean {
    const me = this;
    return me.index < me.length;
  }

  nextIndex(value: number = 1): number {
    const me = this;
    me.index = me.index + value;
    return me.index;
  }

  codeAt(offset: number = 0): CharacterCode {
    const me = this;
    return <CharacterCode>me.content.charCodeAt(me.index + offset);
  }

  nextLine(): number {
    const me = this;
    me.line = me.line + 1;
    return me.line;
  }

  isStringEscaped(): boolean {
    return CharacterCode.QUOTE === this.codeAt(1);
  }

  createEOL(afterSpace: boolean): Token {
    const me = this;

    return new Token({
      type: TokenType.EOL,
      value: ';',
      line: me.line,
      lineStart: me.lineStart,
      range: [me.tokenStart, me.index],
      offset: me.offset,
      afterSpace
    });
  }

  scanStringLiteral(afterSpace: boolean): Token {
    const me = this;
    const beginLine = me.line;
    const beginLineStart = me.lineStart;
    const stringStart = me.index + 1;
    let string = '';
    let code;

    while (true) {
      me.nextIndex();
      code = me.codeAt();

      if (me.validator.isEndOfLine(code)) {
        me.nextLine();
      }

      if (CharacterCode.QUOTE === code) {
        if (me.isStringEscaped()) {
          me.nextIndex();
        } else {
          break;
        }
      }
      if (!me.isNotEOF()) {
        const line = beginLine;
        return me.raise(`Unexpected string ending at line ${line}.`, line
        );
      }
    }

    me.nextIndex();
    string = me.content.slice(stringStart, me.index - 1).replace(/""/g, '"');

    return new Token({
      type: TokenType.StringLiteral,
      value: string,
      line: beginLine,
      lineStart: beginLineStart,
      range: [me.tokenStart, me.index],
      offset: me.offset,
      afterSpace,
      lastLine: me.line,
      lastLineStart: me.lineStart
    });
  }

  readDecLiteral(): {
    value: number;
    hasFractionPart: boolean;
  } {
    const me = this;
    const validator = me.validator;

    while (validator.isDecDigit(me.codeAt())) me.nextIndex();

    let foundFraction = false;
    if (CharacterCode.DOT === me.codeAt()) {
      foundFraction = true;
      me.nextIndex();
      while (validator.isDecDigit(me.codeAt())) me.nextIndex();
    }

    const notation = me.codeAt();
    if (
      CharacterCode.LETTER_E === notation ||
      CharacterCode.LETTER_e === notation
    ) {
      me.nextIndex();
      const operation = me.codeAt();
      if (CharacterCode.MINUS === operation || CharacterCode.PLUS === operation)
        me.nextIndex();
      while (validator.isDecDigit(me.codeAt())) me.nextIndex();
    }

    return {
      value: parseFloat(me.content.slice(me.tokenStart, me.index)),
      hasFractionPart: foundFraction
    };
  }

  scanNumericLiteral(afterSpace: boolean): Token {
    const me = this;
    const literal = me.readDecLiteral();

    return new Token({
      type: TokenType.NumericLiteral,
      value: literal.value,
      line: me.line,
      lineStart: me.lineStart,
      range: [me.tokenStart, me.index],
      offset: me.offset,
      afterSpace
    });
  }

  scanPunctuator(value: string, afterSpace: boolean): Token {
    const me = this;

    me.index = me.index + value.length;

    return new Token({
      type: TokenType.Punctuator,
      value,
      line: me.line,
      lineStart: me.lineStart,
      range: [me.tokenStart, me.index],
      offset: me.offset,
      afterSpace
    });
  }

  scanSliceOperator(afterSpace: boolean): Token {
    const me = this;

    me.index++;

    return new Token({
      type: TokenType.SliceOperator,
      value: ':',
      line: me.line,
      lineStart: me.lineStart,
      range: [me.tokenStart, me.index],
      offset: me.offset,
      afterSpace
   } );
  }

  skipToNextLine() {
    const me = this;
    let code = me.codeAt();

    while (!me.validator.isEndOfLine(code) && me.isNotEOF()) {
      me.nextIndex();
      code = me.codeAt();
    }

    me.nextLine();
    me.offset = me.index;

    return me.next();
  }

  skipWhiteSpace() {
    const me = this;

    while (me.isNotEOF()) {
      const code = me.codeAt();
      if (code === CharacterCode.WHITESPACE) {
        me.nextIndex();
      } else if (code === CharacterCode.TAB) {
        me.offset -= me.tabWidth - 1;
        me.nextIndex();
      } else {
        break;
      }
    }
  }

  scanIdentifierOrKeyword(afterSpace: boolean): Token {
    const me = this;
    const validator = me.validator;

    me.nextIndex();

    while (validator.isIdentifierPart(me.codeAt())) {
      me.nextIndex();
    }

    let value: any = me.content.slice(me.tokenStart, me.index);
    let type: TokenType;

    if (validator.isKeyword(value)) {
      type = TokenType.Keyword;

      if (value === 'end') {
        me.nextIndex();

        while (validator.isIdentifierPart(me.codeAt())) {
          me.nextIndex();
        }
        value = me.content.slice(me.tokenStart, me.index);
      } else if (value === 'else') {
        const elseIfStatement = me.content.slice(me.tokenStart, me.index + 3);
        if (elseIfStatement === 'else if') {
          me.nextIndex(3);
          value = elseIfStatement;
        }
      }
    } else if (value === 'true' || value === 'false') {
      type = TokenType.BooleanLiteral;
      value = value === 'true';
    } else if (value === 'null') {
      type = TokenType.NilLiteral;
      value = null;
    } else {
      type = TokenType.Identifier;
    }

    return new Token({
      type,
      value,
      line: me.line,
      lineStart: me.lineStart,
      range: [me.tokenStart, me.index],
      offset: me.offset,
      afterSpace
    });
  }

  scanComment() {
    const me = this;
    const validator = me.validator;

    while (me.isNotEOF()) {
      if (validator.isEndOfLine(me.codeAt())) break;
      me.nextIndex();
    }
  }

  next(): Token {
    const me = this;
    const validator = me.validator;

    const oldPosition = me.index;
    me.skipWhiteSpace();

    const afterSpace = oldPosition < me.index;

    while (validator.isComment(me.codeAt(), me.codeAt(1))) {
      me.tokenStart = me.index;
      me.scanComment();
    }

    if (!me.isNotEOF()) {
      return new Token({
        type: TokenType.EOF,
        value: '<eof>',
        line: me.line,
        lineStart: me.lineStart,
        range: [me.index, me.index],
        offset: me.offset,
        afterSpace
      });
    }

    const code = me.codeAt();
    const nextCode = me.codeAt(1);
    const lastCode = me.codeAt(2);

    me.tokenStart = me.index;

    if (validator.isEndOfLine(code)) {
      if (
        CharacterCode.NEW_LINE === code &&
        CharacterCode.RETURN_LINE === nextCode
      )
        me.nextIndex();
      if (
        CharacterCode.RETURN_LINE === code &&
        CharacterCode.NEW_LINE === nextCode
      )
        me.nextIndex();

      const token = me.createEOL(afterSpace);

      me.nextLine();
      me.offset = me.index + 1;
      me.lineStart = me.nextIndex();

      return token;
    }

    if (validator.isIdentifierStart(code)) return me.scanIdentifierOrKeyword(afterSpace);

    const item = me.scan(code, nextCode, lastCode, afterSpace);

    if (item) return item;

    return me.raise(
      `Invalid character ${code} (Code: ${String.fromCharCode(
        code
      )}) at line ${me.line}.`, me.line
    );
  }

  raise(message: string, line: number): Token {
    const me = this;
    const err = new LexerException(message, line);

    me.errors.push(err);

    if (me.unsafe) {
      me.skipToNextLine();
      return me.next();
    }

    throw err;
  }
}
