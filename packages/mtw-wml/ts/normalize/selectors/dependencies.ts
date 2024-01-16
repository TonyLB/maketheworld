import { unique } from "../../list"
import { GenericTree } from "../../sequence/tree/baseClasses"
import dfsWalk from "../../sequence/tree/dfsWalk"
import { SchemaTag, isSchemaCondition } from "../../simpleSchema/baseClasses"

export const selectDependencies = (tree: GenericTree<SchemaTag>): string[] => {
    const dependencies = dfsWalk({
        callback: (previous: { output: string[], state: {} }, tag: SchemaTag) => {
            if (isSchemaCondition(tag)) {
                return {
                    output: unique(previous.output, tag.conditions.map(({ dependencies }) => (dependencies ?? [])).flat(1)),
                    state: {}
                }
            }
            return previous
        },
        default: { output: [], state: {} }
    })(tree)
    return dependencies
}