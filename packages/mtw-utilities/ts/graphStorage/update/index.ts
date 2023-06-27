import { unique } from "../../lists"
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

type GraphStorageDBHandler<T extends string> = {
    optimisticUpdate: (props: {
        key: Record<T | 'DataCategory', string>
        updateKeys: string[];
        updateReducer: (draft: { Descent?: Omit<DependencyNode, 'completeness'>[]; Ancestry?: Omit<DependencyNode, 'completeness'>[] }) => void;
    }) => Promise<any>
}

export const updateGraphStorageCallback = <T extends string>(metaProps: {
    keyLabel: T;
    dbHandler: GraphStorageDBHandler<T>;
    internalCache: {
        Descent: { getPartial: (value: string) => (DependencyNode & { completeness: 'Partial' | 'Complete'; connections: DependencyEdge[] })[] };
        Ancestry: { getPartial: (value: string) => (DependencyNode & { completeness: 'Partial' | 'Complete'; connections: DependencyEdge[] })[] };
    }
}) => (props: {
    key: string;
    DataCategory: string;
    dependencyTag: 'Descent' | 'Ancestry';
    payloads: DependencyGraphAction[];
}) => {
    const extractKey = (item: Omit<DependencyNode, 'completeness'>) => (item[metaProps.keyLabel as any] as string)
    return metaProps.dbHandler.optimisticUpdate({
        key: {
            [metaProps.keyLabel]: props.key,
            DataCategory: props.DataCategory
        } as Record<T | 'DataCategory', string>,
        //
        // As part of ISS1539, remove the need to fetch DataCategory in order to give the updateReducer something to chew
        // on so that it can recognize the existence of the row.
        //
        updateKeys: [props.dependencyTag, 'DataCategory'],
        updateReducer: (draft) => {
            if (typeof draft[props.dependencyTag] === 'undefined') {
                //
                // If you're defining for the first time, make a deeply non-immutable copy of the current
                // internalCache
                //
                const fetchPartial = metaProps.internalCache[props.dependencyTag].getPartial(props.key)
                draft[props.dependencyTag] = fetchPartial
                    .map(({ completeness, connections, ...rest }) => ({
                        ...rest, 
                        connections: connections
                            .map(({ assets, ...rest }) => ({ ...rest, assets: [...assets] }))
                    }))
            }
            const startGraph: Record<string, DependencyNode> = (draft[props.dependencyTag] || []).reduce((previous, item) => ({ ...previous, [extractKey(item)]: { ...item, completeness: 'Complete' }}), {})
            //
            // TODO: Correct how current update of descent does *not* correctly update descent cascades (see unit test for example)
            //
            reduceDependencyGraph(startGraph, props.payloads)
            draft[props.dependencyTag] = extractTree(Object.values(startGraph), props.key)
                .map((node) => {
                    const { completeness, ...rest } = node
                    return rest
                })
        }
    })
}

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
export const updateGraphStorageIteration = <C extends InstanceType<ReturnType<typeof GraphCache<typeof CacheBase>>>, T extends string>({ internalCache, dbHandler, keyLabel }: { internalCache: C; dbHandler: GraphStorageDBHandler<T>; keyLabel: T }) => async (payloads: GraphStorageIterationProps): Promise<GraphStorageIterationReturn> => {
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
                updateGraphStorageCallback({ keyLabel, dbHandler, internalCache })({
                    key: targetId,
                    DataCategory: `Meta::${tag}`,
                    dependencyTag: upcaseDependencyTag,
                    payloads: payloadList
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

export const updateGraphStorage = <C extends InstanceType<ReturnType<typeof GraphCache<typeof CacheBase>>>, T extends string>(metaProps: { internalCache: C; dbHandler: GraphStorageDBHandler<T>; keyLabel: T }) => async ({ descent, ancestry }: { descent: DependencyGraphAction[]; ancestry: DependencyGraphAction[] }): Promise<void> => {
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
        const output = await updateGraphStorageIteration(metaProps)(workingActions)
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
