import { isSchemaTaggedMessageLegalContents, SchemaTag } from "../baseClasses"
import { isLegalParseConditionContextTag } from "../../parser/baseClasses"
import { escapeWMLCharacters } from "../../lib/escapeWMLCharacters"
import { isSchemaTagPrintItemSingle, PrintMapEntry, PrintMapEntryArguments, PrintMapResult, PrintMode, SchemaTagPrintItem, SchemaToWMLOptions } from "./baseClasses"
import { areAdjacent, combineResults, indentSpacing, lineLengthAfterIndent, optimalLineResults } from "./printUtils"
import { schemaDescriptionToWML } from "./quantumRender/freeText"
import { optionsFactory } from "./utils"
import { GenericTree, GenericTreeNode } from "../../tree/baseClasses"

type TagRenderProperty = {
    key?: string;
    type: 'key' | 'expression' | 'literal';
    value: string;
} | {
    key: string;
    type: 'boolean';
    value: boolean;
}

export const extractConditionContextTag = (context: SchemaTag[]): SchemaTag["tag"] | undefined => {
    const contextTagRaw = context.reduce<SchemaTag["tag"] | undefined>((previous, item) => {
        const tag = item.tag
        if (isLegalParseConditionContextTag(tag)) {
            return tag
        }
        return previous
    }, undefined)
    return (contextTagRaw ?? '') === 'Bookmark' ? 'Description' : contextTagRaw
}

//
// Parse sequentially through the contents, mapping strings/Tags to renderings of their value, and provide at most two possibilities:
//    - Naive: Everything strung together on a single line
//    - Nested: Each item placed on a separate line if adjacency permits, wrapped appropriately according to the indent level passed
//
export const tagRenderContents = (
        { descriptionContext, schemaToWML, ...options }: SchemaToWMLOptions & {
            descriptionContext: boolean;
            schemaToWML: PrintMapEntry;
        }
    ) => (contents: GenericTree<SchemaTag>): PrintMapResult[] => {
    const { multipleInCategory } = options
    //
    // First you create a list of tags/tag-groups
    //
    const tagPrintItems = contents.reduce<SchemaTagPrintItem[]>((previous, tag) => {
        if (!previous.length) {
            return [{
                type: isSchemaTaggedMessageLegalContents(tag.data) ? 'singleFreeText' as const : 'single' as const,
                tag
            }]
        }
        const lastItem = previous.slice(-1)[0]
        const lastData = isSchemaTagPrintItemSingle(lastItem)
            ? lastItem.tag.data
            : lastItem.tags.slice(-1)[0].data
        if (descriptionContext && isSchemaTaggedMessageLegalContents(lastData) && isSchemaTaggedMessageLegalContents(tag.data) && areAdjacent(lastData, tag.data)) {
            return [
                ...previous.slice(0, -1),
                { type: 'adjacentGroup' as const, tags: [...(isSchemaTagPrintItemSingle(lastItem) ? [lastItem.tag] : lastItem.tags), tag] }
            ]
        }
        else {
            return [
                ...previous,
                {
                    type: isSchemaTaggedMessageLegalContents(tag.data) ? 'singleFreeText' as const : 'single' as const,
                    tag
                }
            ]
        }
    }, [])
    //
    // Second, group the list into freeText and non-freeText lists
    //
    const tagPrintGroups = tagPrintItems.reduce<SchemaTagPrintItem[][]>((previous, item) => {
        if (!previous.length) {
            return [[item]]
        }
        //
        // If incoming item is of the same class (free-text or not) with the 
        // most recent previous grouping then merge it into that grouping
        //
        if (
            (previous.slice(-1)[0][0].type === 'single' && item.type === 'single') ||
            !(previous.slice(-1)[0][0].type === 'single' || item.type === 'single')
        ) {
            return [
                ...previous.slice(0, -1),
                [...previous.slice(-1)[0], item]
            ]
        }
        //
        // Otherwise, start a new group of the different class
        //
        else {
            return [...previous, [item]]
        }
    }, [])

    console.log(`tagPrintGroups: ${JSON.stringify(tagPrintGroups, null, 4)}`)
    return tagPrintGroups.reduce<{ returnValue: PrintMapResult[]; siblings: GenericTree<SchemaTag> }>((previous, tagPrintGroup) => {

        if (tagPrintGroup[0].type === 'single') {
            return tagPrintGroup
                .filter(isSchemaTagPrintItemSingle)
                .reduce<{ returnValue: PrintMapResult[]; siblings: GenericTree<SchemaTag> }>((accumulator, tagPrintItem) => {
                    const newOptions = { ...options, siblings: accumulator.siblings, context: [...options.context, tagPrintItem.tag.data] }
                    const newOutput = schemaToWML({ tag: tagPrintItem.tag, options: newOptions, schemaToWML, optionsFactory })
                    return {
                        returnValue: combineResults({ separateLines: true, multipleInCategory })(accumulator.returnValue, newOutput),
                        siblings: [...accumulator.siblings, tagPrintItem.tag]
                    }
                }, previous)
        }
        else {
            const newOptions = { ...options, siblings: previous.siblings }
            return {
                returnValue: combineResults({ multipleInCategory })(previous.returnValue, schemaDescriptionToWML(schemaToWML)(tagPrintGroup, { ...newOptions, padding: 0 })),
                siblings: tagPrintGroup.reduce<GenericTree<SchemaTag>>((accumulator, tagPrint) => {
                    if (tagPrint.type === 'adjacentGroup') {
                        return [...accumulator, ...tagPrint.tags]
                    }
                    else {
                        return [...accumulator, tagPrint.tag]
                    }
                }, previous.siblings)
            }
        }

    }, { returnValue: [{ printMode: PrintMode.naive, output: '' }, { printMode: PrintMode.nested, output: '' }], siblings: [] }).returnValue
}

