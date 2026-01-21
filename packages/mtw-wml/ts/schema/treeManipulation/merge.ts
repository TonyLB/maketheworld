import { mergeTrees } from '../../tree/merge'
import { deepEqual } from "../../lib/objects"
import { GenericTree } from "@tonylb/mtw-base/ts/genericTree"
import { SchemaTag } from '@tonylb/mtw-base/ts/schema'

export const mergeSchemaTrees = (...args: GenericTree<SchemaTag>[]): GenericTree<SchemaTag> => {
    //
    // TODO: Create schemaCompare utility method
    //
    const options = {
        compare: deepEqual,
        extractProperties: (value: SchemaTag) => {
            return value
        },
        rehydrateProperties: (base: SchemaTag, properties: SchemaTag[]) =>
            (Object.assign(base, ...properties) as SchemaTag)
    }
    const mergedTree = mergeTrees(options)(...args)
    return mergedTree
}

export default mergeSchemaTrees
