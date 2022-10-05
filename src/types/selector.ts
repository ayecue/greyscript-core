import { TokenType } from '../lexer/token';
import { Keyword } from './keywords';
import { Operator } from './operators';

export interface Selector {
  type: TokenType;
  value: string;
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
} = {
  EndOfLine: {
    type: TokenType.EOL,
    value: Operator.EndOfLine
  },
  EndOfFile: {
    type: TokenType.EOF,
    value: Operator.EndOfFile
  },
  LParenthesis: {
    type: TokenType.Punctuator,
    value: Operator.LParenthesis
  },
  RParenthesis: {
    type: TokenType.Punctuator,
    value: Operator.RParenthesis
  },
  CLBracket: {
    type: TokenType.Punctuator,
    value: Operator.CLBracket
  },
  CRBracket: {
    type: TokenType.Punctuator,
    value: Operator.CRBracket
  },
  SLBracket: {
    type: TokenType.Punctuator,
    value: Operator.SLBracket
  },
  SRBracket: {
    type: TokenType.Punctuator,
    value: Operator.SRBracket
  },
  Assign: {
    type: TokenType.Punctuator,
    value: Operator.Assign
  },
  Seperator: {
    type: TokenType.Punctuator,
    value: Operator.ListSeperator
  },
  Function: {
    type: TokenType.Keyword,
    value: Keyword.Function
  },
  EndFunction: {
    type: TokenType.Keyword,
    value: Keyword.EndFunction
  },
  EndWhile: {
    type: TokenType.Keyword,
    value: Keyword.EndWhile
  },
  EndFor: {
    type: TokenType.Keyword,
    value: Keyword.EndFor
  },
  EndIf: {
    type: TokenType.Keyword,
    value: Keyword.EndIf
  },
  SliceSeperator: {
    type: TokenType.SliceOperator,
    value: Operator.SliceSeperator
  },
  MapKeyValueSeperator: {
    type: TokenType.SliceOperator,
    value: Operator.SliceSeperator
  },
  MapSeperator: {
    type: TokenType.Punctuator,
    value: Operator.ListSeperator
  },
  ListSeperator: {
    type: TokenType.Punctuator,
    value: Operator.ListSeperator
  },
  CallSeperator: {
    type: TokenType.Punctuator,
    value: Operator.ListSeperator
  },
  ArgumentSeperator: {
    type: TokenType.Punctuator,
    value: Operator.ListSeperator
  },
  ImportCodeSeperator: {
    type: TokenType.SliceOperator,
    value: Operator.SliceSeperator
  },
  ElseIf: {
    type: TokenType.Keyword,
    value: Keyword.ElseIf
  },
  Then: {
    type: TokenType.Keyword,
    value: Keyword.Then
  },
  Else: {
    type: TokenType.Keyword,
    value: Keyword.Else
  },
  In: {
    type: TokenType.Keyword,
    value: Keyword.In
  },
  MemberSeperator: {
    type: TokenType.Punctuator,
    value: Operator.Member
  }
};
