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

type DeconvertTreeOptions<O extends {}, I extends {}> = {
    constructNode: (internal: O, children: I[]) => I;
}

const deconvertTreeHelper = <O extends {}, I extends {}>(options: DeconvertTreeOptions<O, I>) => (node: GenericTreeNode<O>): I => {
    const childOutputs = node.children.map(deconvertTreeHelper(options))
    return options.constructNode(node.data, childOutputs)
}

export const deconvertTree = <O extends {}, I extends {}>(options: DeconvertTreeOptions<O, I>) => (tree: GenericTree<O>): I[] => {
    return tree.map(deconvertTreeHelper(options))
}