import TagTree from "."
import { deepEqual } from "../lib/objects"
import { GenericTree } from "../sequence/tree/baseClasses"
import { SchemaTag, isSchemaWithKey } from "../simpleSchema/baseClasses"

export class SchemaTagTree extends TagTree<SchemaTag> {
    constructor(tree: GenericTree<SchemaTag>) {
        super({
            tree,
            compare: (A: SchemaTag, B: SchemaTag) => {
                if (isSchemaWithKey(A)) {
                    return (isSchemaWithKey(B) && A.key === B.key)
                }
                return deepEqual(A, B)
            },
            classify: ({ tag }: SchemaTag) => (tag),
            orderIndependence: [['Description', 'Name', 'Exit'], ['Room', 'Feature', 'Knowledge', 'Message', 'Moment']]
        })
    }
}

export default SchemaTagTree
