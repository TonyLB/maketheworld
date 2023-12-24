import { SchemaTag } from "../baseClasses"
import { ParsePropertyTypes, ParseTagOpen, ParseTagSelfClosure } from "../../simpleParser/baseClasses"
import { SchemaContextItem } from "../baseClasses"
import { GenericTree, GenericTreeNode } from "../../sequence/tree/baseClasses";

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

export type ConverterMapValidateProperties = {
    isValid: (item: SchemaTag) => boolean;
    branchTags: SchemaTag['tag'][];
    leafTags: SchemaTag['tag'][];
}

export type ConverterMapEntry = {
    initialize: SchemaInitialConverter;
    typeCheckContents?: (item: SchemaTag, contextStack: SchemaContextItem[]) => boolean;
    validateContents?: ConverterMapValidateProperties;
    finalize?: (initialTag: SchemaTag, contents: GenericTree<SchemaTag>, contextStack: SchemaContextItem[]) => GenericTreeNode<SchemaTag>;
}

export type SchemaToWMLOptions = {
    indent: number;
    forceNest?: 'closed' | 'contents' | 'properties';
    context: SchemaTag[];
    siblings?: GenericTree<SchemaTag>;
}

export enum PrintMapOptionsChange {
    Sibling,
    Indent
}
export type PrintMapOptionsFactory = {
    (action: PrintMapOptionsChange): (previous: SchemaToWMLOptions) => SchemaToWMLOptions;
}

export type PrintMapEntryArguments = {
    tag: GenericTreeNode<SchemaTag>;
    options: SchemaToWMLOptions;
    optionsFactory: PrintMapOptionsFactory;
    schemaToWML: PrintMapEntry;
}

export type PrintMapEntry = {
    (args: PrintMapEntryArguments): string;
}
