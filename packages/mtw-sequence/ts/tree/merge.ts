import { GenericTree } from "./baseClasses"

//
// TODO: Definte an index-substitution schema for the generic tree (probably accepting
// a comparison helper method as an argument)
//

//
// TODO: Lift navigationSequenceReducer methods from orderedConditionalTree and generalize
//

//
// TODO: Lift and generalize mergeOrderedConditionalTrees from orderedConditionalTree
//

//
// TODO: Define P-${index} property nodes that are the first listed "contents" of a
// node's appearance in the tree, and which identify a set of properties for that node
// (independent of the node's children).  This lets the item defining the node ITSELF
// be identical (and matchable), while also allowing the merging of items with different
// property values.
//

//
// TODO: Add a mergedNode function that takes all incoming P-${index} properties, as well
// as the merged set of children, and exports the final node value back into GenericTree
// structure.
//

export const mergeTrees = <N extends {}>(...args: GenericTree<N>[]): GenericTree<N> => {
    return []
}