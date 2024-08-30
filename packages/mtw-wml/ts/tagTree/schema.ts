import TagTree from "."
import { deepEqual } from "../lib/objects"
import { GenericTree, TreeId } from "../tree/baseClasses"
import { SchemaTag, isSchemaCondition, isSchemaConditionStatement, isSchemaImport, isSchemaWithKey } from "../schema/baseClasses"

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
                if (isSchemaCondition(A) && isSchemaCondition(B)) {
                    return deepEqual({ data: A, id: idA }, { data: B, id: idB })
                }
                if (isSchemaImport(A) && isSchemaImport(B)) {
                    return A.from === B.from
                }
                return deepEqual(A, B)
            },
            classify: ({ tag }) => (tag),
            merge: ({ data: dataA, id: idA }, { data: dataB, id: idB }) => ({ data: { ...dataA, ...dataB }, id: idA ?? idB }),
            orderIndependence: [['Description', 'Summary', 'Name', 'ShortName', 'Exit'], ['Room', 'Feature', 'Knowledge', 'Message', 'Moment']],
            orderIndependenceIgnore: ['Replace', 'ReplaceMatch', 'ReplacePayload', 'Remove']
        })
    }
}

export default SchemaTagTree
