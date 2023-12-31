import { SchemaTag, isSchemaRoom, isSchemaWithContents } from "../baseClasses"
import { mergeTrees } from '../../sequence/tree/merge'
import { deepEqual } from "../../lib/objects"
import { GenericTree } from "../../sequence/tree/baseClasses"

export const mergeSchemaTrees = (...args: GenericTree<SchemaTag>[]): GenericTree<SchemaTag> => {
    //
    // TODO: Create schemaCompare utility method
    //
    const options = {
        compare: (itemA, itemB) => {
            return deepEqual(
                isSchemaRoom(itemA) ? { ...itemA, contents: [] } : itemA,
                isSchemaRoom(itemB) ? { ...itemB, contents: [] } : itemB
            )
        },
        extractProperties: (value: SchemaTag) => {
            if (isSchemaWithContents(value)) {
                return {
                    ...value,
                    contents: []
                }
            }
            return value
        },
        rehydrateProperties: (base, properties) => (Object.assign(base, ...properties) as SchemaTag)
    }
    const mergedTree = mergeTrees(options)(...args)
    return mergedTree
}

export default mergeSchemaTrees
