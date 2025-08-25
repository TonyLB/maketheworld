import { AssetUUID, SchemaTag, SchemaToWMLTopLevelOptions } from "@tonylb/mtw-base/ts/schema"
import { ParsePropertyTypes, ParseTagOpen, ParseTagSelfClosure } from "../../simpleParser/baseClasses"
import { GenericTree, GenericTreeNode } from "@tonylb/mtw-base/ts/genericTree"
import { PrintMapResult } from "@tonylb/mtw-base/ts/schema/printMap";

export type SchemaConverterArguments = {
    parseOpen: ParseTagOpen | ParseTagSelfClosure;
    contextStack: GenericTree<SchemaTag>;
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
    [K in keyof V]: V[K] extends { type: ParsePropertyTypes.Boolean } ? boolean : 
                     V[K] extends { type: ParsePropertyTypes.Asset } ? AssetUUID :
                     V[K] extends { type: ParsePropertyTypes.AssetList } ? AssetUUID[] :
                     string
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
    typeCheckContents?: (item: SchemaTag, contextStack: GenericTree<SchemaTag>) => boolean;
    validateContents?: ConverterMapValidateProperties;
    finalize?: (initialTag: SchemaTag, contents: GenericTree<SchemaTag>, contextStack: GenericTree<SchemaTag>) => GenericTreeNode<SchemaTag>;
    //
    // wrapper and aggregate are for tags that wrap their sibling groups together (e.g. If/ElseIf/Else). If wrapper is
    // present but aggregate is not then a wrapper is created. If aggregate is present then a previous wrapper must
    // already exist on contextStack, and the aggregate function is used to turn that wrapper object (together with
    // its current children) into the new wrapper object (with, presumably, updated children)
    //
    wrapper?: 'Replace';
    aggregate?: (previous: GenericTreeNode<SchemaTag>, node: GenericTreeNode<SchemaTag>) => GenericTreeNode<SchemaTag>;
}

export const isSchemaWrapper = (tag: SchemaTag['tag']): tag is 'Replace' => (['Replace'].includes(tag))

export type SchemaToWMLOptions = {
    indent: number;
    context: SchemaTag[];
    siblings?: GenericTree<SchemaTag>;
    multipleInCategory?: boolean;
} & SchemaToWMLTopLevelOptions

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
    (args: PrintMapEntryArguments): PrintMapResult[];
}

export type SchemaTagPrintItemSingle = {
    type: 'single' | 'singleFreeText';
    tag: GenericTreeNode<SchemaTag>;
}

export type SchemaTagPrintItemGroup = {
    type: 'adjacentGroup';
    tags: GenericTree<SchemaTag>;
}

export type SchemaTagPrintItem = SchemaTagPrintItemSingle | SchemaTagPrintItemGroup

export const isSchemaTagPrintItemSingle = (item: SchemaTagPrintItem): item is SchemaTagPrintItemSingle => (['single', 'singleFreeText'].includes(item.type))
export const isSchemaTagPrintItemFreeText = (item: SchemaTagPrintItem) => (['adjacentGroup', 'singleFreeText'].includes(item.type))
