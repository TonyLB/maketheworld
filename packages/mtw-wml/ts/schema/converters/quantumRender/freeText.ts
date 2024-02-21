import { deEscapeWMLCharacters } from "../../../lib/escapeWMLCharacters"
import { GenericTree } from "../../../tree/baseClasses"
import { SchemaTag } from "../../baseClasses"
import { PrintMapEntry, PrintMapResult, SchemaTagPrintItem, SchemaToWMLOptions } from "../baseClasses"
import { optionsFactory } from "../utils"
import collapse from "./collapse"
import { wordWrapCombine } from "./combine"

export const maxLineLength = (padding: number, lines: string) => (lines.split('\n').reduce<number>((previous, line, index) => (Math.max(previous, line.length + ((index === 0) ? padding : 0))), 0))

//
// schemaDescriptionToWML accepts incoming tags and create a list of provisional renderings that judge for each element (or group of
// adjacent elements) whether it can fit into line-wrap limits as a naive render, or must be nested to some level
//
export const schemaDescriptionToWML = (schemaToWML: PrintMapEntry) => (tagGroups: SchemaTagPrintItem[], options: SchemaToWMLOptions & { padding: number }): PrintMapResult[] => {
    //
    // Accumulate a set of single tags (which will have multiple print results, and can appear on a single line or be spread across
    // many) and adjacent groups (which will have a single result that determines what nestingLevel the entire group needs to be
    // rendered at, in order to fit within line limits)
    //
    const queuedTags = tagGroups.reduce<{ returnValue: PrintMapResult[]; siblings: GenericTree<SchemaTag> }>((previous, tagGroup) => {
        if (tagGroup.type === 'singleFreeText') {
            const singleItem: PrintMapResult[] = schemaToWML({ tag: tagGroup.tag, options: { ...options, siblings: previous.siblings }, schemaToWML, optionsFactory })
            return {
                returnValue: [collapse(wordWrapCombine(options.indent)(...(previous.returnValue.length ? [previous.returnValue] : []), singleItem), { indent: options.indent })],
                siblings: [...previous.siblings, tagGroup.tag]
            }
        }
        else if (tagGroup.type === 'adjacentGroup') {
            const { aggregate, siblings } = tagGroup.tags.reduce<{ aggregate: PrintMapResult[][]; siblings: GenericTree<SchemaTag> }>((accumulator, tag) => ({
                aggregate: [...accumulator.aggregate, schemaToWML({ tag, options: { ...options, siblings: previous.siblings }, schemaToWML, optionsFactory })],
                siblings: [...accumulator.siblings, tag]
            }), { aggregate: [] , siblings: previous.siblings })
            const returnWaveform = wordWrapCombine(options.indent)(...(previous.returnValue.length ? [previous.returnValue] : []), ...aggregate)
            return {
                returnValue: [collapse(returnWaveform, { indent: options.indent })],
                siblings
            }            
        }
        else {
            throw new Error('Invalid tagGroup in schemaDescriptionToWML')
        }
    }, { returnValue: [], siblings: options.siblings ?? [] })
    return [collapse(queuedTags.returnValue, { indent: options.indent })]
}