//
// tagRender renders a list of each of the ways that a single tag can be portrayed within space limits, in increasing order of granularity.
// The types of render possible are:
//    - Naive: Render everything from the start of the tag to its close on a single line
//    - Nested: Render the opening tag and closing tags on single lines, and nest contents between them (note that there is no need to recurse
//          into nested contents: They will be on separate lines, their spacing limits are known and can be resolved)
//    - Property-Nested: Render the opening tag with each property nested inside it on an individual line, the closing tag on a single line, and
//          nest contents between them.
//
export const tagRender = ({ schemaToWML, options, tag, properties, node }: Omit<PrintMapEntryArguments, 'tag'> & { tag: string, properties: TagRenderProperty[]; node: GenericTreeNode<SchemaTag> }): PrintMapResult[] => {
    const { indent, context } = options
    const descriptionContext = ["Description", "Name", "FirstImpression", "OneCoolThing", "Outfit"].includes(extractConditionContextTag([...context, node.data]) || '')
    //
    // Individual properties can be rendered before knowing how they will be sorted (and kept in a list).
    //
    const propertyRender = properties.map((property) => {
        const propertyKeyLead = property.key ? `${escapeWMLCharacters(property.key)}=` : ''
        switch(property.type) {
            case 'boolean':
                return property.value ? `${escapeWMLCharacters(property.key)}` : ''
            case 'expression':
                return property.value ? `${propertyKeyLead}{${property.value}}` : ''
            case 'key':
                return property.value ? `${propertyKeyLead}(${escapeWMLCharacters(property.value)})` : ''
            case 'literal':
                return property.value ? `${propertyKeyLead}"${escapeWMLCharacters(property.value)}"` : ''
        }
    }).filter((value) => (value))

    //
    // Render cross-product of possible matches (naive with single-line outcomes, nested and propertyNested with everything)
    //

    const contents = tagRenderContents({
        descriptionContext,
        schemaToWML,
        ...options,
        context: [...options.context, node.data],
        indent: options.indent + 1
    })(node.children)
    const mappedContents = options.multipleInCategory ? contents : optimalLineResults({ indent: options.indent + 1 })(contents)

    if (!mappedContents[0]?.output?.length) {
        //
        // Self-closing tag
        //
        return [
            { printMode: PrintMode.naive, output: `<${[tag, ...propertyRender].join(' ')} />` },
            ...(propertyRender.length
                ? [{ printMode: PrintMode.propertyNested, output: `<${[tag, ...propertyRender].join(`\n${indentSpacing(1)}`)}\n/>` }]
                : []
            )
        ]
    }

    //
    // Construct crossProducts by looping through the indices on the various PrintMode levels, using utility functions
    // from baseClasses.ts
    //
    // const minIndices = minIndicesByNestingLevel(mappedContents)
    // const maxIndices = maxIndicesByNestingLevel(mappedContents)
    const tagOpen = `<${[tag, ...propertyRender].join(' ')}>`
    const nestedTagOpen = `<${[tag, ...propertyRender].join(`\n${indentSpacing(1)}`)}\n>`
    const tagClose = `</${tag}>`

    const contentsNaive = mappedContents.find(({ printMode }) => (printMode === PrintMode.naive))
    const contentsNested = mappedContents.find(({ printMode }) => (printMode === PrintMode.nested))

    const naiveOutput = Boolean(contentsNaive && contentsNaive.output.length) ? { printMode: PrintMode.naive, output: `${tagOpen}${contentsNaive?.output ?? ''}${tagClose}` } : undefined
    const nestedOutput = { printMode: PrintMode.nested, output: `${tagOpen}\n${indentSpacing(1)}${(contentsNaive ?? contentsNested ?? { output: '' }).output.split('\n').join(`\n${indentSpacing(1)}`)}\n${tagClose}` }
    const propertyNestedOutput = { printMode: PrintMode.propertyNested, output: `${nestedTagOpen}\n${indentSpacing(1)}${(contentsNaive ?? contentsNested ?? { output: '' }).output.split('\n').join(`\n${indentSpacing(1)}`)}\n${tagClose}` }
    return [naiveOutput, nestedOutput, propertyNestedOutput]
        .filter((value): value is PrintMapResult => (Boolean(value)))
        .filter((value) => ((value.printMode !== PrintMode.naive) || (value.output.length < lineLengthAfterIndent(indent))))
}
