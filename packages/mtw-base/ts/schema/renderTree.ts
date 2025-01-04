import { SchemaBase } from "./baseClasses";

export type SchemaLinkTag = {
    tag: 'Link';
    to: string;
    text: string;
} & SchemaBase

export type SchemaLineBreakTag = {
    tag: 'br';
} & SchemaBase

export type SchemaSpacerTag = {
    tag: 'Space';
} & SchemaBase

export type SchemaStringTag = {
    tag: 'String';
    value: string;
} & SchemaBase

export type SchemaWhitespaceTag = {
    tag: 'Whitespace';
} & SchemaBase

export const isSchemaString = (arg: any): arg is SchemaStringTag => (
    typeof arg === 'object' &&
    'tag' in arg &&
    arg.tag === 'String' &&
    'value' in arg &&
    typeof arg.value === 'string'
)
export const isSchemaLink = (arg: any): arg is SchemaLinkTag => (
    typeof arg === 'object' &&
    'tag' in arg &&
    arg.tag === 'Link' &&
    'to' in arg &&
    typeof arg.to === 'string' &&
    'text' in arg &&
    typeof arg.text === 'string'
)
export const isSchemaWhitespace = (arg: any): arg is SchemaWhitespaceTag => (
    typeof arg === 'object' &&
    'tag' in arg &&
    arg.tag === 'Whitespace'
)
export const isSchemaLineBreak = (arg: any): arg is SchemaLineBreakTag => (
    typeof arg === 'object' &&
    'tag' in arg &&
    arg.tag === 'br'
)
export const isSchemaSpacer = (arg: any): arg is SchemaSpacerTag => (
    typeof arg === 'object' &&
    'tag' in arg &&
    arg.tag === 'Space'
)
