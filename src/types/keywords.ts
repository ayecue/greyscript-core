import { GreybelKeyword } from 'greybel-core';
import { Keyword as CoreKeyword } from 'miniscript-core';

export enum GreyScriptKeyword {
  ImportCode = 'import_code'
}

export type Keyword = CoreKeyword | GreybelKeyword | GreyScriptKeyword;
