import shortestCommonSupersequence, { ShortestCommonSupersetDirection } from "../shortestCommonSupersequence";
import { GenericTree, GenericTreeDiff, GenericTreeDiffAction } from "./baseClasses"
import { TreeUtility } from "./utilityClass";

type SequenceToTreeStackItem<N extends {}, InternalNode extends {}> = {
    key: number;
    properties: InternalNode[];
    children: GenericTreeDiff<N>;
    source: ShortestCommonSupersetDirection;
}

type SequenceToTreeReducer<N extends {}, InternalNode extends {}> = {
    topLevelOutput: GenericTreeDiff<N>;
    currentStack: SequenceToTreeStackItem<N, InternalNode>[];
}

//
// foldDiffTree turns a GenericTreeDiff (with action outside of the data element) into a GenericTree (with action
// inside of the modified data element))
//
export const foldDiffTree = <N extends {}>(tree: GenericTreeDiff<N>): GenericTree<N & { action: GenericTreeDiffAction }> => (
    tree.map(({ data, action, children }) => ({ data: { ...data, action }, children: foldDiffTree(children) }))
)

const nonContextActions = [GenericTreeDiffAction.Add, GenericTreeDiffAction.Delete, GenericTreeDiffAction.Set]

export const condenseDiffTree = <N extends {}>(tree: GenericTreeDiff<N>, verbose?: boolean): GenericTreeDiff<N> => {
    const items = tree.map(({ data, action, children }) => {
        const condensedChildren = condenseDiffTree(children, verbose)
        if (action === GenericTreeDiffAction.Exclude && condensedChildren.filter(({ action }) => (action !== GenericTreeDiffAction.Exclude)).length) {
            return {
                data,
                action: GenericTreeDiffAction.Context,
                children: condensedChildren
            }
        }
        else {
            return {
                data,
                action,
                children
            }
        }
    })
    const itemsWithSiblingContext = items.reduce<GenericTreeDiff<N>>((previous, item) => {
        const directlyPreviousItem = previous.length > 0 ? previous.slice(-1)[0] : undefined
        if (item.action === GenericTreeDiffAction.Exclude && nonContextActions.includes(directlyPreviousItem?.action)) {
            return [
                ...previous,
                {
                    ...item,
                    action: GenericTreeDiffAction.Context
                }
            ]
        }
        if (nonContextActions.includes(item.action) && directlyPreviousItem && directlyPreviousItem.action === GenericTreeDiffAction.Exclude) {
            return [
                ...previous.slice(0, -1),
                {
                    ...directlyPreviousItem,
                    action: GenericTreeDiffAction.Context
                },
                item
            ]
        }
        return [...previous, item]
    }, [])
    return itemsWithSiblingContext.filter(({ action }) => (verbose || action !== GenericTreeDiffAction.Exclude))
}

