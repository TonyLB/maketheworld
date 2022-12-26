import { isSchemaLineBreak, isSchemaSpacer, isSchemaString, isSchemaTaggedMessageLegalContents, SchemaTaggedMessageLegalContents } from "../schema/baseClasses"
import { BaseConverter, SchemaToWMLOptions } from "./functionMixins"
import { indentSpacing } from "./utils"

const areAdjacent = (a: SchemaTaggedMessageLegalContents, b: SchemaTaggedMessageLegalContents) => {
    return !(
        (isSchemaString(a) && a.value.match(/\s$/)) ||
        (isSchemaString(b) && b.value.match(/^\s/)) ||
        isSchemaLineBreak(a) ||
        isSchemaSpacer(a) ||
        isSchemaLineBreak(b) ||
        isSchemaSpacer(b)
    )
}

export const wordWrapString = (value: string, options: SchemaToWMLOptions & { padding: number }): string[] => {
    return [value]
}

const lineLengthAfterIndent = (indent: number): number => (Math.max(40, 80 - indent * 4))

const naivePrint = <C extends BaseConverter>(convert: C) => (tags: SchemaTaggedMessageLegalContents[], options: SchemaToWMLOptions): string => (tags.map((tag) => (convert.schemaToWML(tag, options))).join('').trim())

type BreakTagsReturn = {
    outputLines: string[];
    remainingTags: SchemaTaggedMessageLegalContents[];
}

//
// TODO: Make breakTagsOnFirstStringWhitespace more aggressive about seeing if it can pack multiple tags onto a line (breaking
// on a later string)
//
const breakTagsOnFirstStringWhitespace = <C extends BaseConverter>(convert: C) => (tags: SchemaTaggedMessageLegalContents[], options: SchemaToWMLOptions & { padding: number }): BreakTagsReturn => {
    const { indent, padding } = options
    const indexOfFirstBreakableString = tags.findIndex((tag) => (isSchemaString(tag) && (tag.value.includes(' '))))
    const outputBeforeString = indexOfFirstBreakableString > 0 ? naivePrint(convert)(tags.slice(0, indexOfFirstBreakableString), { indent: 0 }) : ''
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
    const outputLine = `${outputBeforeString}${firstBreakableString.value.slice(0, splitIndex)}`
    const remainderLine = firstBreakableString.value.slice(splitIndex + 1)
    const remainingTags = [
        ...(remainderLine ? [{ tag: 'String' as 'String', value: remainderLine, parse: { tag: 'Space' as 'Space', startTagToken: 0, endTagToken: 0 }}] : []),
        ...tags.slice(indexOfFirstBreakableString + 1)
    ]
    return {
        outputLines: [outputLine],
        remainingTags
    }
}

const printQueuedTags = <C extends BaseConverter>(convert: C) => (tags: SchemaTaggedMessageLegalContents[], options: SchemaToWMLOptions): string[] => {
    const { indent } = options
    let outputLines: string[] = []
    let tagsBeingConsidered: SchemaTaggedMessageLegalContents[] = []
    let prefix: string = ''
    tags.forEach((tag) => {
        tagsBeingConsidered.push(tag)
        //
        // Keep pushing tags until you get to the point of needing to break over multiple lines
        //
        while(prefix.length + naivePrint(convert)(tagsBeingConsidered, { indent: 0 }).length > lineLengthAfterIndent(indent)) {
            //
            // First, see if you can break strings to extract some lines, while keeping other tags un-nested
            //
            const { outputLines: extractedOutputLines, remainingTags } = breakTagsOnFirstStringWhitespace(convert)(tagsBeingConsidered, { indent, padding: prefix.length })
            if (extractedOutputLines.length) {
                outputLines = [...outputLines, `${prefix}${extractedOutputLines[0]}`, ...(extractedOutputLines.slice(1))]
                tagsBeingConsidered = remainingTags
                prefix = ''
            }
            //
            // TODO: See if you can force tags to nest, to break across multiple lines
            //
            else {
                break
            }
        }
    })
    if (tagsBeingConsidered.length) {
        outputLines.push(`${prefix}${naivePrint(convert)(tagsBeingConsidered, { indent: 0 })}`)
    }
    return outputLines
}

export const schemaDescriptionToWML = <C extends BaseConverter>(convert: C) => (tags: SchemaTaggedMessageLegalContents[], options: SchemaToWMLOptions & { padding: number }): string => {
    const { indent, forceNest, padding } = options
    let outputLines: string[] = []
    let queue: SchemaTaggedMessageLegalContents[] = []
    let multiLine = forceNest ?? false
    let forceNestedRerun = false
    tags.forEach((tag) => {
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
                        const provisionalPrint = printQueuedTags(convert)(queue, { indent })[0]
                        if (padding + provisionalPrint.length > Math.max(40, 80 - indent * 4)) {
                            forceNestedRerun = true
                        }
                    }
                }
                else {
                    outputLines = [...outputLines, ...printQueuedTags(convert)(queue, options)]
                    queue = [tag]
                }
            }
            else {
                queue = [tag]
            }
        }
    })
    if (forceNestedRerun) {
        return schemaDescriptionToWML(convert)(tags, { ...options, forceNest: true })
    }
    outputLines = [...outputLines, ...printQueuedTags(convert)(queue, options)]
    return outputLines.join(`\n${indentSpacing(indent)}`)
}
