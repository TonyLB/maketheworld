import { SchemaTag, isSchemaRoom, isSchemaWithContents } from "../baseClasses"
import { mergeTrees } from '../../tree/merge'
import { deepEqual } from "../../lib/objects"
import { GenericTree } from "../../tree/baseClasses"

export const mergeSchemaTrees = (...args: GenericTree<SchemaTag>[]): GenericTree<SchemaTag> => {
    //
    // TODO: Create schemaCompare utility method
    //
    const options = {
        compare: deepEqual,
        extractProperties: (value: SchemaTag) => {
            return value
        },
        rehydrateProperties: (base, properties) => (Object.assign(base, ...properties) as SchemaTag)
    }
    const mergedTree = mergeTrees(options)(...args)
    return mergedTree
}

export default mergeSchemaTrees
