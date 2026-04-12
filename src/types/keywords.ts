import { GreybelKeyword } from 'greybel-core/dist/types/keywords';
import { Keyword as CoreKeyword } from 'miniscript-core/dist/types/keywords';

export enum GreyScriptKeyword {
  ImportCode = 'import_code'
}

export type Keyword = CoreKeyword | GreybelKeyword | GreyScriptKeyword;
