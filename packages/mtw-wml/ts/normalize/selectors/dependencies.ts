import { unique } from "../../list"
import { GenericTree } from "../../sequence/tree/baseClasses"
import dfsWalk from "../../sequence/tree/dfsWalk"
import { SchemaTag, isSchemaCondition, isSchemaTag } from "../../simpleSchema/baseClasses"

export const selectDependencies = (tree: GenericTree<SchemaTag>): string[] => {
    const dependencies = dfsWalk({
        callback: (previous, tag: SchemaTag) => {
            if (isSchemaCondition(tag)) {
                return {
                    output: unique(previous.output, tag.conditions.map(({ dependencies }) => (dependencies)).flat(1)),
                    state: {}
                }
            }
            return previous
        },
        default: { output: [] as string[], state: {} }
    })(tree)
    return dependencies
}