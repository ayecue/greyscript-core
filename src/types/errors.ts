import { Range } from './range';

export class LexerException extends Error {
  range: Range;

  constructor(message: string, range: Range) {
    super(`${message} at ${range}`);
    this.range = range;
  }
}

export class ParserException extends Error {
  range: Range;

  constructor(message: string, range: Range) {
    super(`${message} at ${range}`);
    this.range = range;
  }
}
