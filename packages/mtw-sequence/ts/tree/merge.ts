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

export const mergeTrees = <N extends {}>(...args: GenericTree<N>[]): GenericTree<N> => {
    return []
}