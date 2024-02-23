export enum ParsePropertyTypes {
    Key,
    Literal,
    Expression,
    Boolean
}

type ParsePropertyBase = {
    key?: string;
}

export type ParsePropertyKey = {
    type: ParsePropertyTypes.Key;
    value: string;
} & ParsePropertyBase

export type ParsePropertyLiteral = {
    type: ParsePropertyTypes.Literal;
    value: string;
} & ParsePropertyBase

export type ParsePropertyExpression = {
    type: ParsePropertyTypes.Expression;
    value: string;
} & ParsePropertyBase

export type ParsePropertyBoolean = {
    type: ParsePropertyTypes.Boolean;
    value: boolean;
} & ParsePropertyBase

export type ParseProperty = ParsePropertyKey | ParsePropertyLiteral | ParsePropertyExpression | ParsePropertyBoolean

export enum ParseTypes {
    Open,
    SelfClosure,
    Close,
    Text
}

export type ParseTagOpen = {
    type: ParseTypes.Open;
    tag: string;
    properties: ParseProperty[];
}

export type ParseTagSelfClosure = {
    type: ParseTypes.SelfClosure;
    tag: string;
    properties: ParseProperty[];
}

export type ParseTagClose = {
    type: ParseTypes.Close;
    tag: string;
}

export type ParseFreeText = {
    type: ParseTypes.Text;
    text: string;
}

export type ParseItem = ParseTagOpen | ParseTagSelfClosure | ParseTagClose | ParseFreeText

type ParseConditionLegalContextTag = 'Asset' | 'Description' | 'Room' | 'Feature' | 'Knowledge' | 'Map' | 'Bookmark' | 'Message' | 'Moment'
export const isLegalParseConditionContextTag = (value: string): value is ParseConditionLegalContextTag => (['Asset', 'Name', 'Description', 'Room', 'Feature', 'Knowledge', 'Bookmark', 'Map', 'Message', 'Moment'].includes(value))

export class ParseException extends Error {
    startToken: number
    endToken: number
    constructor(message: string, startToken: number, endToken: number) {
        super(message)
        this.name = 'ParseException'
        this.startToken = startToken
        this.endToken = endToken
    }
}
