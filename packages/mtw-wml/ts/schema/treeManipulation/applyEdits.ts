import { deepEqual } from "../../lib/objects"
import SchemaTagTree from "../../tagTree/schema"
import { GenericTree, TreeId, treeNodeTypeguard } from "../../tree/baseClasses"
import { maybeGenericIDFromTree, stripIDFromTree } from "../../tree/genericIDTree";
import { isSchemaRemove, isSchemaReplace, isSchemaReplaceMatch, isSchemaReplacePayload, isSchemaString, SchemaSpacerTag, SchemaStringTag, SchemaTag } from "../baseClasses"

type SchemaTree = GenericTree<SchemaTag, TreeId>

type CompareEditOutputTreesResult = {
    type: 'Equal';
} | {
    type: 'A Longer';
    remainder: (SchemaStringTag | SchemaSpacerTag)[];
} | {
    type: 'B Longer';
    remainder: (SchemaStringTag | SchemaSpacerTag)[];
} | {
    type: 'Merge Conflict';
}

//
// compareEditStringTags looks at two string tags, "a" which exists as incoming content, and "b" which is trying
// to remove or replace that expected content. There can be four possible outcomes:
//    - a = 'DEF', b = 'DEF': Equal
//    - a = 'DEF', b = 'EF': A Longer ... remainder will be 'D'
//    - a = 'EF', b = 'DEF': B Longer ... remainder will be 'D'
//    - a = 'CEF', b = 'DEF': Merge Conflict. The edit tag did not find the content it expected.
//
const compareEditOutput = (a: SchemaStringTag, b: SchemaStringTag): CompareEditOutputTreesResult => {
    const { value: valueA } = a
    const { value: valueB } = b
    if (valueA.length > valueB.length) {
        if (valueA.slice(-valueB.length) === valueB) {
            const remainderString = valueA.slice(0, -valueB.length)
            return {
                type: 'A Longer',
                remainder: remainderString.startsWith(' ')
                    ? [
                        { tag: 'Space' },
                        { tag: 'String', value: remainderString.trimStart() }
                    ]
                    : [{ tag: 'String', value: remainderString }]
            }
        }
        else {
            return { type: 'Merge Conflict' }
        }
    }
    if (valueB.length > valueA.length) {
        if (valueB.slice(-valueA.length) === valueA) {
            const remainderString = valueB.slice(0, -valueA.length)
            return {
                type: 'B Longer',
                remainder: remainderString.endsWith(' ')
                    ? [
                        { tag: 'String', value: remainderString.trimEnd() },
                        { tag: 'Space' },
                    ]
                    : [{ tag: 'String', value: remainderString }]
            }
        }
        else {
            return { type: 'Merge Conflict' }
        }
    }
    else {
        if (valueA === valueB) {
            return { type: 'Equal' }
        }
        else {
            return { type: 'Merge Conflict' }
        }
    }
}

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
    const remainderA = new SchemaTagTree(a)
    const remainderB = new SchemaTagTree(b)
    const minimumLength = Math.min(tagA._tagList.length, tagB._tagList.length)
    const greaterTree = tagA._tagList.length > minimumLength ? 'A' : tagB._tagList.length > minimumLength ? 'B' : ''

    //
    // Use deepEqual to compare all but the boundary element between the two sets
    //
    if (minimumLength > 1 && !deepEqual(tagA._tagList.slice(-(minimumLength - 1)), tagB._tagList.slice(-(minimumLength - 1)))) {
        return { type: 'Merge Conflict' }
    }
    const boundaryElementA = tagA._tagList.slice(-minimumLength)[0].slice(-1)[0]
    const boundaryElementB = tagB._tagList.slice(-minimumLength)[0].slice(-1)[0]

    //
    // If boundary elements are both String tags, use compareEditOutput to generate
    // the boundary change
    //
    if (isSchemaString(boundaryElementA.data) && isSchemaString(boundaryElementB.data)) {
        const compareResult = compareEditOutput(boundaryElementA.data, boundaryElementB.data)
        switch(compareResult.type) {
            case 'Merge Conflict': return { type: 'Merge Conflict' }
            case 'Equal':
                switch(greaterTree) {
                    case 'A':
                        remainderA._tagList = remainderA._tagList.slice(0, -minimumLength)
                        return {
                            type: 'A Longer',
                            remainder: maybeGenericIDFromTree(remainderA.tree)
                        }
                    case 'B':
                        remainderB._tagList = remainderB._tagList.slice(0, -minimumLength)
                        return {
                            type: 'B Longer',
                            remainder: maybeGenericIDFromTree(remainderB.tree)
                        }
                    default:
                        return { type: 'Equal' }
                }
            case 'A Longer':
                switch(greaterTree) {
                    case 'B':
                        return { type: 'Merge Conflict' }
                    default:
                        remainderA._tagList = [
                            ...remainderA._tagList.slice(0, -(minimumLength - 1)),
                            ...compareResult.remainder.map((tag) => ([...tagA._tagList.slice(-minimumLength)[0].slice(0, -1), { ...boundaryElementA, data: tag }]))
                        ]
                        return {
                            type: 'A Longer',
                            remainder: maybeGenericIDFromTree(remainderA.tree)
                        }
                }
            case 'B Longer':
                switch(greaterTree) {
                    case 'A':
                        return { type: 'Merge Conflict' }
                    default:
                        remainderB._tagList = [
                            ...compareResult.remainder.map((tag) => ([...tagA._tagList.slice(-minimumLength)[0].slice(0, -1), { ...boundaryElementA, data: tag }])),
                            ...remainderB._tagList.slice(0, -(minimumLength - 1))
                        ]
                        return {
                            type: 'B Longer',
                            remainder: maybeGenericIDFromTree(remainderB.tree)
                        }
                }
        }
    }
    else {
        if (!deepEqual(boundaryElementA, boundaryElementB)) {
            return { type: 'Merge Conflict' }
        }
        switch(greaterTree) {
            case 'A':
                remainderA._tagList = remainderA._tagList.slice(0, -minimumLength)
                return {
                    type: 'A Longer',
                    remainder: maybeGenericIDFromTree(remainderA.tree)
                }
            case 'B':
                remainderB._tagList = remainderB._tagList.slice(0, -minimumLength)
                return {
                    type: 'B Longer',
                    remainder: maybeGenericIDFromTree(remainderB.tree)
                }
            default:
                return { type: 'Equal' }
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
