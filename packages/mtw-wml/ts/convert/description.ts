import { current } from "immer"
import { isSchemaLineBreak, isSchemaSpacer, isSchemaString, SchemaTag, SchemaTaggedMessageLegalContents } from "../schema/baseClasses"
import { BaseConverter, SchemaToWMLOptions } from "./functionMixins"
import { indentSpacing, lineLengthAfterIndent } from "./utils"

const areAdjacent = (a: SchemaTaggedMessageLegalContents, b: SchemaTaggedMessageLegalContents) => {
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

const mapTagRender = (schemaToWML: (value: SchemaTag, options: SchemaToWMLOptions) => string) => (tags: SchemaTaggedMessageLegalContents[], options: SchemaToWMLOptions): string[] => {
    const { returnValue } = tags.reduce<{ returnValue: string[], siblings: SchemaTag[] }>(
        (previous, tag) => {
            console.log(`mapTagRender-Tag: ${JSON.stringify(tag, null, 4)}`)
            console.log(`mapTagRender-Siblings: ${JSON.stringify(previous.siblings, null, 4)}`)
            return {
                returnValue: [
                    ...previous.returnValue,
                    schemaToWML(tag, { ...options, siblings: previous.siblings, context: [ ...options.context, tag ] })
                ],
                siblings: [...previous.siblings, tag ]
            }
        },
        { returnValue: [], siblings: options.siblings ?? [] }
    )
    return returnValue
}

const naivePrint = (schemaToWML: (value: SchemaTag, options: SchemaToWMLOptions) => string) => (tags: SchemaTaggedMessageLegalContents[], options: SchemaToWMLOptions): string => (
    mapTagRender(schemaToWML)(tags, { ...options, forceNest: false }).join('').trim()
)

type BreakTagsReturn = {
    outputLines: string[];
    remainingTags: SchemaTaggedMessageLegalContents[];
}

//
// TODO: Make breakTagsOnFirstStringWhitespace more aggressive about seeing if it can pack multiple tags onto a line (breaking
// on a later string)
//
const breakTagsOnFirstStringWhitespace = (schemaToWML: (value: SchemaTag, options: SchemaToWMLOptions) => string) => (tags: SchemaTaggedMessageLegalContents[], options: SchemaToWMLOptions & { padding: number }): BreakTagsReturn => {
    const { indent, padding } = options
    const indexOfFirstBreakableString = tags.findIndex((tag) => (isSchemaString(tag) && (tag.value.includes(' '))))
    const outputBeforeString = indexOfFirstBreakableString > 0 ? naivePrint(schemaToWML)(tags.slice(0, indexOfFirstBreakableString), { indent: 0, siblings: options.siblings, context: options.context }) : ''
    if (indexOfFirstBreakableString === -1 || (padding + outputBeforeString.length > lineLengthAfterIndent(indent))) {
        return {
            outputLines: [],
            remainingTags: tags
        }
    }
    const firstBreakableString = tags[indexOfFirstBreakableString]
    if (!isSchemaString(firstBreakableString)) {
        return {
            outputLines: [],
            remainingTags: tags
        }
    }
    const splitIndex = firstBreakableString.value.split('').reduce<number>((previous, character, index) => {
        if (character.match(/^\s$/) && index && padding + outputBeforeString.length + index <= lineLengthAfterIndent(indent)) {
            return index
        }
        return previous
    }, -1)
    if (splitIndex === -1) {
        return {
            outputLines: [],
            remainingTags: tags
        }
    }
    const outputLine = `${outputBeforeString}${firstBreakableString.value.slice(0, splitIndex)}`.trim()
    const remainderLine = firstBreakableString.value.slice(splitIndex + 1)
    const remainingTags = [
        ...(remainderLine ? [{ tag: 'String' as 'String', value: remainderLine, parse: { tag: 'Space' as 'Space', startTagToken: 0, endTagToken: 0 }}] : []),
        ...tags.slice(indexOfFirstBreakableString + 1)
    ]
    return {
        outputLines: [outputLine.trim()],
        remainingTags
    }
}

const breakTagsByNesting = (schemaToWML: (value: SchemaTag, options: SchemaToWMLOptions) => string) => (tags: SchemaTaggedMessageLegalContents[], options: SchemaToWMLOptions): BreakTagsReturn => {
    const { indent } = options
    const tagsRender = mapTagRender(schemaToWML)(tags, { indent, forceNest: true, siblings: options.siblings, context: options.context }).join('').split('\n')
    return {
        outputLines: tagsRender,
        remainingTags: []
    }
}

const printQueuedTags = (schemaToWML: (value: SchemaTag, options: SchemaToWMLOptions) => string) => (tags: SchemaTaggedMessageLegalContents[], options: SchemaToWMLOptions): string[] => {
    console.log(`PrintQueuedTags: ${JSON.stringify(tags, null, 4)}`)
    const { indent, siblings } = options
    let currentSiblings = [...(siblings ?? [])]
    let outputLines: string[] = []
    let tagsBeingConsidered: SchemaTaggedMessageLegalContents[] = []
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
            const { outputLines: extractedOutputLines, remainingTags } = breakTagsOnFirstStringWhitespace(schemaToWML)(tagsBeingConsidered, { indent, siblings: currentSiblings, context: options.context, padding: prefix.length })
            if (extractedOutputLines.length) {
                outputLines = [...outputLines, `${prefix}${extractedOutputLines[0]}`, ...(extractedOutputLines.slice(1))]
                currentSiblings = [...currentSiblings, ...tagsBeingConsidered.slice(0, -remainingTags.length)]
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
                    currentSiblings = [...currentSiblings, ...tagsBeingConsidered]
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
        outputLines.push(`${prefix}${naivePrint(schemaToWML)(tagsBeingConsidered, { indent: 0, context: options.context })}`.trim())
    }
    return outputLines
}

export const schemaDescriptionToWML = (schemaToWML: (value: SchemaTag, options: SchemaToWMLOptions) => string) => (tags: SchemaTaggedMessageLegalContents[], options: SchemaToWMLOptions & { padding: number }): string => {
    const { indent, forceNest, padding, siblings } = options
    let currentSiblings = [...siblings ?? []]
    let outputLines: string[] = []
    let queue: SchemaTaggedMessageLegalContents[] = []
    let multiLine = forceNest ?? false
    let forceNestedRerun = false
    tags.forEach((tag) => {
        console.log(`Tag: ${JSON.stringify(tag, null, 4)}`)
        console.log(`Siblings: ${JSON.stringify(currentSiblings, null, 4)}`)
        if (!forceNestedRerun) {
            if (queue.length) {
                //
                // Group tags and blocks of text into adjacency lists that should stay connected
                //
                const lastElement = queue.slice(-1)[0]
                if (areAdjacent(lastElement, tag) || !multiLine) {
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
                    currentSiblings = [...currentSiblings, ...queue]
                    queue = [tag]
                }
            }
            else {
                queue = [tag]
            }
        }
    })
    if (forceNestedRerun) {
        return schemaDescriptionToWML(schemaToWML)(tags, { ...options, forceNest: true })
    }
    outputLines = [...outputLines, ...printQueuedTags(schemaToWML)(queue, { ...options, siblings: currentSiblings })]
    return outputLines.join(`\n${indentSpacing(indent)}`)
}
