import { SchemaBase } from "./baseClasses";
import checkTypes, { CheckTypes } from "../utils/checkTypes";

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

export type SchemaDoubleSpaceTag = {
    tag: 'DoubleSpace';
} & SchemaBase

export type SchemaDoubleBRTag = {
    tag: 'DoubleBR';
} & SchemaBase

export type SchemaStringTag = {
    tag: 'String';
    value: string;
} & SchemaBase

export type SchemaWhitespaceTag = {
    tag: 'Whitespace';
} & SchemaBase

export const isSchemaString = (arg: any): arg is SchemaStringTag => (
    checkTypes({ required: { tag: CheckTypes.STRING, value: CheckTypes.STRING }, values: { tag: 'String' } })(arg)
)
export const isSchemaLink = (arg: any): arg is SchemaLinkTag => (
    checkTypes({ required: { tag: CheckTypes.STRING, to: CheckTypes.STRING, text: CheckTypes.STRING }, values: { tag: 'Link' } })(arg)
)
export const isSchemaWhitespace = (arg: any): arg is SchemaWhitespaceTag => (
    checkTypes({ required: { tag: CheckTypes.STRING }, values: { tag: 'Whitespace' } })(arg)
)
export const isSchemaLineBreak = (arg: any): arg is SchemaLineBreakTag => (
    checkTypes({ required: { tag: CheckTypes.STRING }, values: { tag: 'br' } })(arg)
)
export const isSchemaSpacer = (arg: any): arg is SchemaSpacerTag => (
    checkTypes({ required: { tag: CheckTypes.STRING }, values: { tag: 'Space' } })(arg)
)
export const isSchemaDoubleSpace = (arg: any): arg is SchemaDoubleSpaceTag => (
    checkTypes({ required: { tag: CheckTypes.STRING }, values: { tag: 'DoubleSpace' } })(arg)
)
export const isSchemaDoubleBR = (arg: any): arg is SchemaDoubleBRTag => (
    checkTypes({ required: { tag: CheckTypes.STRING }, values: { tag: 'DoubleBR' } })(arg)
)
