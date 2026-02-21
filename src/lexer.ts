import LexerBase, { LexerOptions as LexerOptionsBase } from 'greybel-core/dist/lexer';
import UnsafeLexerMixin from 'miniscript-core/dist/mixins/unsafe-lexer-mixin';
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

export const UnsafeLexer = UnsafeLexerMixin(Lexer);
export type UnsafeLexer = InstanceType<typeof UnsafeLexer>;
