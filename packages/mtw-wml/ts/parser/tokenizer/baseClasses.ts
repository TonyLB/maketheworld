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
    type: 'ExpressionValue'
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
} & TokenBase

export type TokenError = {
    type: 'Error';
    message: string;
} & TokenBase

export type Token = TokenComment |
    TokenWhitespace |
    TokenExpressionValue |
    TokenKeyValue |
    TokenLiteralValue |
    TokenProperty |
    TokenTagOpenBegin |
    TokenTagOpenEnd |
    TokenTagClose |
    TokenDescription |
    TokenError

export type Tokenizer<T extends TokenBase> = {
    (sourceStream: SourceStream): T | TokenError | undefined
}

export const isTokenError = (item: TokenBase & { type: string }): item is TokenError => (item.type === 'Error')
