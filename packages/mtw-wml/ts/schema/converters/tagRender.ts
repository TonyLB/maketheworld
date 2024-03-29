import { isSchemaTaggedMessageLegalContents, SchemaTag } from "../baseClasses"
import { isLegalParseConditionContextTag } from "../../simpleParser/baseClasses"
import { escapeWMLCharacters } from "../../lib/escapeWMLCharacters"
import { isSchemaTagPrintItemSingle, PrintMapEntry, PrintMapEntryArguments, PrintMapResult, PrintMode, SchemaTagPrintItem, SchemaToWMLOptions } from "./baseClasses"
import { areAdjacent, indentSpacing, lineLengthAfterIndent, optimalLineResults } from "./printUtils"
import { schemaDescriptionToWML } from "./quantumRender/freeText"
import { optionsFactory } from "./utils"
import { GenericTree, GenericTreeNode } from "../../tree/baseClasses"
import { separateLinesCombine, wordWrapCombine } from "./quantumRender/combine"
import collapse from "./quantumRender/collapse"

type TagRenderProperty = {
    key?: string;
    type: 'key' | 'expression' | 'literal';
    value: string;
} | {
    key: string;
    type: 'boolean';
    value: boolean;
}

const indentFollowingLines = (value: string): string => {
    const lines = value.split('\n')
    return [
        lines[0],
        ...lines.slice(1).map((line) => (line.trim() ? `${indentSpacing(1)}${line}` : line))
    ].join('\n')
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
                type: (descriptionContext && isSchemaTaggedMessageLegalContents(tag.data)) ? 'singleFreeText' as const : 'single' as const,
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
                    type: (descriptionContext && isSchemaTaggedMessageLegalContents(tag.data)) ? 'singleFreeText' as const : 'single' as const,
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

    return tagPrintGroups.reduce<{ returnValue: PrintMapResult[]; siblings: GenericTree<SchemaTag> }>((previous, tagPrintGroup) => {

        if (tagPrintGroup[0].type === 'single') {
            const { outputs, siblings } = tagPrintGroup
                .filter(isSchemaTagPrintItemSingle)
                .reduce<{ outputs: PrintMapResult[]; siblings: GenericTree<SchemaTag> }>((accumulator, tagPrintItem) => {
                    const newOptions = { ...options, siblings: accumulator.siblings, context: [...options.context, tagPrintItem.tag.data] }
                    const newOutput = collapse(schemaToWML({ tag: tagPrintItem.tag, options: newOptions, schemaToWML, optionsFactory }), { indent: options.indent })
                    return {
                        outputs: [...accumulator.outputs, newOutput],
                        siblings: [...accumulator.siblings, tagPrintItem.tag]
                    }
                }, { outputs: [], siblings: previous.siblings })
            return {
                returnValue: [collapse(separateLinesCombine({ force: true })(...(outputs.map((output) => ([output])))), { indent: options.indent })],
                siblings
            }
        }
        else {
            const newOptions = { ...options, siblings: previous.siblings }
            const schemaDescription = schemaDescriptionToWML(schemaToWML)(tagPrintGroup, { ...newOptions, padding: 0 })
            const previousSiblingNonWrapping = previous.siblings.length && !isSchemaTaggedMessageLegalContents(previous.siblings.slice(-1)[0].data)
            const returnValue = collapse(previousSiblingNonWrapping
                ? separateLinesCombine({ force: false })(previous.returnValue, schemaDescription)
                : wordWrapCombine(options.indent)(previous.returnValue, schemaDescription), { indent: options.indent })
            return {
                returnValue: [returnValue],
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
    const descriptionContext = ["Description", "Summary", "ShortName", "Name", "FirstImpression", "OneCoolThing", "Outfit", "Message", "Moment"].includes(extractConditionContextTag([...context, node.data]) || '')
    //
    // Individual properties can be rendered before knowing how they will be sorted (and kept in a list).
    //
    const propertyRender = properties.map((property) => {
        const propertyKeyLead = property.key ? `${escapeWMLCharacters(property.key)}=` : ''
        switch(property.type) {
            case 'boolean':
                return property.value ? `${escapeWMLCharacters(property.key)}` : ''
            case 'expression':
                return property.value ? `${propertyKeyLead}{${indentFollowingLines(property.value)}}` : ''
            case 'key':
                return property.value ? `${propertyKeyLead}(${escapeWMLCharacters(indentFollowingLines(property.value))})` : ''
            case 'literal':
                return property.value ? `${propertyKeyLead}"${escapeWMLCharacters(indentFollowingLines(property.value))}"` : ''
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

    const naiveOutput: PrintMapResult | undefined = Boolean(contentsNaive && contentsNaive.output.length) ? { printMode: PrintMode.naive, tag, output: `${tagOpen}${contentsNaive?.output ?? ''}${tagClose}` } : undefined
    const nestedOutput = { printMode: PrintMode.nested, tag, output: `${tagOpen}\n${indentSpacing(1)}${(contentsNaive ?? contentsNested ?? { output: '' }).output.split('\n').join(`\n${indentSpacing(1)}`)}\n${tagClose}` }
    const propertyNestedOutput = { printMode: PrintMode.propertyNested, tag, output: `${nestedTagOpen}\n${indentSpacing(1)}${(contentsNaive ?? contentsNested ?? { output: '' }).output.split('\n').join(`\n${indentSpacing(1)}`)}\n${tagClose}` }
    //
    // TODO: Remove the filter below that is (crudely) attempting to collapse the quantumRender records
    //
    return [naiveOutput, nestedOutput, propertyNestedOutput]
        .filter((value): value is PrintMapResult => (Boolean(value)))
        .filter((value) => ((value.printMode !== PrintMode.naive) || (value.output.length < lineLengthAfterIndent(indent))))
}
