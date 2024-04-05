import { unique } from "../../list"
import { GenericTree } from "../../tree/baseClasses"
import dfsWalk from "../../tree/dfsWalk"
import { SchemaTag, isSchemaBookmark, isSchemaExit, isSchemaLink, isSchemaMap, isSchemaRoom } from "../../schema/baseClasses"

export const selectKeysReferenced = (tree: GenericTree<SchemaTag>, options?: { tag: string }): string[] => {
    const dependencies = dfsWalk({
        callback: (previous: { output: string[], state: { mapNest: boolean } }, tag: SchemaTag) => {
            if (isSchemaExit(tag)) {
                return {
                    output: [...previous.output, tag.to, tag.from],
                    state: previous.state
                }
            }
            if (isSchemaLink(tag)) {
                return {
                    output: [...previous.output, tag.to],
                    state: previous.state
                }
            }
            if (isSchemaBookmark(tag)) {
                return {
                    output: [...previous.output, tag.key],
                    state: previous.state
                }
            }
            if (isSchemaRoom(tag) && previous.state.mapNest) {
                return {
                    output: [...previous.output, tag.key],
                    state: previous.state
                }
            }
            return previous
        },
        nest: ({ state, data }) => {
            if (isSchemaMap(data)) {
                return { mapNest: true }
            }
            return state
        },
        unNest: ({ previous }) => (previous),
        default: { output: [], state: { mapNest: options?.tag === 'Map' } }
    })(tree)
    return unique(dependencies)
}