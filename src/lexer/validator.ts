import LexerValidator from 'greybel-core/dist/lexer/validator';
import { GreybelKeyword } from 'greybel-core/dist/types/keywords';
import { Keyword } from 'miniscript-core/dist/types/keywords';

import { GreyScriptKeyword } from '../types/keywords';

export default class Validator extends LexerValidator {
  isKeyword = Set.prototype.has.bind(
    new Set([
      ...Object.values(Keyword),
      ...Object.values(GreybelKeyword),
      ...Object.values(GreyScriptKeyword)
    ])
  );
}
