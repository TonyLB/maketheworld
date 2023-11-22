import shortestCommonSupersequence from "../shortestCommonSupersequence";
import { GenericTree } from "./baseClasses"
import { TreeUtility } from "./utilityClass";

export const mergeTrees = <N extends {}, InternalNode extends {}>(options: {
    compare: (A: N, B: N) => boolean;
    extractProperties: (value: N) => InternalNode | undefined;
    rehydrateProperties: (baseValue: N, properties: InternalNode[]) => N;
}) => (...args: GenericTree<N>[]): GenericTree<N> => {
    const treeUtility = new TreeUtility(options)
    const sequences = args.map((tree) => (treeUtility.treeToSequence(tree)))
    const mergedSequence = sequences.reduce<number[]>((previous, sequence) => (shortestCommonSupersequence(previous, sequence)), [])
    return treeUtility.sequenceToTree(mergedSequence)
}

export default mergeTrees