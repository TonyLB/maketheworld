import IndexSubstitution from "../indexSubstitution"
import { deepEqual } from "../lib/objects";
import { GenericTree, GenericTreeNode } from "./baseClasses";

export class TreeUtility<N extends {}, InternalNode extends {}> {
    _nodeIndexes: IndexSubstitution<N>;
    _propertyIndexes: IndexSubstitution<InternalNode>
    _hierarchyIndexes: IndexSubstitution<string>
    _extractProperties: (value: N) => InternalNode | undefined
    
    constructor({ compare, extractProperties }: {
        compare: (A: N, B: N) => boolean;
        extractProperties: (value: N) => InternalNode | undefined;
    }) {
        this._nodeIndexes = new IndexSubstitution<N>(compare)
        this._propertyIndexes = new IndexSubstitution<InternalNode>(deepEqual)
        this._hierarchyIndexes = new IndexSubstitution<string>((A: string, B: string) => (A === B))
        this._extractProperties = extractProperties
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
}