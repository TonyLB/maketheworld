import { isSchemaTaggedMessageLegalContents, SchemaTag } from "../baseClasses"
import { isLegalParseConditionContextTag } from "../../parser/baseClasses"
import { escapeWMLCharacters } from "../../lib/escapeWMLCharacters"
import { PrintMapEntry, PrintMapEntryArguments, PrintMapOptionsChange, PrintMapResult, PrintMode, SchemaToWMLOptions } from "./baseClasses"
import { indentSpacing, lineLengthAfterIndent } from "./printUtils"
import { schemaDescriptionToWML } from "./prettyPrint/freeText"
import { optionsFactory } from "./utils"
import { maxIndicesByNestingLevel, minIndicesByNestingLevel, provisionalPrintFactory } from "./printUtils"
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
    //
    // combineResults takes lists of results and returns up to two (a nested, and a naive if possible)
    //
    const combineResults = (...args: PrintMapResult[]): PrintMapResult[] => {
        return args.reduce<PrintMapResult[]>((previous, output) => {
            const previousNaive = previous.find(({ printMode }) => (printMode === PrintMode.naive))
            const previousNested = previous.find(({ printMode }) => (printMode === PrintMode.nested))
            return [
                ...(previousNaive && output.printMode === PrintMode.naive ? [{ ...previousNaive, output: [previousNaive.output, output.output].join('') }] : []),
                { printMode: PrintMode.nested, output: [(previousNested ?? previousNaive)?.output, output.output].join('\n') }
            ]
        }, [{ printMode: PrintMode.naive, output: '' }, { printMode: PrintMode.nested, output: '' }])
    }
    const { indent, context } = options
    return contents.reduce<{ returnValue: PrintMapResult[]; siblings: GenericTree<SchemaTag>; taggedMessageStack: GenericTree<SchemaTag> }>((previous, tag, index) => {
        const { data } = tag
        //
        // Branch 1: Free text in a legal context should be parsed using schemaDescriptionToWML (which includes the more-sophisticated
        // word-wrap functionality that can break strings across lines as needed)
        //
        if (descriptionContext && isSchemaTaggedMessageLegalContents(data)) {
            //
            // Branch 1.1: You are at the end of the description, so take all previous tags, as well as this tag, and run the whole list
            // through schemaDescriptionToWML using an added indent.
            //
            if (index === contents.length - 1) {
                const schemaDescription = schemaDescriptionToWML(schemaToWML)([ ...previous.taggedMessageStack, tag ], { indent: indent + 1, context, padding: 0 })
                console.log(`schemaDescription: ${JSON.stringify(schemaDescription, null, 4)} x ${JSON.stringify([...previous.taggedMessageStack, tag], null, 4)}`)
                return {
                    returnValue: combineResults(...previous.returnValue, ...schemaDescription),
                    siblings: [ ...previous.siblings, tag],
                    taggedMessageStack: []
                }
            }
            //
            // Branch 1.2: There are more tags to consider after this one ... throw this free-text onto the taggedMessage stack and proceed.
            //
            else {
                return {
                    returnValue: previous.returnValue,
                    siblings: [ ...previous.siblings, tag],
                    taggedMessageStack: [ ...previous.taggedMessageStack, tag ]
                }
            }
        }
        //
        // Branch 2: Non-free-text tags need to be handled by an algorithm that doesn't worry about word-wrap... but also must be conscious that
        // the tag may be rendered *right after* a long free-text section.  Render free-text if there is any on the taggedMessage stack,
        // then render the tag with a recursive call to the passed schemaToWML callback function.
        //
        else {
            console.log(`breaking freeText on(${isSchemaTaggedMessageLegalContents(data)} x ${descriptionContext}): ${JSON.stringify(data, null, 4)}`)

            const newOptions = optionsFactory(PrintMapOptionsChange.Indent)({ ...options, siblings: previous.siblings, context: [...options.context, data] })
            return {
                returnValue: combineResults(
                    ...previous.returnValue,
                    ...(previous.taggedMessageStack.length ? schemaDescriptionToWML(schemaToWML)(previous.taggedMessageStack, { ...newOptions, padding: 0 }) : []),
                    ...schemaToWML({ tag: { data, children: tag.children as GenericTree<SchemaTag> }, options: newOptions, schemaToWML, optionsFactory })
                ),
                siblings: [ ...previous.siblings, tag],
                taggedMessageStack: []
            }
        }
    }, { returnValue: [], siblings: [], taggedMessageStack: [] }).returnValue
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

    //
    // TODO: Include node in tagRender arguments, and use that to extend context at this point
    //
    const mappedContents = tagRenderContents({ descriptionContext, schemaToWML, ...options, context: [...options.context, node.data], indent: options.indent + 1 })(node.children)

    if (!mappedContents[0].output.length) {
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
    const nestedOutput = { printMode: PrintMode.nested, output: `${tagOpen}\n${(contentsNaive ?? contentsNested ?? { output: '' }).output.split('\n').join(`\n${indentSpacing(1)}`)}\n${tagClose}` }
    const propertyNestedOutput = { printMode: PrintMode.propertyNested, output: `${nestedTagOpen}\n${(contentsNaive ?? contentsNested ?? { output: '' }).output.split('\n').join(`\n${indentSpacing(1)}`)}\n${tagClose}` }
    return [naiveOutput, nestedOutput, propertyNestedOutput]
        .filter((value): value is PrintMapResult => (Boolean(value)))
        .filter((value) => (value.printMode !== PrintMode.naive || value.output.length < lineLengthAfterIndent(indent)))
    // const crossProduct = (outputs: string[][], nestingLevel: PrintMode, transform: (contents: string[]) => string) => (
    //     (Array.apply(null, Array(maxIndices[nestingLevel])))
    //         .map((_, indexInLevel) => (provisionalPrintFactory({ outputs, nestingLevel, indexInLevel })))
    //         .map(transform)
    // )
    // // console.log(`mappedContents: ${JSON.stringify(mappedContents, null, 4)}`)
    // const naiveCrossProduct = minIndices[PrintMode.naive] === 0
    //     ? []
    //     : crossProduct(mappedContents, PrintMode.naive, (contents) => (`${tagOpen}${contents.join('')}${tagClose}`))
    //         // .filter((output) => (output.length < lineLengthAfterIndent(indent)))
    // const nestedTransform = (contents) => (`${[tagOpen, ...contents.map((line) => (line.trimEnd()))].join(`\n${indentSpacing(indent + 1)}`)}\n${indentSpacing(indent)}${tagClose}`)
    // const nestedCrossProduct = [
    //     ...crossProduct(mappedContents, PrintMode.naive, nestedTransform),
    //     ...crossProduct(mappedContents, PrintMode.nested, nestedTransform),
    //     ...crossProduct(mappedContents, PrintMode.propertyNested, nestedTransform)
    // ]
    // const propertyNestedTransform = (contents) => (`${[nestedTagOpen, ...contents.map((line) => (line.trimEnd()))].join(`\n${indentSpacing(indent + 1)}`)}\n${indentSpacing(indent)}${tagClose}`)
    // const propertyNestedCrossProduct = [
    //     ...crossProduct(mappedContents, PrintMode.naive, propertyNestedTransform),
    //     ...crossProduct(mappedContents, PrintMode.nested, propertyNestedTransform),
    //     ...crossProduct(mappedContents, PrintMode.propertyNested, propertyNestedTransform)
    // ]
    
    // const returnValue = [...naiveCrossProduct, ...nestedCrossProduct, ...propertyNestedCrossProduct]
    // return returnValue
}
