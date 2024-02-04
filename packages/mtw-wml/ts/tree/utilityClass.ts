import IndexSubstitution from "../sequence/indexSubstitution"
import { deepEqual } from "../sequence/lib/objects";
import { GenericTree, GenericTreeNode } from "./baseClasses";

type SequenceToTreeStackItem<N extends {}, InternalNode extends {}> = {
    key: number;
    properties: InternalNode[];
    children: GenericTree<N>;
}

type SequenceToTreeReducer<N extends {}, InternalNode extends {}> = {
    topLevelOutput: GenericTree<N>;
    currentStack: SequenceToTreeStackItem<N, InternalNode>[];
}

export class TreeUtility<N extends {}, InternalNode extends {}> {
    _nodeIndexes: IndexSubstitution<N>;
    _propertyIndexes: IndexSubstitution<InternalNode>
    _hierarchyIndexes: IndexSubstitution<string>
    _extractProperties: (value: N) => InternalNode | undefined
    _rehydrateProperties: (baseValue: N, properties: InternalNode[]) => N
    
    constructor({ compare, extractProperties, rehydrateProperties }: {
        compare: (A: N, B: N) => boolean;
        extractProperties: (value: N) => InternalNode | undefined;
        rehydrateProperties: (baseValue: N, properties: InternalNode[]) => N;
    }) {
        this._nodeIndexes = new IndexSubstitution<N>(compare)
        this._propertyIndexes = new IndexSubstitution<InternalNode>(deepEqual)
        this._hierarchyIndexes = new IndexSubstitution<string>((A: string, B: string) => (A === B))
        this._extractProperties = extractProperties
        this._rehydrateProperties = rehydrateProperties
    }

    node(index: number): N | undefined {
        return this._nodeIndexes.fromIndex(index)
    }

    property(index: number): InternalNode | undefined {
        return this._propertyIndexes.fromIndex(index)
    }

    //
    // Convert into a tree representation in strings of encoded node and property indexes,
    // like so: '0', '0:1', '0:1:P-0', '0:1', '0'.
    //
    // Each node will include an entry of its own value following all of its ancestor values
    // (e.g., '0', or '0:1') as both the _beginning_ and _end_ of its subsection.
    //
    // A node can (if it has properties) also include a property 'child', followed by all of
    // its node children (each with their own enclosure).
    //
    // Each of these strings is then turned into an index in hierarchyIndexes, and the list
    // of indexes returned.
    //
    _treeSequenceRecursive(node: GenericTreeNode<N>): string[] {
        const properties = this._extractProperties(node.data)
        const nodeWrapper = this._nodeIndexes.toIndex(node.data)
        const propertyWrapper = (typeof properties !== 'undefined') ? [`${nodeWrapper}:P-${this._propertyIndexes.toIndex(properties)}`] : []
        const childrenSequence = node.children.map(this._treeSequenceRecursive.bind(this)).flat()
        return [
            `${nodeWrapper}`,
            ...propertyWrapper,
            ...(childrenSequence.map((subTree) => (`${nodeWrapper}:${subTree}`))),
            `${nodeWrapper}`
        ]
    }
    treeToSequence(tree: GenericTree<N>): number[] {
        return tree.map((node) => (this._treeSequenceRecursive(node))).flat().map((sequenceString) => (this._hierarchyIndexes.toIndex(sequenceString)))
    }

    //
    // Reverse the conversion of the tree representation, unpacking the encoded values
    // out of the various indexes they've been converted into.
    //
    sequenceToTree(sequence: number[]): GenericTree<N> {
        const { topLevelOutput } = sequence.reduce<SequenceToTreeReducer<N, InternalNode>>((previous, sequenceItem) => {
            const { currentStack } = previous
            const baseKeyString = currentStack.map(({ key }) => (`${key}`)).join(':')
            const currentKeyString = this._hierarchyIndexes.fromIndex(sequenceItem)
            if (!currentKeyString) {
                throw new Error('sequenceToTree error, unknown sequence ID')
            }
            if (!currentKeyString.startsWith(baseKeyString)) {
                throw new Error('sequenceToTree error, hierarchy keys unaligned')
            }
            if (currentKeyString === baseKeyString) {
                //
                // Resolve node by rehydrating stored properties
                //
                const topStackItem = currentStack.slice(-1)[0]
                const baseNode = this._nodeIndexes.fromIndex(topStackItem.key)
                if (typeof baseNode === 'undefined') {
                    throw new Error('sequenceToTree error, node index undefined')
                }
                const hydratedNode = this._rehydrateProperties(baseNode, topStackItem.properties)
                const treeNode = {
                    data: hydratedNode,
                    children: topStackItem.children
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
                const newProperty = this._propertyIndexes.fromIndex(propertyIndex)
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
                                newProperty
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
                            children: []
                        }
                    ]
                }

            }
        }, { topLevelOutput: [], currentStack: [] })
        return topLevelOutput
    }
}