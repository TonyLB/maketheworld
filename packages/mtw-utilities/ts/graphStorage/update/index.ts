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

export const updateGraphStorageIteration = <C extends InstanceType<ReturnType<typeof GraphCache<typeof CacheBase>>>>(internalCache: C) => async ({ payloads, alreadyProcessed }: { payloads: GraphStorageMessage[]; alreadyProcessed: GraphStorageMessage[] }): Promise<{ processedItems: GraphStorageMessage[]; unprocessedItems: GraphStorageMessage[] }> => {
    const dependencyTags = ['Descent', 'Ancestry'] as const
    let unprocessedItems: GraphStorageMessage[] = []
    let processedItems: GraphStorageMessage[] = []
    await Promise.all(dependencyTags.map(async (dependencyTag) => {
        const payloadActions = payloads
            .filter(({ type }) => (type === `${dependencyTag}Update`))
            .filter(({ EphemeraId }) => (!alreadyProcessed.find(({ type, EphemeraId: checkEphemeraId }) => (type === `${dependencyTag}Update` && checkEphemeraId === EphemeraId))))
            .map<DependencyGraphAction>(({ type, ...rest }) => (rest))
        internalCache[dependencyTag].put(payloadActions
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
                return !Boolean(internalCache[dependencyTag].getPartial(message.putItem.EphemeraId).find(({ EphemeraId }) => (updatingNodes.includes(EphemeraId))))
            }
            else {
                return !Boolean(internalCache[dependencyTag].getPartial(message.deleteItem.EphemeraId).find(({ EphemeraId }) => (updatingNodes.includes(EphemeraId))))
            }
        }
        const workableTargets = updatingNodes
            .filter((target) => (
                !payloadActions
                    .filter(({ EphemeraId }) => (EphemeraId === target))
                    .find((payload) => (!workablePayload(payload)))
            ))
        const payloadsByTarget = payloads
            .filter(({ EphemeraId }) => (workableTargets.includes(EphemeraId)))
            .reduce<Record<string, DependencyGraphAction[]>>((previous, { EphemeraId, ...rest }) => ({
                ...previous,
                [EphemeraId]: [
                    ...(previous[EphemeraId] || []),
                    { EphemeraId, ...rest }
                ]
            }), {})
        unprocessedItems = [...unprocessedItems, ...payloads.filter(({ EphemeraId }) => (!workableTargets.includes(EphemeraId)))]
        processedItems= [...processedItems, ...payloads.filter(({ EphemeraId }) => (workableTargets.includes(EphemeraId)))]
        await Promise.all(Object.entries(payloadsByTarget).map(async ([targetId, payloadList]) => {
            const tag = extractConstrainedTag(isLegalDependencyTag)(targetId)
            //
            // Because we only update the Descent (and need the Ancestry's unchanged value), we run getItem and update
            // in parallel rather than suffer the hit for requesting ALL_NEW ReturnValue
            //
            const [antidependency] = await Promise.all([
                getAntiDependency(internalCache, dependencyTag)(targetId),
                ephemeraDB.optimisticUpdate({
                    key: {
                        EphemeraId: targetId,
                        DataCategory: `Meta::${tag}`
                    },
                    //
                    // As part of ISS1539, remove the need to fetch DataCategory in order to give the updateReducer something to chew
                    // on so that it can recognize the existence of the row.
                    //
                    updateKeys: [dependencyTag, 'DataCategory'],
                    updateReducer: (draft) => {
                        if (typeof draft[dependencyTag] === 'undefined') {
                            //
                            // If you're defining for the first time, make a deeply non-immutable copy of the current
                            // internalCache
                            //
                            draft[dependencyTag] = internalCache[dependencyTag].getPartial(targetId)
                                .map(({ completeness, connections, ...rest }) => ({
                                    ...rest, 
                                    connections: connections
                                        .map(({ assets, ...rest }) => ({ ...rest, assets: [...assets] }))
                                }))
                        }
                        const startGraph: Record<string, DependencyNode> = draft[dependencyTag].reduce((previous, { EphemeraId, ...rest }) => ({ ...previous, [EphemeraId]: { EphemeraId, completeness: 'Complete', ...rest }}), {})
                        //
                        // TODO: Correct how current update of descent does *not* correctly update descent cascades (see unit test for example)
                        //
                        reduceDependencyGraph(startGraph, payloadList)
                        draft[dependencyTag] = extractTree(Object.values(startGraph), targetId)
                            .map((node) => {
                                const { completeness, ...rest } = node
                                return rest
                            })
                    }
                })
            ])
    
            antidependency.forEach((antiDependentItem) => {
                unprocessedItems.push({
                    type: `${dependencyTag}Update`,
                    EphemeraId: antiDependentItem.EphemeraId,
                    putItem: {
                        key: antiDependentItem.key,
                        EphemeraId: targetId,
                        assets: antiDependentItem.assets
                    }
                } as GraphStorageMessage)
            })
        }))    
    }))
    return { processedItems, unprocessedItems: unique(unprocessedItems).filter(({ EphemeraId, type }) => (!alreadyProcessed.find(({ type: checkType, EphemeraId: checkEphemeraId }) => (type === checkType && checkEphemeraId === EphemeraId)))) }
}

export const updateGraphStorage = <C extends InstanceType<ReturnType<typeof GraphCache<typeof CacheBase>>>>(internalCache: C) => async ({ payloads }: { payloads: GraphStorageMessage[]; }): Promise<void> => {
    const dependencyTags = ['Descent', 'Ancestry']
    dependencyTags.forEach((dependencyTag) => {
    })
    let workingActions = [...payloads]
    let alreadyProcessed: GraphStorageMessage[] = []
    while(workingActions.length) {
        const output = await updateGraphStorageIteration(internalCache)({ payloads: workingActions, alreadyProcessed })
        const { processedItems, unprocessedItems } = output
        alreadyProcessed = [...alreadyProcessed, ...processedItems]
        workingActions = unprocessedItems
    }
}

export default updateGraphStorage
