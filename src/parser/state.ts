import { ParserState, ParserStateSnapshot } from 'miniscript-core/dist/parser/state';
import { GreybelParserState, GreybelParserStateSnapshot } from 'greybel-core/dist/parser/state';

import { ASTImportCodeExpression } from './ast/import-code';

export interface GreyscriptParserStateSnapshot extends GreybelParserStateSnapshot {
  nativeImportsLength: number;
}

export class GreyscriptParserState extends GreybelParserState {
  nativeImports: ASTImportCodeExpression[];

  constructor() {
    super();
    this.nativeImports = [];
  }

  merge(other: ParserState): void {
    super.merge(other);
    const o = other as GreyscriptParserState;
    this.nativeImports.push(...o.nativeImports);
  }

  snapshot(): GreyscriptParserStateSnapshot {
    return {
      ...super.snapshot(),
      nativeImportsLength: this.nativeImports.length
    };
  }

  restore(snapshot: ParserStateSnapshot): void {
    super.restore(snapshot);
    const s = snapshot as GreyscriptParserStateSnapshot;
    this.nativeImports.length = s.nativeImportsLength;
  }

  createEmpty(): GreyscriptParserState {
    return new GreyscriptParserState();
  }

  clone(): GreyscriptParserState {
    const c = super.clone() as GreyscriptParserState;
    c.nativeImports = [...this.nativeImports];
    return c;
  }
}
