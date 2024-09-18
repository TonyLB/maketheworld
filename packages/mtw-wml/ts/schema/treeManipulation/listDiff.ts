import { diffTrees } from '../../tree/diff'
import { GenericTree, GenericTreeDiffAction, GenericTreeDiffNode } from "../../tree/baseClasses"
import { isSchemaCondition, isSchemaConditionStatement, isSchemaImport, isSchemaWithKey, SchemaTag } from "../baseClasses"
import { deepEqual } from '../../lib/objects'

const diffTreeIncludesChange = (node: GenericTreeDiffNode<SchemaTag>): boolean => {
    return [GenericTreeDiffAction.Add, GenericTreeDiffAction.Delete, GenericTreeDiffAction.Set].includes(node.action) || Boolean(node.children.find((child) => (diffTreeIncludesChange(child))))
}

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
        rehydrateProperties: (base, properties) => ({ ...base, ...properties[0] }),
        verbose: true
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
            case GenericTreeDiffAction.Delete:
                returnValue = [
                    ...returnValue,
                    {
                        data: { tag: 'Remove' },
                        children: [a[aIndex]]
                    }
                ]
                aIndex++
                break
            case GenericTreeDiffAction.Context:
            case GenericTreeDiffAction.Set:
                if (diffNode.action === GenericTreeDiffAction.Set || diffTreeIncludesChange(diffNode)) {
                    returnValue = [
                        ...returnValue,
                        {
                            data: { tag: 'Replace' },
                            children: [
                                { data: { tag: 'ReplaceMatch' }, children: [a[aIndex]] },
                                { data: { tag: 'ReplacePayload' }, children: [b[bIndex]] }
                            ]
                        }
                    ]
                }
                aIndex++
                bIndex++
                break
            default:
                aIndex++
                bIndex++
        }
    })
    return returnValue
}