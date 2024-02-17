import { deEscapeWMLCharacters } from "../../../lib/escapeWMLCharacters"
import { GenericTree, GenericTreeNode } from "../../../tree/baseClasses"
import { isSchemaString, SchemaTag } from "../../baseClasses"
import { PrintMapEntry, PrintMapResult, PrintMode, SchemaTagPrintItem, SchemaToWMLOptions, isSchemaTagPrintItemSingle } from "../baseClasses"
import { combineResults, lineLengthAfterIndent, maxIndicesByNestingLevel, provisionalPrintFactory } from "../printUtils"
import { optionsFactory } from "../utils"

type PrintQueue = {
    node: GenericTreeNode<SchemaTag>;
    outputs: PrintMapResult[]
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
    const outputBeforeString = indexOfFirstBreakableString > 0 ? provisionalPrintFactory({ outputs: tags.map(({ outputs }) => (outputs)).slice(0, indexOfFirstBreakableString), nestingLevel, indexInLevel }).map(({ output }) => (output)).join('') : ''
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
    const splitIndex = stringRendered.output.split('').reduce<number>((previous, character, index) => {
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
    const extractedLine = stringRendered.output.slice(0, splitIndex + 1)
    const outputLine = `${outputBeforeString}${extractedLine}`
    const remainderLine = stringRendered.output.slice(splitIndex + 1)
    const remainingTags = [
        ...(remainderLine ? [{ node: { data: { tag: 'String' as 'String', value: deEscapeWMLCharacters(remainderLine) }, children: [] }, outputs: [{ printMode: stringRendered.printMode, output: remainderLine }] }] : []),
        ...tags.slice(indexOfFirstBreakableString + 1)
    ]
    return {
        outputLines: [outputLine],
        remainingTags,
        extractedTags: [
            ...(indexOfFirstBreakableString > 0 ? tags.slice(0, indexOfFirstBreakableString - 1) : []),
            {
                node: {
                    data: { tag: 'String' as 'String', value: deEscapeWMLCharacters(extractedLine) },
                    children: []
                },
                outputs: [{ printMode: stringRendered.printMode, output: extractedLine }]
            }
        ]
    }
}

const excludeSpacing = (tag) => (Boolean(!isSchemaString(tag) || tag.value.trim()))

const printAdjacentTags = (queue: PrintQueue[], options: SchemaToWMLOptions & { nestingLevel: PrintMode; indexInLevel: number }): string[] => {
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
        while((prefix.length + provisionalPrintFactory({ outputs: tagsBeingConsidered.map(({ outputs }) => (outputs)), nestingLevel, indexInLevel }).map(({ output }) => (output)).join('').length) > lineLengthAfterIndent(indent)) {
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
            else {
                break
            }
        }
    })
    if (tagsBeingConsidered.length) {
        outputLines.push(`${prefix}${provisionalPrintFactory({ outputs: tagsBeingConsidered.map(({ outputs }) => (outputs)), nestingLevel, indexInLevel }).map(({ output }) => (output)).join('')}`)
        prefix = ''
    }

    //
    // TODO: Refactor how results are combined to accomodate both (a) the PrintMapResult format, and (b) the fact that
    // outputs are no longer pre-indented.
    //

    //
    // Remove indents (which were needed in order to calculate line length) before applying indents in schemaDescriptionToWML,
    // to avoid multiplying the spacing through recursion
    //
    const returnValue = (prefix ? [...outputLines, prefix] : outputLines)
    return returnValue
}

