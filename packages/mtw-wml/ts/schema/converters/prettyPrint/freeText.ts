import { deEscapeWMLCharacters } from "../../../lib/escapeWMLCharacters"
import { GenericTree, GenericTreeNode } from "../../../tree/baseClasses"
import { isSchemaConditionFallthrough, isSchemaConditionStatement, isSchemaLineBreak, isSchemaSpacer, isSchemaString, SchemaTag } from "../../baseClasses"
import { PrintMapEntry, PrintMapResult, PrintMode, SchemaToWMLOptions } from "../baseClasses"
import { combineResults, lineLengthAfterIndent, maxIndicesByNestingLevel, provisionalPrintFactory } from "../printUtils"
import { optionsFactory } from "../utils"

const areAdjacent = (a: SchemaTag, b: SchemaTag) => {
    const spaces = Boolean(
        (isSchemaString(a) && a.value.match(/\s$/)) ||
        (isSchemaString(b) && b.value.match(/^\s/)) ||
        isSchemaLineBreak(a) ||
        isSchemaSpacer(a) ||
        isSchemaLineBreak(b) ||
        isSchemaSpacer(b) ||
        (isSchemaConditionStatement(a) && (isSchemaConditionStatement(b) || isSchemaConditionFallthrough(b)))
    )
    return !spaces
}

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
        const returnValue = printQueuedTags(
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
// schemaDescriptionToWML accepts incoming tags and create a list of provisional renderings (one for each of the levels of granularity
// provided by the underlying individual tag-print commands), then chooses the least granular level that complies with line-size limits.
//
export const schemaDescriptionToWML = (schemaToWML: PrintMapEntry) => (tags: GenericTree<SchemaTag>, options: SchemaToWMLOptions & { padding: number }): PrintMapResult[] => {
    const { siblings } = options
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
            // TODO: Refactor so that the schemaToWML pipeline passes down multipleInCategory argument, so that a whole group
            // of adjacent tagged items will either be all naive together, or all nested together.
            //
            if (areAdjacent(lastElement.node.data, tag.data)) {
                const newOutputs = schemaToWML({ tag, options: { ...options, multipleInCategory: true }, schemaToWML, optionsFactory })
                queue.push({ node: tag, outputs: newOutputs })
            }
            else {
                //
                // Increase granularity as much as needed in order to fit within line length limits
                //
                const { nestingLevel, indexInLevel } = printQueueIdealSettings(queue, { ...options, multipleInCategory: true, siblings: currentSiblings })
                const provisionalPrint = () => {
                    const returnValue = printQueuedTags(
                        queue,
                        { ...options, siblings: currentSiblings, nestingLevel, indexInLevel }
                    )
                    return returnValue
                }
                outputLines = [...outputLines, ...provisionalPrint()]
                currentSiblings = [...currentSiblings, ...queue.map(({ node }) => (node)).filter(excludeSpacing)]
                queue = [{ node: tag, outputs: schemaToWML({ tag, options: { ...options, multipleInCategory: true }, schemaToWML, optionsFactory }) }]
            }
        }
        else {
            queue = [{ node: tag, outputs: schemaToWML({ tag, options: { ...options, multipleInCategory: true }, schemaToWML, optionsFactory }) }]
        }
    })
    if (options.multipleInCategory) {
        return combineResults()(
            [{ printMode: PrintMode.naive, output: outputLines.join('') }, { printMode: PrintMode.nested, output: outputLines.join('\n') }],
            ...queue.map(({ outputs }) => (outputs))
        )
    }
    const { nestingLevel, indexInLevel } = printQueueIdealSettings(queue, { ...options, siblings: currentSiblings })
    console.log(`queue: ${JSON.stringify(queue, null, 4)}`)
    console.log(`NestingLevel: ${nestingLevel}`)
    outputLines = [...outputLines, ...printQueuedTags(queue, { ...options, siblings: currentSiblings, nestingLevel, indexInLevel })]
    console.log(`outputLines: ${JSON.stringify(outputLines, null, 4)}`)
    if (nestingLevel === PrintMode.naive) {
        return [
            { printMode: PrintMode.naive, output: outputLines.join('') },
            { printMode: PrintMode.nested, output: outputLines.map((value) => (value.trim())).filter((value) => (value)).join('\n') }
        ]
    }
    else {
        return [{ printMode: PrintMode.nested, output: outputLines.map((value) => (value.trim())).join('\n') }]
    }
}
