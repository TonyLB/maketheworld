import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaRemove, isSchemaReplace, isSchemaReplaceMatch, isSchemaReplacePayload } from "@tonylb/mtw-base/ts/schema/edit"

//
// splitChildrenByPredicate splits direct children into those that match the predicate (matched)
// and the rest (remainder). Respects Remove and Replace wrappers: when a wrapper contains both
// matching and non-matching content, it is split so matched gets the matching part and remainder
// gets the non-matching part (with the same wrapper structure). Mirrors splitTaggedChildren.
//

function semanticallyContainsMatch(
    node: GenericTreeNode<SchemaTag>,
    predicate: (node: GenericTreeNode<SchemaTag>) => boolean
): boolean {
    if (predicate(node)) {
        return true
    }
    if (treeNodeTypeguard(isSchemaRemove)(node)) {
        return node.children.some((child) => predicate(child))
    }
    if (treeNodeTypeguard(isSchemaReplace)(node)) {
        return node.children.some((child) => {
            if (treeNodeTypeguard(isSchemaReplaceMatch)(child) || treeNodeTypeguard(isSchemaReplacePayload)(child)) {
                return child.children.some((grandchild) => predicate(grandchild))
            }
            return false
        })
    }
    return false
}

function processNode(
    node: GenericTreeNode<SchemaTag>,
    predicate: (node: GenericTreeNode<SchemaTag>) => boolean
): { matched: GenericTree<SchemaTag>; remainder: GenericTree<SchemaTag> } {
    if (!semanticallyContainsMatch(node, predicate)) {
        return { matched: [], remainder: [node] }
    }
    if (predicate(node)) {
        return { matched: [node], remainder: [] }
    }
    if (treeNodeTypeguard(isSchemaRemove)(node)) {
        const matchingChildren = node.children.filter((child) => predicate(child))
        const nonMatchingChildren = node.children.filter((child) => !predicate(child))
        return {
            matched: matchingChildren.length > 0 ? [{ data: node.data, children: matchingChildren }] : [],
            remainder: nonMatchingChildren.length > 0 ? [{ data: node.data, children: nonMatchingChildren }] : [],
        }
    }
    if (treeNodeTypeguard(isSchemaReplace)(node)) {
        const matchedReplaceChildren = node.children.map((child) => {
            if (treeNodeTypeguard(isSchemaReplaceMatch)(child) || treeNodeTypeguard(isSchemaReplacePayload)(child)) {
                return {
                    data: child.data,
                    children: child.children.filter((grandchild) => predicate(grandchild)),
                }
            }
            return child
        })
        const remainderReplaceChildren = node.children.map((child) => {
            if (treeNodeTypeguard(isSchemaReplaceMatch)(child) || treeNodeTypeguard(isSchemaReplacePayload)(child)) {
                return {
                    data: child.data,
                    children: child.children.filter((grandchild) => !predicate(grandchild)),
                }
            }
            return child
        })
        const hasRemainderContent = remainderReplaceChildren.some((c) => c.children.length > 0)
        return {
            matched: [{ data: node.data, children: matchedReplaceChildren }],
            remainder: hasRemainderContent ? [{ data: node.data, children: remainderReplaceChildren }] : [],
        }
    }
    return { matched: [], remainder: [] }
}

export const splitChildrenByPredicate = (
    children: GenericTree<SchemaTag>,
    predicate: (node: GenericTreeNode<SchemaTag>) => boolean
): { matched: GenericTree<SchemaTag>; remainder: GenericTree<SchemaTag> } =>
    children.reduce<{ matched: GenericTree<SchemaTag>; remainder: GenericTree<SchemaTag> }>(
        (acc, node) => {
            const result = processNode(node, predicate)
            return {
                matched: [...acc.matched, ...result.matched],
                remainder: [...acc.remainder, ...result.remainder],
            }
        },
        { matched: [], remainder: [] }
    )
