import {
  ASTBase,
  ASTBaseBlock,
  ASTBaseBlockOptions,
  ASTBaseOptions,
  ASTType
} from './base';

export class ASTClause extends ASTBaseBlock {}

export interface ASTIfStatementOptions extends ASTBaseOptions {
  clauses?: ASTClause[];
}

export class ASTIfStatement extends ASTBase {
  clauses: ASTClause[];

  constructor(
    type: ASTType.IfShortcutStatement | ASTType.IfStatement,
    options: ASTIfStatementOptions
  ) {
    super(type, options);
    this.clauses = options.clauses || [];
  }
}

export interface ASTIfClauseOptions extends ASTBaseBlockOptions {
  condition: ASTBase;
}

export class ASTIfClause extends ASTClause {
  condition: ASTBase;

  constructor(
    type:
      | ASTType.IfShortcutClause
      | ASTType.ElseifShortcutClause
      | ASTType.IfClause
      | ASTType.ElseifClause,
    options: ASTIfClauseOptions
  ) {
    super(type, options);
    this.condition = options.condition;
  }
}

export class ASTElseClause extends ASTClause {
  constructor(
    type: ASTType.ElseShortcutClause | ASTType.ElseClause,
    options: ASTBaseBlockOptions
  ) {
    super(type, options);
  }
}
