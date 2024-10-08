import { GreybelKeyword, LexerValidator } from 'greybel-core';
import { Keyword } from 'miniscript-core';

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
