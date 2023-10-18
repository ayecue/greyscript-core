import { Lexer as LexerBase, LexerOptions as LexerOptionsBase } from 'greybel-core';
import Validator from './lexer/validator';

export interface LexerOptions extends LexerOptionsBase {
  validator?: Validator;
}

export default class Lexer extends LexerBase {
  constructor(content: string, options: LexerOptions = {}) {
    options.validator = options.validator || new Validator();
    super(content, options);
  }
}
