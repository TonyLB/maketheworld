import { SchemaTag, isSchemaRoom, isSchemaWithContents } from "../baseClasses"
import { mergeTrees } from '@tonylb/mtw-sequence/ts/tree/merge'
import { convertToTree, deconvertFromTree } from "./convert"
import { deepEqual } from "../../lib/objects"

export const mergeSchemaTrees = (...args: SchemaTag[][]): SchemaTag[] => {
    //
    // TODO: Create schemaCompare utility method
    //
    const options = {
        compare: (itemA, itemB) => {
            return deepEqual(
                isSchemaRoom(itemA) ? { ...itemA, render: [], name: [], contents: [] } : itemA,
                isSchemaRoom(itemB) ? { ...itemB, render: [], name: [], contents: [] } : itemB
            )
        },
        extractProperties: (value) => {
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
    const translatedTrees = args.map(convertToTree)
    const mergedTree = mergeTrees(options)(...translatedTrees)
    return deconvertFromTree(mergedTree)
}

export default mergeSchemaTrees
