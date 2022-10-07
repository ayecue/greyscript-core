import { Token } from '../lexer/token';

export class LexerException extends Error {
  line: number;

  constructor(message: string, line: number) {
    super(message);
    this.line = line;
  }
}

export class ParserException extends Error {
  token: Token;

  constructor(message: string, token: Token) {
    super(message);
    this.token = token;
  }
}
