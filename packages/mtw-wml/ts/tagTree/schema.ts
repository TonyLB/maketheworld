import TagTree from "."
import { deepEqual } from "../lib/objects"
import { GenericTree } from "../tree/baseClasses"
import { SchemaTag, isSchemaWithKey } from "../schema/baseClasses"

export class SchemaTagTree extends TagTree<SchemaTag, { id?: string }> {
    constructor(tree: GenericTree<SchemaTag, { id?: string }>) {
        super({
            tree,
            compare: ({ data: A, id: idA }, { data: B, id: idB }) => {
                if ((idA || idB) && (idA !== idB)) {
                    console.log(`idA: ${JSON.stringify(idA)}, idB: ${JSON.stringify(idB)}`)
                    return false
                }
                if (isSchemaWithKey(A)) {
                    return (isSchemaWithKey(B) && A.key === B.key)
                }
                return deepEqual(A, B)
            },
            classify: ({ tag }) => (tag),
            orderIndependence: [['Description', 'Name', 'Exit'], ['Room', 'Feature', 'Knowledge', 'Message', 'Moment']]
        })
    }
}

export default SchemaTagTree
