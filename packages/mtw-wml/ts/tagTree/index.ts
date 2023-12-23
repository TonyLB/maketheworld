import { GenericTree } from "../sequence/tree/baseClasses"

type TagTreeLeafNode<NodeData extends {}> = {
    node: NodeData;
    tagKeys: string[];
}

export class TagTree<NodeData extends {}> {
    _tree: GenericTree<NodeData>

    constructor(tree: GenericTree<NodeData>) {
        this._tree = tree
    }

    tree() {
        return this._tree
    }
    //
    // TODO: Create first-draft serializer that returns original tree
    //

}

export default TagTree
