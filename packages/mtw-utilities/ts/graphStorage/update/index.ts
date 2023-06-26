import { unique } from "../../lists"
import { ephemeraDB } from "../../dynamoDB"
import { reduceDependencyGraph, extractTree } from "../cache"
import { DependencyNode, DependencyEdge, DependencyGraphAction, isDependencyGraphPut, isLegalDependencyTag, CacheBase } from "../cache/baseClasses"
import { extractConstrainedTag } from "../../types"
import GraphCache from "../cache"

export type DescentUpdateMessage = {
    type: 'DescentUpdate';
} & DependencyGraphAction

export type AncestryUpdateMessage = {
    type: 'AncestryUpdate';
} & DependencyGraphAction

const getAntiDependency = <C extends InstanceType<ReturnType<typeof GraphCache<typeof CacheBase>>>>(internalCache: C, dependencyTag: 'Descent' | 'Ancestry') => async (EphemeraId: string): Promise<DependencyEdge[]> => {
    const antiDependencyTag = dependencyTag === 'Descent' ? 'Ancestry' : 'Descent'
    const knownTree = internalCache[antiDependencyTag].getPartial(EphemeraId).find(({ EphemeraId: check }) => (check === EphemeraId))
    if (knownTree?.completeness === 'Complete') {
        return knownTree.connections
    }
    else {
        const fetchedTree = (await internalCache[antiDependencyTag].get(EphemeraId)).find(({ EphemeraId: check }) => (check === EphemeraId))
        return fetchedTree?.connections || []
    }
}

type GraphStorageMessage = DescentUpdateMessage | AncestryUpdateMessage

type GraphStorageIterationProps = {
    descent: {
        payloads: DependencyGraphAction[];
        alreadyProcessed: DependencyGraphAction[];
    };
    ancestry: {
        payloads: DependencyGraphAction[];
        alreadyProcessed: DependencyGraphAction[];
    }
}

type GraphStorageIterationReturn = {
    descent: {
        processedItems: DependencyGraphAction[];
        unprocessedItems: DependencyGraphAction[];
    };
    ancestry: {
        processedItems: DependencyGraphAction[];
        unprocessedItems: DependencyGraphAction[];
    }
}

