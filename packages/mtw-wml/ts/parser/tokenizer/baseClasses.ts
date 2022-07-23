import SourceStream from "./sourceStream";

export type TokenBase = {
    source: string;
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
    type: 'KeyValue'
} & TokenBase

export type TokenLiteralValue = {
    type: 'LiteralValue'
}

export type TokenProperty = {
    type: 'Property'
} & TokenBase

export type TokenBeginTagOpen = {
    type: 'BeginTagOpen'
} & TokenBase

export type TokenBeginTagClose = {
    type: 'BeginTagClose';
} & TokenBase

export type TokenEndTag = {
    type: 'EndTag';
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
    TokenBeginTagOpen |
    TokenBeginTagClose |
    TokenEndTag |
    TokenDescription |
    TokenError

export type Tokenizer<T extends Token> = {
    (sourceStream: SourceStream): T | TokenError | undefined
}
