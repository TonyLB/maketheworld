import { deEscapeWMLCharacters } from "../../../lib/escapeWMLCharacters"
import { GenericTree, GenericTreeNode } from "../../../tree/baseClasses"
import { isSchemaLineBreak, isSchemaSpacer, isSchemaString, SchemaTag } from "../../baseClasses"
import { PrintMapEntry, PrintMode, SchemaToWMLOptions } from "../baseClasses"
import { lineLengthAfterIndent } from "../printUtils"
import { maxIndicesByNestingLevel, optionsFactory, provisionalPrintFactory } from "../utils"

const areAdjacent = (a: SchemaTag, b: SchemaTag) => {
    const spaces = Boolean(
        (isSchemaString(a) && a.value.match(/\s$/)) ||
        (isSchemaString(b) && b.value.match(/^\s/)) ||
        isSchemaLineBreak(a) ||
        isSchemaSpacer(a) ||
        isSchemaLineBreak(b) ||
        isSchemaSpacer(b)
    )
    return !spaces
}

export const wordWrapString = (value: string, options: SchemaToWMLOptions & { padding: number }): string[] => {
    return [value]
}

// const mapTagRender = (schemaToWML: PrintMapEntry) => (tags: GenericTree<SchemaTag>, options: SchemaToWMLOptions): string[] => {
//     const { returnValue } = tags.reduce<{ returnValue: string[], siblings: GenericTree<SchemaTag> }>(
//         (previous, tag) => {
//             const newOptions: SchemaToWMLOptions = { ...options, siblings: previous.siblings, context: [ ...options.context, tag.data ] }
//             return {
//                 returnValue: [
//                     ...previous.returnValue,
//                     schemaToWML({ tag, options: newOptions, schemaToWML, optionsFactory })
//                 ],
//                 siblings: [...previous.siblings, tag ]
//             }
//         },
//         { returnValue: [], siblings: options.siblings ?? [] }
//     )
//     return returnValue
// }

// const naivePrint = (schemaToWML: PrintMapEntry) => (tags: GenericTree<SchemaTag>, options: SchemaToWMLOptions): string => (
//     mapTagRender(schemaToWML)(tags, options).join('').trim()
// )

type PrintQueue = {
    node: GenericTreeNode<SchemaTag>;
    outputs: string[]
}

type BreakTagsReturn = {
    outputLines: string[];
    remainingTags: PrintQueue[];
    extractedTags: PrintQueue[];
}

export const maxLineLength = (padding: number, lines: string) => (lines.split('\n').reduce<number>((previous, line, index) => (Math.max(previous, line.length + ((index === 0) ? padding : 0))), 0))

//
// TODO: Make breakTagsOnFirstStringWhitespace more aggressive about seeing if it can pack multiple tags onto a line (breaking
// on a later string)
//
const breakTagsOnFirstStringWhitespace = (tags: PrintQueue[], options: SchemaToWMLOptions & { padding: number; nestingLevel: PrintMode; indexInLevel: number }): BreakTagsReturn => {
    const { indent, padding, nestingLevel, indexInLevel } = options
    const indexOfFirstBreakableString = tags.map(({ node }) => (node)).findIndex((tag) => (isSchemaString(tag.data) && (tag.data.value.includes(' '))))
    const outputBeforeString = indexOfFirstBreakableString > 0 ? provisionalPrintFactory({ outputs: tags.map(({ outputs }) => (outputs)).slice(0, indexOfFirstBreakableString), nestingLevel, indexInLevel }).join('') : ''
    if (indexOfFirstBreakableString === -1 || (maxLineLength(padding, outputBeforeString) > lineLengthAfterIndent(indent))) {
        return {
            outputLines: [],
            remainingTags: tags,
            extractedTags: []
        }
    }
    const firstBreakableString = tags[indexOfFirstBreakableString]
    if (!isSchemaString(firstBreakableString.node.data)) {
        return {
            outputLines: [],
            remainingTags: tags,
            extractedTags: []
        }
    }
    const stringRendered = provisionalPrintFactory({ outputs: [firstBreakableString.outputs], nestingLevel, indexInLevel })[0]
    const splitIndex = stringRendered.split('').reduce<number>((previous, character, index) => {
        const outputBeforeStringLastLength = outputBeforeString.split('\n').length > 1 ? outputBeforeString.split('\n').slice(-1)[0].length : padding + outputBeforeString.length
        if (character.match(/^\s$/) && index && outputBeforeStringLastLength + index <= lineLengthAfterIndent(indent)) {
            return index
        }
        return previous
    }, -1)
    if (splitIndex === -1) {
        return {
            outputLines: [],
            remainingTags: tags,
            extractedTags: []
        }
    }
    const extractedLine = stringRendered.slice(0, splitIndex)
    const outputLine = `${outputBeforeString}${extractedLine}`.trim()
    const remainderLine = stringRendered.slice(splitIndex + 1)
    const remainingTags = [
        ...(remainderLine ? [{ node: { data: { tag: 'String' as 'String', value: deEscapeWMLCharacters(remainderLine) }, children: [] }, outputs: [remainderLine] }] : []),
        ...tags.slice(indexOfFirstBreakableString + 1)
    ]
    return {
        outputLines: [outputLine.trim()],
        remainingTags,
        extractedTags: [
            ...(indexOfFirstBreakableString > 0 ? tags.slice(0, indexOfFirstBreakableString - 1) : []),
            {
                node: {
                    data: { tag: 'String' as 'String', value: deEscapeWMLCharacters(extractedLine.trim()) },
                    children: []
                },
                outputs: [extractedLine]
            }
        ]
    }
}