const printQueueIdealSettings = (queue: PrintQueue[], options: SchemaToWMLOptions & { padding: number }) => {
    const { indent, padding } = options
    //
    // Increase granularity as much as needed in order to fit within line length limits
    //
    let nestingLevel = PrintMode.naive
    let indexInLevel = 0            
    const maxIndices = maxIndicesByNestingLevel(queue.map(({ outputs }) => (outputs)))
    const provisionalPrint = () => {
        const returnValue = printAdjacentTags(
            queue,
            { ...options, nestingLevel, indexInLevel }
        )
        return returnValue
    }
    while(
        !(nestingLevel === PrintMode.propertyNested && indexInLevel >= maxIndices[nestingLevel] - 1) &&
        ((nestingLevel === PrintMode.naive ? provisionalPrint().join('').length : maxLineLength(padding, provisionalPrint().join('\n'))) > lineLengthAfterIndent(indent))
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
// schemaDescriptionToWML accepts incoming tags and create a list of provisional renderings that judge for each element (or group of
// adjacent elements) whether it can fit into line-wrap limits as a naive render, or must be nested to some level
//
export const schemaDescriptionToWML = (schemaToWML: PrintMapEntry) => (tagGroups: SchemaTagPrintItem[], options: SchemaToWMLOptions & { padding: number }): PrintMapResult[] => {
    const { siblings } = options
    let currentSiblings = [...(siblings ?? []).filter(excludeSpacing)]
    //
    // Accumulate a set of single tags (which will have multiple print results, and can appear on a single line or be spread across
    // many) and adjacent groups (which will have a single result that determines what nestingLevel the entire group needs to be
    // rendered at, in order to fit within line limits)
    //
    const queuedTags = tagGroups.reduce<{ returnValue: PrintMapResult[]; siblings: GenericTree<SchemaTag> }>((previous, tagGroup) => {
        if (tagGroup.type === 'singleFreeText') {
            //
            // Increase granularity as much as needed in order to fit within line length limits
            //
            const singleItem: PrintQueue = { node: tagGroup.tag, outputs: schemaToWML({ tag: tagGroup.tag, options, schemaToWML, optionsFactory }) }
            const { nestingLevel, indexInLevel } = printQueueIdealSettings([singleItem], { ...options, multipleInCategory: true, siblings: currentSiblings })
            const outputLines = printAdjacentTags(
                [singleItem],
                { ...options, siblings: currentSiblings, nestingLevel, indexInLevel }
            )
            const newReturnValue: PrintMapResult = (nestingLevel === PrintMode.naive)
                ? { printMode: PrintMode.naive, output: outputLines.join('') }
                : { printMode: PrintMode.nested, output: outputLines.map((value) => (value.trim())).join('\n') }
            return {
                returnValue: [...previous.returnValue, newReturnValue],
                siblings: [...previous.siblings, tagGroup.tag]
            }
        }
        else {
            //
            // Increase granularity as much as needed in order to fit within line length limits
            //
            if (isSchemaTagPrintItemSingle(tagGroup)) {
                throw new Error('Non-free-text tagGroup in schemaDescriptionToWML')
            }
            const { returnValue: adjacentItems, siblings: finalSiblings } = tagGroup.tags.reduce<{ returnValue: PrintQueue[]; siblings: GenericTree<SchemaTag> }>((accumulator, tag) => ({
                returnValue: [...accumulator.returnValue, { node: tag, outputs: schemaToWML({ tag: tag, options: { ...options, multipleInCategory: true, siblings: accumulator.siblings }, schemaToWML, optionsFactory }) }],
                siblings: [...accumulator.siblings, tag]
            }), { returnValue: [], siblings: previous.siblings })
            console.log(`adjacent Print: ${JSON.stringify(adjacentItems, null, 4)}`)
            const { nestingLevel, indexInLevel } = printQueueIdealSettings(adjacentItems, { ...options, multipleInCategory: true, siblings: previous.siblings })
            const outputLines = printAdjacentTags(
                adjacentItems,
                { ...options, siblings: previous.siblings, nestingLevel, indexInLevel }
            )
            const newReturnValue: PrintMapResult = (nestingLevel === PrintMode.naive)
                ? { printMode: PrintMode.naive, output: outputLines.join('') }
                : { printMode: PrintMode.nested, output: outputLines.map((value) => (value.trim())).join('\n') }
            return {
                returnValue: [...previous.returnValue, newReturnValue],
                siblings: finalSiblings
            }

        }
    }, { returnValue: [], siblings: options.siblings ?? [] })
    return combineResults({ separateLines: Boolean(queuedTags.returnValue.find(({ printMode }) => (printMode !== PrintMode.naive))) })(...queuedTags.returnValue.map((item) => ([item])))
}
