import {
  SelectorGroups as GreybelSelectorGroups,
  SelectorGroupType as GreybelSelectorGroupType,
  Selectors as GreybelSelectors
} from 'greybel-core/dist/types/selector';
import { TokenType } from 'miniscript-core/dist/lexer/token';
import { createSelector } from 'miniscript-core/dist/types/selector';
import { compile } from 'miniscript-core/dist/utils/selector-registry';

import { GreyScriptKeyword } from './keywords';

export enum SelectorTypes {
  ImportCode = 'ImportCode'
}

export const Selectors: typeof GreybelSelectors &
  Record<SelectorTypes, ReturnType<typeof createSelector>> = {
  ...GreybelSelectors,
  ImportCode: createSelector({
    type: TokenType.Keyword,
    value: GreyScriptKeyword.ImportCode
  })
};

export { GreybelSelectorGroups as SelectorGroups };
export type { GreybelSelectorGroupType as SelectorGroupType };

compile();
