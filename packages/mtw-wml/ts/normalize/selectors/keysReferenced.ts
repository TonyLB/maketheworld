import { unique } from "../../list"
import { GenericTree } from "../../sequence/tree/baseClasses"
import dfsWalk from "../../sequence/tree/dfsWalk"
import { SchemaTag, isSchemaBookmark, isSchemaExit, isSchemaLink } from "../../simpleSchema/baseClasses"

export const selectKeysReferenced = (tree: GenericTree<SchemaTag>): string[] => {
    const dependencies = dfsWalk<(previous: { output: string[], state: {} }, tag: SchemaTag ) => { output: string[], state: {} }>({
        callback: (previous, tag) => {
            if (isSchemaExit(tag)) {
                return {
                    output: [...previous.output, tag.to, tag.from],
                    state: {}
                }
            }
            if (isSchemaLink(tag)) {
                return {
                    output: [...previous.output, tag.to],
                    state: {}
                }
            }
            if (isSchemaBookmark(tag)) {
                return {
                    output: [...previous.output, tag.key],
                    state: {}
                }
            }
            return previous
        },
        default: { output: [] as string[], state: {} }
    })(tree)
    return unique(dependencies)
}