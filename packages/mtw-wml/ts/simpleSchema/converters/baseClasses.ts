import { SchemaTag } from "../../schema/baseClasses"
import { ParsePropertyTypes, ParseTagOpen, ParseTagSelfClosure } from "../../simpleParser/baseClasses"
import { SchemaContextItem } from "../baseClasses"

export type SchemaConverterArguments = {
    parseOpen: ParseTagOpen | ParseTagSelfClosure;
    contextStack: SchemaContextItem[];
}

export type SchemaInitialConverter = {
    (args: SchemaConverterArguments): SchemaTag
}

export type ValidationTemplateItem = {
    required?: boolean;
    type: ParsePropertyTypes;
}

export type ValidationTemplate = Record<string, ValidationTemplateItem>

export type ValidationTemplateRemap<V extends ValidationTemplate>  ={
    [K in keyof V]: V[K] extends { type: ParsePropertyTypes.Boolean } ? boolean : string
}

export type ValidationRequiredKeys<V extends ValidationTemplate> = {[K in keyof V]: V[K] extends { required: true } ? K : never}[keyof V]

export type ValidationTemplateOutput<V extends ValidationTemplate> = 
    Partial<ValidationTemplateRemap<V>> &
    Pick<ValidationTemplateRemap<V>, ValidationRequiredKeys<V>>
