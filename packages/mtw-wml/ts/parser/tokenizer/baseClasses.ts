import { ParseStackTokenEntry } from "../baseClasses";
import SourceStream from "./sourceStream";

export type TokenBase = {
    startIdx: number;
    endIdx: number;
}

export type TokenComment = {
    type: 'Comment'
} & TokenBase

export type TokenWhitespace = {
    type: 'Whitespace'
} & TokenBase

export type TokenExpressionValue = {
    type: 'ExpressionValue';
    value: string;
} & TokenBase

export type TokenKeyValue = {
    type: 'KeyValue';
    value: string;
} & TokenBase

export type TokenLiteralValue = {
    type: 'LiteralValue';
    value: string;
} & TokenBase

export type TokenBooleanProperty = {
    type: 'Property';
    isBoolean: true;
    key: string;
    value: boolean;
} & TokenBase

export type TokenEqualsProperty = {
    type: 'Property';
    isBoolean: false;
    key: string;
} & TokenBase

export type TokenProperty = TokenBooleanProperty | TokenEqualsProperty

export type TokenTagOpenBegin = {
    type: 'TagOpenBegin',
    tag: string;
} & TokenBase

export type TokenTagOpenEnd = {
    type: 'TagOpenEnd';
    selfClosing: boolean;
} & TokenBase

export type TokenTagClose = {
    type: 'TagClose';
} & TokenBase

export type TokenDescription = {
    type: 'Description';
    value: string;
} & TokenBase

export class TokenizeException extends Error {
    startIdx: number
    endIdx: number
    constructor(message: string, startIdx: number, endIdx: number) {
        super(message)
        this.name = 'TokenizeException'
        this.startIdx = startIdx
        this.endIdx = endIdx
    }
}

export type Token = TokenComment |
    TokenWhitespace |
    TokenExpressionValue |
    TokenKeyValue |
    TokenLiteralValue |
    TokenProperty |
    TokenTagOpenBegin |
    TokenTagOpenEnd |
    TokenTagClose |
    TokenDescription

export type Tokenizer<T extends TokenBase> = {
    (sourceStream: SourceStream): T | undefined
}

export const isTokenProperty = (item: Token): item is TokenProperty => (item.type === 'Property')
export const isTokenKeyValue = (item: Token | boolean): item is TokenKeyValue => (typeof item === 'object' && item.type === 'KeyValue')
export const isTokenValue = (item: Token): item is (TokenKeyValue | TokenLiteralValue | TokenExpressionValue) => (['KeyValue', 'LiteralValue', 'ExpressionValue'].includes(item.type))

export const isStackTokenPropertyOrValue = (item: ParseStackTokenEntry<Token>): item is ParseStackTokenEntry<TokenProperty | TokenKeyValue | TokenLiteralValue | TokenExpressionValue> => (isTokenProperty(item.token) || isTokenValue(item.token))

export const isTokenWhitespace = (item: Token): item is TokenWhitespace => (item.type === 'Whitespace')
export const isTokenComment = (item: Token): item is TokenComment => (item.type === 'Comment')
export const isTokenDescription = (item: Token): item is TokenDescription => (item.type === 'Description')
export const isLegalBareToken = (item: Token): item is (TokenWhitespace | TokenComment | TokenDescription) => (['Whitespace', 'Comment', 'Description'].includes(item.type))