const excludeSpacing = (tag) => (!isSchemaString(tag) || tag.value.trim())

// const breakTagsByNesting = (schemaToWML: PrintMapEntry) => (tags: GenericTree<SchemaTag>, options: SchemaToWMLOptions): BreakTagsReturn => {
//     const { indent } = options
//     const tagsRender = mapTagRender(schemaToWML)(tags, { indent, forceNest: nextNestingLevel(options.forceNest), siblings: options.siblings, context: options.context }).join('').split('\n')
//     return {
//         outputLines: tagsRender,
//         remainingTags: [],
//         extractedTags: tags
//     }
// }

const printQueuedTags = (queue: PrintQueue[], options: SchemaToWMLOptions & { nestingLevel: PrintMode; indexInLevel: number }): string[] => {
    const { indent, siblings, nestingLevel, indexInLevel } = options
    let currentSiblings = [...(siblings ?? [])]
    let outputLines: string[] = []
    let tagsBeingConsidered: PrintQueue[] = []
    let prefix: string = ''
    queue.forEach((tag) => {
        tagsBeingConsidered.push(tag)
        //
        // Keep pushing tags until you get to the point of needing to break over multiple lines
        //
        while((prefix.length + provisionalPrintFactory({ outputs: tagsBeingConsidered.map(({ outputs }) => (outputs)), nestingLevel, indexInLevel }).join('').length) > lineLengthAfterIndent(indent)) {
            //
            // First, see if you can break strings to extract some lines, while keeping other tags un-nested
            //
            const { outputLines: extractedOutputLines, remainingTags, extractedTags } = breakTagsOnFirstStringWhitespace(tagsBeingConsidered, { indent, siblings: currentSiblings, context: options.context, padding: prefix.length, nestingLevel, indexInLevel })
            if (extractedOutputLines.length) {
                outputLines = [...outputLines, `${prefix}${extractedOutputLines[0]}`, ...(extractedOutputLines.slice(1))]
                currentSiblings = [...currentSiblings, ...extractedTags.map(({ node }) => (node)).filter(excludeSpacing)]
                tagsBeingConsidered = remainingTags
                prefix = ''
            }
            // //
            // // If that fails, try to force tags to nest
            // //
            // else {
            //     const { outputLines: nestedLines } = breakTagsByNesting(schemaToWML)(tagsBeingConsidered, { indent, siblings: currentSiblings, context: options.context })
            //     if (nestedLines.length > 1) {
            //         outputLines = [...outputLines, `${prefix}${nestedLines[0]}`, ...(nestedLines.slice(1, -1))]
            //         prefix = nestedLines.slice(-1)[0]
            //         currentSiblings = [...currentSiblings, ...tagsBeingConsidered.filter(excludeSpacing)]
            //         tagsBeingConsidered = []
            //     }
            //     //
            //     // Otherwise deliver the oversize line
            //     //
            //     else {
            //         break
            //     }
            else {
                break
            }
        }
    })
    if (tagsBeingConsidered.length) {
        outputLines.push(`${prefix}${provisionalPrintFactory({ outputs: tagsBeingConsidered.map(({ outputs }) => (outputs)), nestingLevel, indexInLevel }).join('')}`.trimEnd())
        prefix = ''
    }
    //
    // Remove indents (which were needed in order to calculate line length) before applying indents in schemaDescriptionToWML,
    // to avoid multiplying the spacing through recursion
    //
    const returnValue = (prefix ? [...outputLines, prefix] : outputLines).filter((value) => (value.trim())).map((line, index) => ((index > 0 && !line.slice(0, indent * 4).trim()) ? line.slice(indent * 4) : line))
    return returnValue
}

