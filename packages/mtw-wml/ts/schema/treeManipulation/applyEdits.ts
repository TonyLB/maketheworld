import { deepEqual } from "../../lib/objects"
import SchemaTagTree from "../../tagTree/schema"
import { GenericTree, TreeId, treeNodeTypeguard } from "../../tree/baseClasses"
import { maybeGenericIDFromTree, stripIDFromTree } from "../../tree/genericIDTree";
import { isSchemaRemove, isSchemaReplace, isSchemaReplaceMatch, isSchemaReplacePayload, SchemaTag } from "../baseClasses"

type SchemaTree = GenericTree<SchemaTag, TreeId>

type CompareEditTreesResult = {
    type: 'Equal';
} | {
    type: 'A Longer';
    remainder: SchemaTree;
} | {
    type: 'B Longer';
    remainder: SchemaTree;
} | {
    type: 'Merge Conflict';
}

//
// compareEditTrees looks at two trees, "a" which exists as incoming content, and "b" which is trying
// to remove or replace that expected content. There can be four possible outcomes:
//    - a = 'DEF', b = 'DEF': Equal, all content will be removed/replaced
//    - a = 'DEF', b = 'EF': A Longer ... content will be reduced to 'D'
//    - a = 'EF', b = 'DEF': B Longer ... the result will be a remove/replace that expects to find 'D'
//    - a = 'CEF', b = 'DEF': Merge Conflict. The edit tag did not find the content it expected.
//
const compareEditTrees = (a: SchemaTree, b: SchemaTree): CompareEditTreesResult => {
    const strippedA = stripIDFromTree(a)
    const strippedB = stripIDFromTree(b)
    const tagA = new SchemaTagTree(strippedA)
    const tagB = new SchemaTagTree(strippedB)
    if (tagA._tagList.length > tagB._tagList.length) {
        if (deepEqual(tagA._tagList.slice(-tagB._tagList.length), tagB._tagList)) {
            const resultTag = new SchemaTagTree(a)
            resultTag._tagList = resultTag._tagList.slice(0, -tagB._tagList.length)
            return {
                type: 'A Longer',
                remainder: maybeGenericIDFromTree(resultTag.tree)
            }
        }
        else {
            return { type: 'Merge Conflict' }
        }
    }
    else if (tagB._tagList.length > tagA._tagList.length) {
        if (deepEqual(tagB._tagList.slice(-tagA._tagList.length), tagA._tagList)) {
            const resultTag = new SchemaTagTree(b)
            resultTag._tagList = resultTag._tagList.slice(0, -tagA._tagList.length)
            return {
                type: 'B Longer',
                remainder: maybeGenericIDFromTree(resultTag.tree)
            }
        }
        else {
            return { type: 'Merge Conflict' }
        }
    }
    else {
        if (deepEqual(tagA._tagList, tagB._tagList)) {
            return { type: 'Equal' }
        }
        else {
            return { type: 'Merge Conflict' }
        }
    }
}

//
// applyExits takes a standard schema that includes (possibly) multiple edit entries, and aggregates down the edits
// at each sibling-level to a single edit or entry.
//
export const applyEdits = (tree: GenericTree<SchemaTag, TreeId>): GenericTree<SchemaTag, TreeId> => {
    return tree.reduce<GenericTree<SchemaTag, TreeId>>((previous, node) => {
        const recursedNode = {
            ...node,
            children: applyEdits(node.children)
        }
        console.log(`recursedNode: ${JSON.stringify(recursedNode, null, 4)}`)
        if (previous.length) {
            const siblingNode = previous.slice(-1)[0]
            //
            // Three possibilities for siblingNode: add, replace, or remove
            //
            let removeTags: GenericTree<SchemaTag, TreeId> = []
            let addTags: GenericTree<SchemaTag, TreeId> = []
            if (treeNodeTypeguard(isSchemaRemove)(siblingNode)) {
                removeTags = siblingNode.children
            }
            else if (treeNodeTypeguard(isSchemaReplace)(siblingNode)) {
                removeTags = siblingNode.children.find(treeNodeTypeguard(isSchemaReplaceMatch))?.children ?? []
                addTags = siblingNode.children.find(treeNodeTypeguard(isSchemaReplacePayload))?.children ?? []
            }
            else {
                addTags = [siblingNode]
            }
            //
            // Three possibilities for incoming node: add, replace, or remove
            //
            if (treeNodeTypeguard(isSchemaRemove)(recursedNode)) {
                const compareResult = compareEditTrees(addTags, recursedNode.children)
                switch(compareResult.type) {
                    case 'Merge Conflict': throw new Error('Apply Edits merge conflict')
                    case 'Equal':
                        addTags = []
                        break
                    case 'A Longer':
                        addTags = compareResult.remainder
                        break
                    case 'B Longer':
                        addTags = []
                        removeTags = [...compareResult.remainder, ...removeTags]
                }
            }
            else if (treeNodeTypeguard(isSchemaReplace)(recursedNode)) {
                const replaceMatch = recursedNode.children.find(treeNodeTypeguard(isSchemaReplaceMatch))?.children ?? []
                const replacePayload = recursedNode.children.find(treeNodeTypeguard(isSchemaReplacePayload))?.children ?? []
                const compareResult = compareEditTrees(addTags, replaceMatch)
                switch(compareResult.type) {
                    case 'Merge Conflict': throw new Error('Apply Edits merge conflict')
                    case 'Equal':
                        addTags = replacePayload
                        break
                    case 'A Longer':
                        addTags = [...compareResult.remainder, ...replacePayload]
                        break
                    case 'B Longer':
                        addTags = replacePayload
                        removeTags = [...compareResult.remainder, ...removeTags]
                }
            }
            else {
                addTags = [...addTags, recursedNode]
            }
            //
            // Now that the incoming change has been aggregated with the pre-existing sibling, the results will
            // generate either:
            //    - An add of nodes
            //    - A removal of nodes
            //    - A replacement of nodes
            //    - Or a no-op
            //
            if (addTags.length) {
                if (removeTags.length) {
                    return maybeGenericIDFromTree([
                        ...previous.slice(0, -1),
                        {
                            data: { tag: 'Replace' },
                            children: [
                                { data: { tag: 'ReplaceMatch' }, children: removeTags },
                                { data: { tag: 'ReplacePayload' }, children: addTags }
                            ]
                        }
                    ])
                }
                else {
                    return maybeGenericIDFromTree([
                        ...previous.slice(0, -1),
                        ...addTags
                    ])
                }
            }
            else {
                if (removeTags.length) {
                    return maybeGenericIDFromTree([
                        ...previous.slice(0, -1),
                        {
                            data: { tag: 'Remove' },
                            children: removeTags
                        }
                    ])
                }
                else {
                    return previous.slice(0, -1)
                }
            }
        }
        return [...previous, recursedNode]
    }, [])
}

export default applyEdits
