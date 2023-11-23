import { SchemaTag } from "../baseClasses"
import { mergeTrees } from '@tonylb/mtw-sequence/ts/tree/merge'

//
// TODO: Create helper functions wrapping generic convertToTree and deconvertTree
// with options that enable conversion of SchemaTags into and out of GenericTree format
//
export const mergeSchemaTrees = (...args: SchemaTag[][]): SchemaTag[] => {
    const options = {
        compare: ({ key: keyA }, { key: keyB }) => (keyA === keyB),
        extractProperties: (value) => (value),
        rehydrateProperties: (base, properties) => (Object.assign(base, ...properties) as SchemaTag)
    }
    return mergeTrees(options)(...args)
}

export default mergeSchemaTrees
