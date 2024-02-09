import { unique } from "../../list"
import { GenericTree } from "../../tree/baseClasses"
import dfsWalk from "../../tree/dfsWalk"
import { SchemaTag, isSchemaConditionStatement } from "../../schema/baseClasses"

export const selectDependencies = (tree: GenericTree<SchemaTag>): string[] => {
    const dependencies = dfsWalk({
        callback: (previous: { output: string[], state: {} }, tag: SchemaTag) => {
            if (isSchemaConditionStatement(tag)) {
                return {
                    output: unique(previous.output, tag.dependencies ?? []),
                    state: {}
                }
            }
            return previous
        },
        default: { output: [], state: {} }
    })(tree)
    return dependencies
}