export const diffTrees = <N extends {}, InternalNode extends {}>(options: {
    compare: (A: N, B: N) => boolean;
    extractProperties: (value: N) => InternalNode | undefined;
    rehydrateProperties: (baseValue: N, properties: InternalNode[]) => N;
    verbose?: boolean;
}) => (treeA: GenericTree<N>, treeB: GenericTree<N>): GenericTreeDiff<N> => {
    const treeUtility = new TreeUtility(options)

    const [sequenceA, sequenceB] = [treeA, treeB].map((tree) => (treeUtility.treeToSequence(tree)))
    const mergedSequence = shortestCommonSupersequence(sequenceA, sequenceB, { showSource: true })

    //
    // Now reverse the conversion of the tree representation, unpacking the encoded
    // values in a parallel to the TreeUtility method sequenceToTree, but handling
    // source wrapping in order to generate the diff.
    //
    const { topLevelOutput } = mergedSequence.reduce<SequenceToTreeReducer<N, { properties: InternalNode; source: ShortestCommonSupersetDirection }>>((previous, sequenceItem) => {
        const { currentStack } = previous
        const baseKeyString = currentStack.map(({ key }) => (`${key}`)).join(':')
        const currentKeyString = treeUtility._hierarchyIndexes.fromIndex(sequenceItem.value)
        if (!currentKeyString) {
            throw new Error('sequenceToTree error, unknown sequence ID')
        }
        if (!currentKeyString.startsWith(baseKeyString)) {
            throw new Error('sequenceToTree error, hierarchy keys unaligned')
        }
        if (currentKeyString === baseKeyString) {
            //
            // Compare the source of the incoming item with the source of source of the opening
            // item to figure out the appropriate action to create on the tree node.
            //
            const topStackItem = currentStack.slice(-1)[0]
            const originalSource = topStackItem.source
            const incomingSource = sequenceItem.source
            const matches = [...new Set([originalSource, incomingSource])]
            if (matches.includes(ShortestCommonSupersetDirection.A) && matches.includes(ShortestCommonSupersetDirection.B)) {
                throw new Error('Diff structure unaligned (weird)')
            }
            const overallSource = (matches.length === 1 && matches[0] === ShortestCommonSupersetDirection.both) ? ShortestCommonSupersetDirection.both
                : (matches.includes(ShortestCommonSupersetDirection.A)) ? ShortestCommonSupersetDirection.A : ShortestCommonSupersetDirection.B

            //
            // Resolve node by comparing stored properties
            //
            const baseNode = treeUtility._nodeIndexes.fromIndex(topStackItem.key)
            if (typeof baseNode === 'undefined') {
                throw new Error('sequenceToTree error, node index undefined')
            }
            //
            // Extract appropriate properties list given the sources of the property items that
            // have been collected.
            //
            const sharedProperties = topStackItem.properties.filter(({ source }) => (source === ShortestCommonSupersetDirection.both))
            const sourceProperties = topStackItem.properties.filter(({ source }) => (source === ShortestCommonSupersetDirection.A))
            const incomingProperties = topStackItem.properties.filter(({ source }) => (source === ShortestCommonSupersetDirection.B))
            const properties = overallSource === ShortestCommonSupersetDirection.A ? [...sharedProperties, ...sourceProperties] : [...incomingProperties, ...sharedProperties]
            const hydratedNode = treeUtility._rehydrateProperties(baseNode, properties.map(({ properties }) => (properties)))
            //
            // Use the following to deduce the correct action for treeNode:
            //    - overallSource
            //    - the distribution of properties between shared and individual nodes (i.e., whether the property value has changed;
            //        if sharedProperties has length then it indicates that the node has unchanged properties)
            // The actions of all incoming children will be addressed in condenseDiffTree (and may change some Exclude actions to
            // Context where needed in order to provide position for changes)
            //
            const action = (overallSource === ShortestCommonSupersetDirection.A) ? GenericTreeDiffAction.Delete
                : (overallSource === ShortestCommonSupersetDirection.B) ? GenericTreeDiffAction.Add
                : (sharedProperties.length) ? GenericTreeDiffAction.Exclude : GenericTreeDiffAction.Set
            const treeNode = {
                data: hydratedNode,
                children: topStackItem.children,
                action
            }
            if (currentStack.length > 1) {
                //
                // Push onto children when encountering matching node key in nested iteration
                //
                const previousStackItem = currentStack.slice(-2)[0]
                return {
                    ...previous,
                    currentStack: [
                        ...currentStack.slice(0, -2),
                        {
                            ...previousStackItem,
                            children: [
                                ...previousStackItem.children,
                                treeNode
                            ]
                        }
                    ]
                }
            }
            else {
                //
                // Push onto top level results when encountering matching node key at top level
                //
                return {
                    topLevelOutput: [
                        ...previous.topLevelOutput,
                        treeNode
                    ],
                    currentStack: []
                }
            }
        }
        const nextTag = baseKeyString.length ? currentKeyString.slice(baseKeyString.length + 1) : currentKeyString
        if (nextTag.split(':').length > 1) {
            throw new Error('sequenceToTree error, hierarchy keys incorrect structure')
        }
        if (nextTag.startsWith('P-')) {
            //
            // Push properties onto current stack item when encountering P-* key
            //
            const propertyIndex = parseInt(nextTag.slice(2))
            const newProperty = treeUtility._propertyIndexes.fromIndex(propertyIndex)
            if (typeof newProperty === 'undefined') {
                throw new Error('sequenceToTree error, property index undefined')
            }
            const lastStackItem = currentStack.slice(-1)[0]
            return {
                ...previous,
                currentStack: [
                    ...currentStack.slice(0, -1),
                    {
                        ...lastStackItem,
                        properties: [
                            ...lastStackItem.properties,
                            {
                                properties: newProperty,
                                source: sequenceItem.source
                            }
                        ]
                    }
                ]
            }
        }
        else {
            //
            // Push new item onto stack if you encounter a node key that nests further
            //
            const nodeIndex = parseInt(nextTag)
            return {
                ...previous,
                currentStack: [
                    ...currentStack,
                    {
                        key: nodeIndex,
                        properties: [],
                        children: [],
                        source: sequenceItem.source
                    }
                ]
            }

        }
    }, { topLevelOutput: [], currentStack: [] })
    return condenseDiffTree(topLevelOutput, options.verbose)
}

export default diffTrees