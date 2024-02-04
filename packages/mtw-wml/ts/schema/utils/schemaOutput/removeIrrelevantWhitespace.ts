//
// Remove all pure whitespace that is between connected Conditions (i.e., an If and its ElseIf and Else)

import { deepEqual } from "../../../lib/objects"
import { GenericTree } from "../../../tree/baseClasses"
import { SchemaTag, isSchemaLineBreak, isSchemaSpacer, isSchemaString } from "../../baseClasses"

//
export const removeIrrelevantWhitespace = (tree: GenericTree<SchemaTag>): GenericTree<SchemaTag> => (
    tree.filter((item, index, all) => {
        const { data } = item
        if (
            (isSchemaLineBreak(data) || isSchemaSpacer(data) || (isSchemaString(data) && !data.value.trim())) &&
            (index > 0 && index < all.length - 1)
        ) {
            const previous = all[index - 1]
            const next = all[index + 1]
            if (
                previous.data.tag === 'If' &&
                next.data.tag === 'If' &&
                deepEqual(
                    previous.data.conditions.map((condition) => ({ ...condition, not: true })),
                    next.data.conditions.slice(0, previous.data.conditions.length)
                )
            ) {
                return false
            }
        }
        return true
    })
)
