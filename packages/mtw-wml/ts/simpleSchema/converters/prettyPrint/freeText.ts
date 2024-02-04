import { GenericTree } from "../../../tree/baseClasses"
import { isSchemaLineBreak, isSchemaSpacer, isSchemaString, SchemaTag } from "../../baseClasses"
import { PrintMapEntry, SchemaToWMLOptions } from "../baseClasses"
import { indentSpacing, lineLengthAfterIndent } from "../printUtils"
import { optionsFactory } from "../utils"

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

const mapTagRender = (schemaToWML: PrintMapEntry) => (tags: GenericTree<SchemaTag>, options: SchemaToWMLOptions): string[] => {
    const { returnValue } = tags.reduce<{ returnValue: string[], siblings: GenericTree<SchemaTag> }>(
        (previous, tag) => {
            const newOptions: SchemaToWMLOptions = { ...options, siblings: previous.siblings, context: [ ...options.context, tag.data ] }
            return {
                returnValue: [
                    ...previous.returnValue,
                    schemaToWML({ tag, options: newOptions, schemaToWML, optionsFactory })
                ],
                siblings: [...previous.siblings, tag ]
            }
        },
        { returnValue: [], siblings: options.siblings ?? [] }
    )
    return returnValue
}

const naivePrint = (schemaToWML: PrintMapEntry) => (tags: GenericTree<SchemaTag>, options: SchemaToWMLOptions): string => (
    mapTagRender(schemaToWML)(tags, { ...options, forceNest: 'closed' }).join('').trim()
)

type BreakTagsReturn = {
    outputLines: string[];
    remainingTags: GenericTree<SchemaTag>;
    extractedTags: GenericTree<SchemaTag>;
}