//
// TODO: Replace incoming arguments with split arguments by descent and ancestry
//
export const updateGraphStorageIteration = <C extends InstanceType<ReturnType<typeof GraphCache<typeof CacheBase>>>>(internalCache: C) => async (payloads: GraphStorageIterationProps): Promise<GraphStorageIterationReturn> => {
    const dependencyTags = ['descent', 'ancestry'] as const
    let returnVal: GraphStorageIterationReturn = {
        descent: { processedItems: [], unprocessedItems: [] },
        ancestry: { processedItems: [], unprocessedItems: [] }
    }
    await Promise.all(dependencyTags.map(async (dependencyTag) => {
        const upcaseDependencyTag = dependencyTag === 'descent' ? 'Descent' : 'Ancestry'
        const { payloads: payloadActions, alreadyProcessed } = payloads[dependencyTag]
        internalCache[upcaseDependencyTag].put(payloadActions
            .filter(isDependencyGraphPut)
            .map(({ EphemeraId, putItem }): DependencyNode => ({
                EphemeraId,
                completeness: 'Partial',
                connections: [putItem]
            }))
            .filter((value: DependencyNode | undefined): value is DependencyNode => (typeof value !== 'undefined'))
        )
        const updatingNodes = unique(payloadActions.map(({ EphemeraId }) => (EphemeraId)))
        const workablePayload = (message: DependencyGraphAction) => {
            if (isDependencyGraphPut(message)) {
                return !Boolean(internalCache[upcaseDependencyTag].getPartial(message.putItem.EphemeraId).find(({ EphemeraId }) => (updatingNodes.includes(EphemeraId))))
            }
            else {
                return !Boolean(internalCache[upcaseDependencyTag].getPartial(message.deleteItem.EphemeraId).find(({ EphemeraId }) => (updatingNodes.includes(EphemeraId))))
            }
        }
        const workableTargets = updatingNodes
            .filter((target) => (
                !payloadActions
                    .filter(({ EphemeraId }) => (EphemeraId === target))
                    .find((payload) => (!workablePayload(payload)))
            ))
        const payloadsByTarget = payloadActions
            .filter(({ EphemeraId }) => (workableTargets.includes(EphemeraId)))
            .reduce<Record<string, DependencyGraphAction[]>>((previous, { EphemeraId, ...rest }) => ({
                ...previous,
                [EphemeraId]: [
                    ...(previous[EphemeraId] || []),
                    { EphemeraId, ...rest }
                ]
            }), {})
        let unprocessedItems = payloadActions.filter(({ EphemeraId }) => (!workableTargets.includes(EphemeraId)))
        let processedItems = payloadActions.filter(({ EphemeraId }) => (workableTargets.includes(EphemeraId)))
        await Promise.all(Object.entries(payloadsByTarget).map(async ([targetId, payloadList]) => {
            const tag = extractConstrainedTag(isLegalDependencyTag)(targetId)
            //
            // Because we only update the Descent (and need the Ancestry's unchanged value), we run getItem and update
            // in parallel rather than suffer the hit for requesting ALL_NEW ReturnValue
            //
            const [antidependency] = await Promise.all([
                getAntiDependency(internalCache, upcaseDependencyTag)(targetId),
                ephemeraDB.optimisticUpdate({
                    key: {
                        EphemeraId: targetId,
                        DataCategory: `Meta::${tag}`
                    },
                    //
                    // As part of ISS1539, remove the need to fetch DataCategory in order to give the updateReducer something to chew
                    // on so that it can recognize the existence of the row.
                    //
                    updateKeys: [upcaseDependencyTag, 'DataCategory'],
                    updateReducer: (draft) => {
                        if (typeof draft[upcaseDependencyTag] === 'undefined') {
                            //
                            // If you're defining for the first time, make a deeply non-immutable copy of the current
                            // internalCache
                            //
                            draft[upcaseDependencyTag] = internalCache[upcaseDependencyTag].getPartial(targetId)
                                .map(({ completeness, connections, ...rest }) => ({
                                    ...rest, 
                                    connections: connections
                                        .map(({ assets, ...rest }) => ({ ...rest, assets: [...assets] }))
                                }))
                        }
                        const startGraph: Record<string, DependencyNode> = draft[upcaseDependencyTag].reduce((previous, { EphemeraId, ...rest }) => ({ ...previous, [EphemeraId]: { EphemeraId, completeness: 'Complete', ...rest }}), {})
                        //
                        // TODO: Correct how current update of descent does *not* correctly update descent cascades (see unit test for example)
                        //
                        reduceDependencyGraph(startGraph, payloadList)
                        draft[upcaseDependencyTag] = extractTree(Object.values(startGraph), targetId)
                            .map((node) => {
                                const { completeness, ...rest } = node
                                return rest
                            })
                    }
                })
            ])
    
            antidependency.forEach((antiDependentItem) => {
                unprocessedItems.push({
                    EphemeraId: antiDependentItem.EphemeraId,
                    putItem: {
                        key: antiDependentItem.key,
                        EphemeraId: targetId,
                        assets: antiDependentItem.assets
                    }
                } as DependencyGraphAction)
            })
        }))
        returnVal[dependencyTag] = {
            processedItems,
            unprocessedItems
        }
    }))
    return returnVal
}

export const updateGraphStorage = <C extends InstanceType<ReturnType<typeof GraphCache<typeof CacheBase>>>>(internalCache: C) => async ({ descent, ancestry }: { descent: DependencyGraphAction[]; ancestry: DependencyGraphAction[] }): Promise<void> => {
    let workingActions: GraphStorageIterationProps = {
        descent: {
            payloads: descent,
            alreadyProcessed: []
        },
        ancestry: {
            payloads: ancestry,
            alreadyProcessed: []
        }
    }
    while((workingActions.descent.payloads.length + workingActions.ancestry.payloads.length) > 0) {
        const output = await updateGraphStorageIteration(internalCache)(workingActions)
        const { descent, ancestry } = output
        workingActions = {
            descent: {
                payloads: descent.unprocessedItems,
                alreadyProcessed: [...workingActions.descent.alreadyProcessed, ...descent.processedItems]
            },
            ancestry: {
                payloads: ancestry.unprocessedItems,
                alreadyProcessed: [...workingActions.ancestry.alreadyProcessed, ...ancestry.processedItems]
            }
        }
    }
}

export default updateGraphStorage
