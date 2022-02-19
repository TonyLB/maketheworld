// AUTOGENERATED FILE
// This file was generated from wml.ohm by `ohm generateBundles`.

import {
  ActionDict,
  Grammar,
  IterationNode,
  Node,
  NonterminalNode,
  Semantics,
  TerminalNode
} from 'ohm-js';

export interface WorldMarkupLangageActionDict<T> extends ActionDict<T> {
  WMLFileContents?: (this: NonterminalNode, arg0: NonterminalNode) => T;
  CharacterExpression?: (this: NonterminalNode, arg0: NonterminalNode) => T;
  CharacterLegalContents?: (this: NonterminalNode, arg0: NonterminalNode) => T;
  AssetExpression?: (this: NonterminalNode, arg0: NonterminalNode) => T;
  AssetLegalContents?: (this: NonterminalNode, arg0: NonterminalNode) => T;
  ImportExpression?: (this: NonterminalNode, arg0: NonterminalNode) => T;
  ImportLegalContents?: (this: NonterminalNode, arg0: NonterminalNode) => T;
  UseExpression?: (this: NonterminalNode, arg0: NonterminalNode) => T;
  DependencyExpression?: (this: NonterminalNode, arg0: NonterminalNode) => T;
  VariableExpression?: (this: NonterminalNode, arg0: NonterminalNode) => T;
  ComputedExpression?: (this: NonterminalNode, arg0: NonterminalNode) => T;
  ActionExpression?: (this: NonterminalNode, arg0: NonterminalNode) => T;
  ConditionExpression?: (this: NonterminalNode, arg0: NonterminalNode) => T;
  ConditionLegalContents?: (this: NonterminalNode, arg0: NonterminalNode) => T;
  LayerExpression?: (this: NonterminalNode, arg0: NonterminalNode) => T;
  LayerLegalContents?: (this: NonterminalNode, arg0: NonterminalNode) => T;
  ExitExpression?: (this: NonterminalNode, arg0: NonterminalNode) => T;
  LinkExpression?: (this: NonterminalNode, arg0: NonterminalNode) => T;
  RoomExpression?: (this: NonterminalNode, arg0: NonterminalNode) => T;
  RoomContents?: (this: NonterminalNode, arg0: NonterminalNode) => T;
  LiteralNameExpression?: (this: NonterminalNode, arg0: NonterminalNode) => T;
  NameExpression?: (this: NonterminalNode, arg0: NonterminalNode) => T;
  LiteralValueTag?: (this: NonterminalNode, arg0: NonterminalNode) => T;
  ValueTag?: (this: NonterminalNode, arg0: NonterminalNode) => T;
  TextContents?: (this: NonterminalNode, arg0: NonterminalNode) => T;
  TagExpression?: (this: NonterminalNode, arg0: NonterminalNode, arg1: IterationNode, arg2: NonterminalNode) => T;
  string?: (this: NonterminalNode, arg0: IterationNode) => T;
  stringText?: (this: NonterminalNode, arg0: IterationNode) => T;
  legalKey?: (this: NonterminalNode, arg0: IterationNode) => T;
  spaceCompressor?: (this: NonterminalNode, arg0: IterationNode) => T;
  TagSelfClosing?: (this: NonterminalNode, arg0: TerminalNode, arg1: Node, arg2: IterationNode, arg3: TerminalNode) => T;
  TagOpen?: (this: NonterminalNode, arg0: TerminalNode, arg1: Node, arg2: IterationNode, arg3: TerminalNode) => T;
  TagArgument?: (this: NonterminalNode, arg0: NonterminalNode) => T;
  TagLiteralArgument?: (this: NonterminalNode, arg0: NonterminalNode) => T;
  TagProgramArgument?: (this: NonterminalNode, arg0: NonterminalNode) => T;
  tagBooleanArgument?: (this: NonterminalNode, arg0: Node, arg1: NonterminalNode | TerminalNode) => T;
  tagArgumentQuoted?: (this: NonterminalNode, arg0: Node, arg1: TerminalNode, arg2: NonterminalNode) => T;
  TagArgumentKey?: (this: NonterminalNode, arg0: Node, arg1: TerminalNode, arg2: NonterminalNode, arg3: TerminalNode) => T;
  TagArgumentBracketed?: (this: NonterminalNode, arg0: Node, arg1: TerminalNode, arg2: IterationNode, arg3: TerminalNode) => T;
  tagArgValueQuoted?: (this: NonterminalNode, arg0: IterationNode, arg1: TerminalNode) => T;
  TagClose?: (this: NonterminalNode, arg0: TerminalNode, arg1: Node, arg2: TerminalNode) => T;
  none?: (this: NonterminalNode, arg0: TerminalNode) => T;
  EmbeddedJSExpression?: (this: NonterminalNode, arg0: TerminalNode, arg1: IterationNode, arg2: TerminalNode) => T;
  JSExpression?: (this: NonterminalNode, arg0: NonterminalNode) => T;
  JSDoubleQuotedString?: (this: NonterminalNode, arg0: TerminalNode, arg1: IterationNode, arg2: TerminalNode) => T;
  JSNoDoubleQuote?: (this: NonterminalNode, arg0: NonterminalNode | TerminalNode) => T;
  JSSingleQuotedString?: (this: NonterminalNode, arg0: TerminalNode, arg1: IterationNode, arg2: TerminalNode) => T;
  JSNoSingleQuote?: (this: NonterminalNode, arg0: NonterminalNode | TerminalNode) => T;
  JSTemplateString?: (this: NonterminalNode, arg0: TerminalNode, arg1: IterationNode, arg2: TerminalNode) => T;
  JSTemplateEvaluation?: (this: NonterminalNode, arg0: TerminalNode, arg1: NonterminalNode, arg2: TerminalNode) => T;
  JSNoBackQuote?: (this: NonterminalNode, arg0: NonterminalNode | TerminalNode) => T;
  JSText?: (this: NonterminalNode, arg0: IterationNode) => T;
  space?: (this: NonterminalNode, arg0: NonterminalNode) => T;
  sourceCharacter?: (this: NonterminalNode, arg0: NonterminalNode) => T;
  whitespace_verticalTab?: (this: NonterminalNode, arg0: TerminalNode) => T;
  whitespace_formFeed?: (this: NonterminalNode, arg0: TerminalNode) => T;
  whitespace_noBreakSpace?: (this: NonterminalNode, arg0: TerminalNode) => T;
  whitespace_byteOrderMark?: (this: NonterminalNode, arg0: TerminalNode) => T;
  whitespace?: (this: NonterminalNode, arg0: NonterminalNode | TerminalNode) => T;
  unicodeSpaceSeparator?: (this: NonterminalNode, arg0: TerminalNode) => T;
  lineTerminator?: (this: NonterminalNode, arg0: TerminalNode) => T;
  lineTerminatorSequence?: (this: NonterminalNode, arg0: TerminalNode) => T;
  comment?: (this: NonterminalNode, arg0: NonterminalNode) => T;
  multiLineComment?: (this: NonterminalNode, arg0: TerminalNode, arg1: IterationNode, arg2: TerminalNode) => T;
  singleLineComment?: (this: NonterminalNode, arg0: TerminalNode, arg1: IterationNode) => T;
}

export interface WorldMarkupLangageSemantics extends Semantics {
  addOperation<T>(name: string, actionDict: WorldMarkupLangageActionDict<T>): this;
  extendOperation<T>(name: string, actionDict: WorldMarkupLangageActionDict<T>): this;
  addAttribute<T>(name: string, actionDict: WorldMarkupLangageActionDict<T>): this;
  extendAttribute<T>(name: string, actionDict: WorldMarkupLangageActionDict<T>): this;
}

export interface WorldMarkupLangageGrammar extends Grammar {
  createSemantics(): WorldMarkupLangageSemantics;
  extendSemantics(superSemantics: WorldMarkupLangageSemantics): WorldMarkupLangageSemantics;
}

declare const grammar: WorldMarkupLangageGrammar;
export default grammar;

