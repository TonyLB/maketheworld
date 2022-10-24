import SourceStream from "../../parser/tokenizer/sourceStream"

export type SearchTokenWhitespace = {
    type: 'Whitespace';
}

export type SearchTokenTagLegal = "Asset" |
    "Story" |
    "Character" |
    "Name" |
    "Pronouns" |
    "OneCoolThing" |
    "Outfit" |
    "FirstImpression" |
    "Exit" |
    "Description" |
    "Room" |
    "Feature" |
    "Map" |
    "Action" |
    "Computed" |
    "Variable" |
    "If"

export type SearchTokenTag = {
    type: 'Tag';
    tag:  SearchTokenTagLegal;
}

export type SearchTokenString = {
    type: 'String';
    value: string;
}

export type SearchTokenPropertyLegal = 'key' | 'to' | 'from'
export type SearchTokenProperty = {
    type: 'Property';
    key: SearchTokenPropertyLegal;
    value: string;
}

export type SearchTokenFirst = {
    type: 'First';
}

export type SearchTokenNthChild = {
    type: 'NthChild';
    n: number;
}

export type SearchTokenGroupOpen = {
    type: 'GroupOpen';
}

export type SearchTokenGroupClose = {
    type: 'GroupClose';
}

export type SearchTokenComma = {
    type: 'Comma';
}

export type SearchToken = SearchTokenTag |
    SearchTokenString |
    SearchTokenProperty |
    SearchTokenFirst |
    SearchTokenNthChild |
    SearchTokenGroupOpen |
    SearchTokenGroupClose |
    SearchTokenComma |
    SearchTokenWhitespace

export type SearchTokenizer<T extends { type: string }> = {
    (sourceStream: SourceStream): T | undefined
}    

export type SearchParseTag = {
    type: 'Tag';
    tag: SearchTokenTagLegal;
}

export type SearchParseProperty = {
    type: 'Property';
    key: SearchTokenPropertyLegal;
    value: string;
}

export type SearchParseFirst = {
    type: 'First';
}

export type SearchParseNthChild = {
    type: 'NthChild';
    n: number;
}

export type SearchParseParallelGroup = {
    type: 'Parallel';
    items: SearchParse[];
}

export type SearchParseSerialGroup = {
    type: 'Serial';
    items: SearchParse[];
}

export type SearchParseExplicitGroupOpen = {
    type: 'ExplicitOpen';
    token: number;
}

export type SearchParseParallelGroupOpen = {
    type: 'ParallelOpen';
    items: SearchParse[];
}

export type SearchParseComma = {
    type: 'Comma';
}

export type SearchParse = SearchParseTag |
    SearchParseProperty |
    SearchParseFirst |
    SearchParseNthChild |
    SearchParseParallelGroup |
    SearchParseSerialGroup

export type SearchParseEvaluation = SearchParse | SearchParseParallelGroupOpen | SearchParseExplicitGroupOpen | SearchParseComma