const printQueueIdealSettings = (queue: PrintQueue[], options: SchemaToWMLOptions & { padding: number }) => {
    const { indent, padding, siblings } = options
    //
    // Increase granularity as much as needed in order to fit within line length limits
    //
    let nestingLevel = PrintMode.naive
    let indexInLevel = 0            
    const maxIndices = maxIndicesByNestingLevel(queue.map(({ outputs }) => (outputs)))
    const provisionalPrint = () => {
        const returnValue = printQueuedTags(
            queue,
            { ...options, nestingLevel, indexInLevel }
        )
        return returnValue
    }
    while(
        !(nestingLevel === PrintMode.propertyNested && indexInLevel >= maxIndices[nestingLevel] - 1) &&
        (maxLineLength(padding, provisionalPrint().join('\n')) > lineLengthAfterIndent(indent))
    ) {
        indexInLevel++
        if (indexInLevel >= maxIndices[nestingLevel]) {
            nestingLevel = nestingLevel === PrintMode.naive ? PrintMode.nested : PrintMode.propertyNested
            indexInLevel = 0
        }
    }
    return { nestingLevel, indexInLevel }
}

//
// schemaDescriptionToWML accepts incoming tags and create a list of provisional renderings (one for each of the levels of granularity
// provided by the underlying individual tag-print commands), then choose the least granular level that complies with line-size limits.
//
export const schemaDescriptionToWML = (schemaToWML: PrintMapEntry) => (tags: GenericTree<SchemaTag>, options: SchemaToWMLOptions & { padding: number }): string[] => {
    const { indent, padding, siblings } = options
    let currentSiblings = [...(siblings ?? []).filter(excludeSpacing)]
    let outputLines: string[] = []
    let queue: PrintQueue[] = []
    tags.forEach((tag) => {
        if (queue.length) {
            //
            // Group tags and blocks of text into adjacency lists that should stay connected
            //
            const lastElement = queue.slice(-1)[0]
            //
            // TODO: Refactor so that nesting level and index are calculated *ONLY* when a complete list
            // of adjacent entries has been finished and is ready for render (not at every step along
            // the way)
            //
            if (areAdjacent(lastElement.node.data, tag.data)) {
                const newOutputs = schemaToWML({ tag, options, schemaToWML, optionsFactory })
                queue.push({ node: tag, outputs: newOutputs })
            }
            else {
                //
                // Increase granularity as much as needed in order to fit within line length limits
                //
                const { nestingLevel, indexInLevel } = printQueueIdealSettings(queue, { ...options, siblings: currentSiblings })
                const provisionalPrint = () => {
                    const returnValue = printQueuedTags(
                        queue,
                        { ...options, siblings: currentSiblings, nestingLevel, indexInLevel }
                    )
                    return returnValue
                }
                outputLines = [...outputLines, ...provisionalPrint()]
                currentSiblings = [...currentSiblings, ...queue.map(({ node }) => (node)).filter(excludeSpacing)]
                queue = [{ node: tag, outputs: schemaToWML({ tag, options, schemaToWML, optionsFactory }) }]
            }
        }
        else {
            queue = [{ node: tag, outputs: schemaToWML({ tag, options, schemaToWML, optionsFactory }) }]
        }
    })
    const { nestingLevel, indexInLevel } = printQueueIdealSettings(queue, { ...options, siblings: currentSiblings })
    outputLines = [...outputLines, ...printQueuedTags(queue, { ...options, siblings: currentSiblings, nestingLevel, indexInLevel })]
    return outputLines
}
