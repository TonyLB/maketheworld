import { unique } from "../../list"
import { GenericTree } from "../../tree/baseClasses"
import dfsWalk from "../../tree/dfsWalk"
import { SchemaTag, isSchemaBookmark, isSchemaExit, isSchemaLink } from "../../simpleSchema/baseClasses"

export const selectKeysReferenced = (tree: GenericTree<SchemaTag>): string[] => {
    const dependencies = dfsWalk({
        callback: (previous: { output: string[], state: {} }, tag: SchemaTag) => {
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
        default: { output: [], state: {} }
    })(tree)
    return unique(dependencies)
}