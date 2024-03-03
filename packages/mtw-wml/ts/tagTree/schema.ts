import TagTree from "."
import { deepEqual } from "../lib/objects"
import { GenericTree, TreeId } from "../tree/baseClasses"
import { SchemaTag, isSchemaWithKey } from "../schema/baseClasses"

export class SchemaTagTree extends TagTree<SchemaTag, Partial<TreeId & { inherited: boolean }>> {
    constructor(tree: GenericTree<SchemaTag, Partial<TreeId & { inherited: boolean }>>) {
        super({
            tree,
            compare: ({ data: A }, { data: B }) => {
                if (isSchemaWithKey(A)) {
                    return (isSchemaWithKey(B) && A.key === B.key)
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
