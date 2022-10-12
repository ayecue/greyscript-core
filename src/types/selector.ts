import { Token, TokenType } from '../lexer/token';
import { Keyword } from './keywords';
import { Operator } from './operators';

export class SelectorOptions {
  type: TokenType;
  value: string;
}

export class Selector {
  type: TokenType;
  value: string;

  constructor({ type, value }: SelectorOptions) {
    this.type = type;
    this.value = value;
  }

  is(token: Token) {
    return this.type === token.type && this.value === token.value;
  }
}

export class SelectorOfType extends Selector {
  constructor({ type }: Omit<SelectorOptions, 'value'>) {
    super({ type, value: undefined });
  }

  is(token: Token) {
    return this.type === token.type;
  }
}

export class SelectorOfValue extends Selector {
  constructor({ value }: Omit<SelectorOptions, 'type'>) {
    super({ type: null, value });
  }

  is(token: Token) {
    return this.value === token.value;
  }
}

export const Selectors: {
  EndOfLine: Selector;
  EndOfFile: Selector;
  LParenthesis: Selector;
  RParenthesis: Selector;
  CLBracket: Selector;
  CRBracket: Selector;
  SLBracket: Selector;
  SRBracket: Selector;
  Assign: Selector;
  AddShorthand: Selector;
  SubtractShorthand: Selector;
  MultiplyShorthand: Selector;
  DivideShorthand: Selector;
  Seperator: Selector;
  Function: Selector;
  EndFunction: Selector;
  EndWhile: Selector;
  EndFor: Selector;
  EndIf: Selector;
  SliceSeperator: Selector;
  MapKeyValueSeperator: Selector;
  MapSeperator: Selector;
  ListSeperator: Selector;
  CallSeperator: Selector;
  ArgumentSeperator: Selector;
  ImportCodeSeperator: Selector;
  ElseIf: Selector;
  Else: Selector;
  Then: Selector;
  In: Selector;
  MemberSeperator: Selector;
  NumberSeperator: Selector;
  Reference: Selector;
  Minus: Selector;
  Plus: Selector;
  New: Selector;
  Not: Selector;
  Comment: Selector;
} = {
  EndOfLine: new Selector({
    type: TokenType.EOL,
    value: Operator.EndOfLine
  }),
  EndOfFile: new Selector({
    type: TokenType.EOF,
    value: Operator.EndOfFile
  }),
  LParenthesis: new Selector({
    type: TokenType.Punctuator,
    value: Operator.LParenthesis
  }),
  RParenthesis: new Selector({
    type: TokenType.Punctuator,
    value: Operator.RParenthesis
  }),
  CLBracket: new Selector({
    type: TokenType.Punctuator,
    value: Operator.CLBracket
  }),
  CRBracket: new Selector({
    type: TokenType.Punctuator,
    value: Operator.CRBracket
  }),
  SLBracket: new Selector({
    type: TokenType.Punctuator,
    value: Operator.SLBracket
  }),
  SRBracket: new Selector({
    type: TokenType.Punctuator,
    value: Operator.SRBracket
  }),
  Assign: new Selector({
    type: TokenType.Punctuator,
    value: Operator.Assign
  }),
  AddShorthand: new Selector({
    type: TokenType.Punctuator,
    value: Operator.AddShorthand
  }),
  SubtractShorthand: new Selector({
    type: TokenType.Punctuator,
    value: Operator.SubtractShorthand
  }),
  MultiplyShorthand: new Selector({
    type: TokenType.Punctuator,
    value: Operator.MultiplyShorthand
  }),
  DivideShorthand: new Selector({
    type: TokenType.Punctuator,
    value: Operator.DivideShorthand
  }),
  Seperator: new Selector({
    type: TokenType.Punctuator,
    value: Operator.ListSeperator
  }),
  Function: new Selector({
    type: TokenType.Keyword,
    value: Keyword.Function
  }),
  EndFunction: new Selector({
    type: TokenType.Keyword,
    value: Keyword.EndFunction
  }),
  EndWhile: new Selector({
    type: TokenType.Keyword,
    value: Keyword.EndWhile
  }),
  EndFor: new Selector({
    type: TokenType.Keyword,
    value: Keyword.EndFor
  }),
  EndIf: new Selector({
    type: TokenType.Keyword,
    value: Keyword.EndIf
  }),
  SliceSeperator: new Selector({
    type: TokenType.SliceOperator,
    value: Operator.SliceSeperator
  }),
  MapKeyValueSeperator: new Selector({
    type: TokenType.SliceOperator,
    value: Operator.SliceSeperator
  }),
  MapSeperator: new Selector({
    type: TokenType.Punctuator,
    value: Operator.ListSeperator
  }),
  ListSeperator: new Selector({
    type: TokenType.Punctuator,
    value: Operator.ListSeperator
  }),
  CallSeperator: new Selector({
    type: TokenType.Punctuator,
    value: Operator.ListSeperator
  }),
  ArgumentSeperator: new Selector({
    type: TokenType.Punctuator,
    value: Operator.ListSeperator
  }),
  ImportCodeSeperator: new Selector({
    type: TokenType.SliceOperator,
    value: Operator.SliceSeperator
  }),
  ElseIf: new Selector({
    type: TokenType.Keyword,
    value: Keyword.ElseIf
  }),
  Then: new Selector({
    type: TokenType.Keyword,
    value: Keyword.Then
  }),
  Else: new Selector({
    type: TokenType.Keyword,
    value: Keyword.Else
  }),
  In: new Selector({
    type: TokenType.Keyword,
    value: Keyword.In
  }),
  MemberSeperator: new Selector({
    type: TokenType.Punctuator,
    value: Operator.Member
  }),
  NumberSeperator: new Selector({
    type: TokenType.Punctuator,
    value: Operator.Member
  }),
  Reference: new Selector({
    type: TokenType.Punctuator,
    value: Operator.Reference
  }),
  Minus: new Selector({
    type: TokenType.Punctuator,
    value: Operator.Minus
  }),
  Plus: new Selector({
    type: TokenType.Punctuator,
    value: Operator.Plus
  }),
  New: new Selector({
    type: TokenType.Keyword,
    value: Keyword.New
  }),
  Not: new Selector({
    type: TokenType.Keyword,
    value: Keyword.Not
  }),
  Comment: new SelectorOfType({
    type: TokenType.Comment
  })
};
