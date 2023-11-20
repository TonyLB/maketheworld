import { GenericTree, GenericTreeNode } from "./baseClasses"

type ConvertToTreeOptions<I extends {}, O extends {}> = {
    extractNode: (incoming: I) => O;
    extractChildren: (incoming: I) => I[];
}

const convertToTreeHelper = <I extends {}, O extends {}>(options: ConvertToTreeOptions<I, O>) => (node: I): GenericTreeNode<O> => {
    const children = options.extractChildren(node)
    const convertedChildren = children.map(convertToTreeHelper(options))
    return {
        data: options.extractNode(node),
        children: convertedChildren
    }
}

export const convertToTree = <I extends {}, O extends {}>(options: ConvertToTreeOptions<I, O>) => (tree: I[]): GenericTree<O> => {
    return tree.map(convertToTreeHelper(options))
}