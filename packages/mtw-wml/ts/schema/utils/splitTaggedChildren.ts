import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaRemove, isSchemaReplace, isSchemaReplaceMatch, isSchemaReplacePayload } from "@tonylb/mtw-base/ts/schema/edit"
import { semanticallyRepresentsTag } from "./findTaggedChildren"

//
// splitTaggedChildren splits direct children into those that semantically represent a given tag (matched)
// and the rest (remainder). Respects Remove and Replace wrappers: when a wrapper contains both
// matching and non-matching content, it is split so matched gets the matching part and remainder
// gets the non-matching part (with the same wrapper structure).
//

export const splitTaggedChildren = (args: {
    children: GenericTree<SchemaTag>
    tag: SchemaTag["tag"]
}): { matched: GenericTree<SchemaTag>; remainder: GenericTree<SchemaTag> } => {
    const { children, tag } = args
    const matched: GenericTree<SchemaTag> = []
    const remainder: GenericTree<SchemaTag> = []

    for (const node of children) {
        // Node does not semantically represent the tag -> entire node goes to remainder
        if (!semanticallyRepresentsTag(node, tag)) {
            remainder.push(node)
            continue
        }

        // Direct match -> entire node goes to matched
        if (node.data.tag === tag) {
            matched.push(node)
            continue
        }

        // Remove wrapper: split children by tag
        if (treeNodeTypeguard(isSchemaRemove)(node)) {
            const matchingChildren = node.children.filter((child) => child.data.tag === tag)
            const nonMatchingChildren = node.children.filter((child) => child.data.tag !== tag)
            if (matchingChildren.length > 0) {
                matched.push({
                    data: node.data,
                    children: matchingChildren,
                })
            }
            if (nonMatchingChildren.length > 0) {
                remainder.push({
                    data: node.data,
                    children: nonMatchingChildren,
                })
            }
            continue
        }

        // Replace wrapper: split ReplaceMatch and ReplacePayload grandchildren by tag
        if (treeNodeTypeguard(isSchemaReplace)(node)) {
            const matchedReplaceChildren = node.children.map((child) => {
                if (treeNodeTypeguard(isSchemaReplaceMatch)(child) || treeNodeTypeguard(isSchemaReplacePayload)(child)) {
                    return {
                        data: child.data,
                        children: child.children.filter((grandchild) => grandchild.data.tag === tag),
                    }
                }
                return child
            })
            const remainderReplaceChildren = node.children.map((child) => {
                if (treeNodeTypeguard(isSchemaReplaceMatch)(child) || treeNodeTypeguard(isSchemaReplacePayload)(child)) {
                    return {
                        data: child.data,
                        children: child.children.filter((grandchild) => grandchild.data.tag !== tag),
                    }
                }
                return child
            })
            matched.push({
                data: node.data,
                children: matchedReplaceChildren,
            })
            const hasRemainderContent = remainderReplaceChildren.some((c) => c.children.length > 0)
            if (hasRemainderContent) {
                remainder.push({
                    data: node.data,
                    children: remainderReplaceChildren,
                })
            }
        }
    }

    return { matched, remainder }
}
