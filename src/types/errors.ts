import { Token } from '../lexer/token';

export class LexerException extends Error {
  line: number;

  constructor(message: string, line: number) {
    super(`${message} at line ${line}`);
    this.line = line;
  }
}

export class ParserException extends Error {
  token: Token;

  constructor(message: string, token: Token) {
    super(`${message} at line ${token.line}`);
    this.token = token;
  }
}
