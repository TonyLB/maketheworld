import { FlatTree, FlatTreeRow, NestedTree, NestedTreeEntry } from './interfaces'

type FlattenInProgress<T extends {}> = {
    levelsInProgress: NestedTree<T>;
    rootOutput: NestedTree<T>;
}

export const consolidateToLevel = <T extends {}>({ inProgress, newLevel }: { inProgress: FlattenInProgress<T>, newLevel: number }): FlattenInProgress<T> => {
    const { levelsInProgress, rootOutput } = inProgress
    const currentLevels = levelsInProgress.length - 1
    if (newLevel >= currentLevels) {
        if (newLevel === -1) {
            return { rootOutput: [...rootOutput, ...levelsInProgress], levelsInProgress: [] }
        }
        return { rootOutput, levelsInProgress }
    }
    else {
        type FlattenWorker<T extends {}> = {
            output: NestedTree<T>;
            accumulate?: NestedTreeEntry<T>
        }
        const { output: consolidatedLevels, accumulate } = levelsInProgress.reduceRight<FlattenWorker<T>>(
            ({ output, accumulate }: FlattenWorker<T>, current, index: number) => {
                if (index > newLevel) {
                    if (accumulate) {
                        return { output, accumulate: {
                            ...current,
                            children: [
                                ...current.children,
                                accumulate
                            ]
                        }}
                    }
                    else {
                        return { output, accumulate: current }
                    }
                }
                else {
                    if (accumulate) {
                        return {
                            output: [
                                {
                                    ...current,
                                    children: [
                                        ...current.children,
                                        accumulate
                                    ]
                                },
                            ]
                        }    
                    }
                    else {
                        return {
                            output: [
                                current,
                                ...output
                            ]
                        }
                    }
                }
            }, { output: [] })
        if (newLevel === -1) {
            return { rootOutput: [...rootOutput, ...(accumulate ? [accumulate] : [])], levelsInProgress: [] }
        }
        return { rootOutput, levelsInProgress: consolidatedLevels }
    }
    
}

export const convertFlatToNested = <T extends {}>(flatTree: FlatTree<T>): NestedTree<T> => {
    const output = consolidateToLevel<T>({
        inProgress: flatTree.reduce<FlattenInProgress<T>>((previous, { level, ...rest }: FlatTreeRow<T>) => {
                const { rootOutput, levelsInProgress } = consolidateToLevel<T>({ inProgress: previous, newLevel: level - 1 })
                return {
                    rootOutput,
                    levelsInProgress: [
                        ...levelsInProgress,
                        ({
                            ...rest,
                            children: []
                        } as unknown as NestedTreeEntry<T>)
                    ]
                }
            }, { rootOutput: [], levelsInProgress: [] }),
        newLevel: -1 })
    return output.rootOutput
}

export default convertFlatToNested
