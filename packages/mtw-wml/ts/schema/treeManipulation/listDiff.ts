import { diffTrees } from '../../tree/diff'
import { GenericTree, GenericTreeDiffAction } from "../../tree/baseClasses"
import { isSchemaCondition, isSchemaConditionStatement, isSchemaImport, isSchemaWithKey, SchemaTag } from "../baseClasses"
import { deepEqual } from '../../lib/objects'

export const listDiff = (a: GenericTree<SchemaTag>, b: GenericTree<SchemaTag>): GenericTree<SchemaTag> => {
    const diff = diffTrees<SchemaTag, SchemaTag>({
        compare: (a, b) => {
            if (isSchemaWithKey(a)) {
                return (isSchemaWithKey(b) && a.key === b.key)
            }
            if (isSchemaConditionStatement(a) && isSchemaConditionStatement(b)) {
                return a.if === b.if
            }
            if (isSchemaCondition(a) && isSchemaCondition(b)) {
                return a.wrapperKey === b.wrapperKey
            }
            if (isSchemaImport(a) && isSchemaImport(b)) {
                return a.from === b.from
            }
            return deepEqual(a, b)
        },
        extractProperties: (value) => (value),
        rehydrateProperties: (base, properties) => ({ ...base, ...properties })
    })(a, b)
    let aIndex = 0
    let bIndex = 0
    let returnValue: GenericTree<SchemaTag> = []
    diff.forEach((diffNode) => {
        switch(diffNode.action) {
            case GenericTreeDiffAction.Add:
                returnValue = [...returnValue, b[bIndex]]
                bIndex++
                break
            // case GenericTreeDiffAction.Exclude:
            default:
                aIndex++
                bIndex++
        }
    })
    return returnValue
}