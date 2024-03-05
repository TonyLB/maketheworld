import TagTree from "."
import { deepEqual } from "../lib/objects"
import { GenericTree, TreeId } from "../tree/baseClasses"
import { SchemaTag, isSchemaConditionStatement, isSchemaWithKey } from "../schema/baseClasses"

export class SchemaTagTree extends TagTree<SchemaTag, Partial<TreeId & { inherited: boolean }>> {
    constructor(tree: GenericTree<SchemaTag, Partial<TreeId & { inherited: boolean }>>) {
        super({
            tree,
            compare: ({ data: A, id: idA }, { data: B, id: idB }) => {
                if (isSchemaWithKey(A)) {
                    return (isSchemaWithKey(B) && A.key === B.key)
                }
                if (isSchemaConditionStatement(A) && isSchemaConditionStatement(B)) {
                    return A.if === B.if && idA === idB
                }
                return deepEqual(A, B)
            },
            classify: ({ tag }) => (tag),
            merge: ({ data: dataA, id: idA }, { data: dataB, id: idB }) => ({ data: { ...dataA, ...dataB }, id: idA ?? idB }),
            orderIndependence: [['Description', 'Name', 'Exit'], ['Room', 'Feature', 'Knowledge', 'Message', 'Moment']]
        })
    }
}

export default SchemaTagTree
