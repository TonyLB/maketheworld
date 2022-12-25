import { isSchemaLineBreak, isSchemaSpacer, isSchemaString, SchemaTaggedMessageLegalContents } from "../schema/baseClasses"
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

const printQueuedTags = <C extends BaseConverter>(convert: C) => (tags: SchemaTaggedMessageLegalContents[], options: SchemaToWMLOptions): string[] => {
    return [tags.map((tag) => (convert.schemaToWML(tag, options))).join('').trim()]
}

export const schemaDescriptionToWML = <C extends BaseConverter>(convert: C) => (tags: SchemaTaggedMessageLegalContents[], options: SchemaToWMLOptions & { padding: number }): string => {
    const { indent, forceNest, padding } = options
    let outputLines: string[] = []
    let queue: SchemaTaggedMessageLegalContents[] = []
    let multiLine = forceNest ?? false
    let unprintedTags = tags
    while(unprintedTags.length) {
        const tag = unprintedTags[0]
        console.log(`Tag: ${JSON.stringify(tag, null, 4)}`)
        unprintedTags = unprintedTags.slice(1)
        if (queue.length) {
            const lastElement = queue.slice(-1)[0]
            if (areAdjacent(lastElement, tag) || !multiLine) {
                queue.push(tag)
                const provisionalPrint = printQueuedTags(convert)(queue, options)[0]
                if (padding + provisionalPrint.length > Math.max(40, 80 - indent * 4)) {
                    //
                    // If we've been accumulating tags in the hope of printing on a single line,
                    // abandon that effort, push the queue back onto unprintedTags, and start
                    // again breaking up into separate lines
                    //
                    if (!multiLine) {
                        unprintedTags = [...queue, ...unprintedTags]
                        queue = []
                        multiLine = true
                        continue
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
    outputLines = [...outputLines, ...printQueuedTags(convert)(queue, options)]
    return outputLines.join(`\n${indentSpacing(indent)}`)
}