//
// TODO: Make breakTagsOnFirstStringWhitespace more aggressive about seeing if it can pack multiple tags onto a line (breaking
// on a later string)
//
const breakTagsOnFirstStringWhitespace = (schemaToWML: PrintMapEntry) => (tags: GenericTree<SchemaTag>, options: SchemaToWMLOptions & { padding: number }): BreakTagsReturn => {
    const { indent, padding } = options
    const indexOfFirstBreakableString = tags.findIndex((tag) => (isSchemaString(tag.data) && (tag.data.value.includes(' '))))
    const outputBeforeString = indexOfFirstBreakableString > 0 ? naivePrint(schemaToWML)(tags.slice(0, indexOfFirstBreakableString), { indent: 0, siblings: options.siblings, context: options.context }) : ''
    if (indexOfFirstBreakableString === -1 || (padding + outputBeforeString.length > lineLengthAfterIndent(indent))) {
        return {
            outputLines: [],
            remainingTags: tags,
            extractedTags: []
        }
    }
    const firstBreakableString = tags[indexOfFirstBreakableString]
    if (!isSchemaString(firstBreakableString.data)) {
        return {
            outputLines: [],
            remainingTags: tags,
            extractedTags: []
        }
    }
    const splitIndex = firstBreakableString.data.value.split('').reduce<number>((previous, character, index) => {
        if (character.match(/^\s$/) && index && padding + outputBeforeString.length + index <= lineLengthAfterIndent(indent)) {
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
    const extractedLine = firstBreakableString.data.value.slice(0, splitIndex)
    const outputLine = `${outputBeforeString}${extractedLine}`.trim()
    const remainderLine = firstBreakableString.data.value.slice(splitIndex + 1)
    const remainingTags = [
        ...(remainderLine ? [{ data: { tag: 'String' as 'String', value: remainderLine }, children: [] }] : []),
        ...tags.slice(indexOfFirstBreakableString + 1)
    ]
    return {
        outputLines: [outputLine.trim()],
        remainingTags,
        extractedTags: [
            ...(indexOfFirstBreakableString > 0 ? tags.slice(0, indexOfFirstBreakableString - 1) : []),
            {
                data: { tag: 'String' as 'String', value: extractedLine.trim() },
                children: []
            }
        ]
    }
}

const excludeSpacing = (tag) => (!isSchemaString(tag) || tag.value.trim())

const breakTagsByNesting = (schemaToWML: PrintMapEntry) => (tags: GenericTree<SchemaTag>, options: SchemaToWMLOptions): BreakTagsReturn => {
    const { indent } = options
    const tagsRender = mapTagRender(schemaToWML)(tags, { indent, forceNest: 'contents', siblings: options.siblings, context: options.context }).join('').split('\n')
    return {
        outputLines: tagsRender,
        remainingTags: [],
        extractedTags: tags
    }
}

const printQueuedTags = (schemaToWML: PrintMapEntry) => (tags: GenericTree<SchemaTag>, options: SchemaToWMLOptions): string[] => {
    const { indent, siblings } = options
    let currentSiblings = [...(siblings ?? [])]
    let outputLines: string[] = []
    let tagsBeingConsidered: GenericTree<SchemaTag> = []
    let prefix: string = ''
    tags.forEach((tag) => {
        tagsBeingConsidered.push(tag)
        //
        // Keep pushing tags until you get to the point of needing to break over multiple lines
        //
        while(prefix.length + naivePrint(schemaToWML)(tagsBeingConsidered, { indent: 0, siblings: currentSiblings, context: options.context }).length > lineLengthAfterIndent(indent)) {
            //
            // First, see if you can break strings to extract some lines, while keeping other tags un-nested
            //
            const { outputLines: extractedOutputLines, remainingTags, extractedTags } = breakTagsOnFirstStringWhitespace(schemaToWML)(tagsBeingConsidered, { indent, siblings: currentSiblings, context: options.context, padding: prefix.length })
            if (extractedOutputLines.length) {
                outputLines = [...outputLines, `${prefix}${extractedOutputLines[0]}`, ...(extractedOutputLines.slice(1))]
                currentSiblings = [...currentSiblings, ...extractedTags.filter(excludeSpacing)]
                tagsBeingConsidered = remainingTags
                prefix = ''
            }
            //
            // If that fails, try to force tags to nest
            //
            else {
                const { outputLines: nestedLines } = breakTagsByNesting(schemaToWML)(tagsBeingConsidered, { indent, siblings: currentSiblings, context: options.context })
                if (nestedLines.length > 1) {
                    outputLines = [...outputLines, `${prefix}${nestedLines[0]}`, ...(nestedLines.slice(1, -1))]
                    prefix = nestedLines.slice(-1)[0]
                    currentSiblings = [...currentSiblings, ...tagsBeingConsidered.filter(excludeSpacing)]
                    tagsBeingConsidered = []
                }
                //
                // Otherwise deliver the oversize line
                //
                else {
                    break
                }

            }
        }
    })
    if (tagsBeingConsidered.length) {
        outputLines.push(`${prefix}${naivePrint(schemaToWML)(tagsBeingConsidered, { indent: 0, context: options.context, siblings: currentSiblings })}`.trimEnd())
        prefix = ''
    }
    //
    // Remove indents (which were needed in order to calculate line length) before applying indents in schemaDescriptionToWML,
    // to avoid multiplying the spacing through recursion
    //
    return (prefix ? [...outputLines, prefix] : outputLines).filter((value) => (value.trim())).map((line, index) => ((index > 0 && !line.slice(0, indent * 4).trim()) ? line.slice(indent * 4) : line))
}

export const schemaDescriptionToWML = (schemaToWML: PrintMapEntry) => (tags: GenericTree<SchemaTag>, options: SchemaToWMLOptions & { padding: number }): string => {
    const { indent, forceNest, padding, siblings } = options
    let currentSiblings = [...(siblings ?? []).filter(excludeSpacing)]
    let outputLines: string[] = []
    let queue: GenericTree<SchemaTag> = []
    let multiLine = forceNest && forceNest !== 'closed'
    let forceNestedRerun = false
    tags.forEach((tag) => {
        if (!forceNestedRerun) {
            if (queue.length) {
                //
                // Group tags and blocks of text into adjacency lists that should stay connected
                //
                const lastElement = queue.slice(-1)[0]
                if (areAdjacent(lastElement.data, tag.data) || !multiLine) {
                    queue.push(tag)
                    //
                    // If we've been accumulating tags in the hope of printing the whole list on
                    // a single line, abandon that effort, push the queue back onto unprintedTags,
                    // and start again breaking up into separate lines where possible
                    //
                    if (!multiLine) {
                        const provisionalPrint = naivePrint(schemaToWML)(queue, { indent, siblings: currentSiblings, context: options.context })
                        if (padding + provisionalPrint.length > lineLengthAfterIndent(indent)) {
                            forceNestedRerun = true
                        }
                    }
                }
                else {
                    outputLines = [...outputLines, ...printQueuedTags(schemaToWML)(queue, { ...options, siblings: currentSiblings })]
                    currentSiblings = [...currentSiblings, ...queue.filter(excludeSpacing)]
                    queue = [tag]
                }
            }
            else {
                queue = [tag]
            }
        }
    })
    if (forceNestedRerun) {
        return schemaDescriptionToWML(schemaToWML)(tags, { ...options, forceNest: 'contents' })
    }
    outputLines = [...outputLines, ...printQueuedTags(schemaToWML)(queue, { ...options, siblings: currentSiblings })]
    return outputLines.join(`\n${indentSpacing(indent)}`)
}
