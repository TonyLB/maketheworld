import { AncestryUpdateMessage, DescentUpdateMessage, MessageBus } from "../messageBus/baseClasses"

import { unique } from "@tonylb/mtw-utilities/dist/lists"
import { ephemeraDB } from "@tonylb/mtw-utilities/dist/dynamoDB"
import { deepEqual } from "@tonylb/mtw-utilities/dist/objects"
import internalCache from "../internalCache"
import { compareEdges, reduceDependencyGraph, extractTree } from "../internalCache/dependencyGraph"
import { DependencyEdge, DependencyGraphAction, DependencyNode, isDependencyGraphDelete, isDependencyGraphPut } from "../internalCache/baseClasses"
import { tagFromEphemeraId } from "../internalCache/dependencyGraph"

const getAntiDependency = (dependencyTag: 'Descent' | 'Ancestry') => async (EphemeraId: string): Promise<DependencyEdge[]> => {
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

export const dependentUpdateMessage = (dependencyTag: 'Descent' | 'Ancestry') => async ({ payloads, messageBus }: { payloads: (DescentUpdateMessage | AncestryUpdateMessage)[]; messageBus: MessageBus }): Promise<void> => {
    const payloadActions = payloads.map<DependencyGraphAction>(({ type, ...rest }) => (rest))
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
    console.log(`updatingNodes: ${JSON.stringify(updatingNodes, null, 4)}`)
    const workablePayload = (message: DependencyGraphAction) => {
        if (isDependencyGraphPut(message)) {
            return !Boolean(internalCache[dependencyTag].getPartial(message.putItem.EphemeraId).find(({ EphemeraId }) => (updatingNodes.includes(EphemeraId))))
        }
        else {
            return !Boolean(internalCache[dependencyTag].getPartial(message.deleteItem.EphemeraId).find(({ EphemeraId }) => (updatingNodes.includes(EphemeraId))))
        }
    }
    const payloadsByTarget = payloadActions
        .filter(workablePayload)
        .reduce<Record<string, DependencyGraphAction[]>>((previous, { EphemeraId, ...rest }) => ({
            ...previous,
            [EphemeraId]: [
                ...(previous[EphemeraId] || []),
                { EphemeraId, ...rest }
            ]
        }), {})
    const unworkablePayloads = payloads.filter(({ type, ...payload}) => (!workablePayload(payload)))
    console.log(`UnworkablePayloads: ${JSON.stringify(unworkablePayloads, null, 4)}`)

    unworkablePayloads.forEach((payload) => {
        messageBus.send(payload)
    })

    console.log(`payloadsByTarget: ${JSON.stringify(payloadsByTarget, null, 4)}`)
    await Promise.all(Object.entries(payloadsByTarget).map(async ([targetId, payloadList]) => {
        const tag = tagFromEphemeraId(targetId)
        //
        // Because we only update the Descent (and need the Ancestry's unchanged value), we run getItem and update
        // in parallel rather than suffer the hit for requesting ALL_NEW ReturnValue
        //
        // const [antidependency, dependencyMap] = await Promise.all([
        const antidependency = await getAntiDependency(dependencyTag)(targetId)
        //     (async () => {
        //         const fetchDependents = await Promise.all(payloadList.map(async (payload) => {
        //             if (isDependencyGraphPut(payload)) {
        //                 //
        //                 // TODO: Figure out how to use eventually-consistent reads, and then do a
        //                 // transactional lock to check that they haven't been changed as part of the
        //                 // update, rather than depend upon consistent reads:  May get better performance.
        //                 //
        //                 const fetchValue = (await ephemeraDB.getItem<{ Ancestry?: DependencyNode[]; Descent?: DependencyNode[] }>({
        //                     EphemeraId: payload.putItem.EphemeraId,
        //                     DataCategory: `Meta::${tagFromEphemeraId(payload.putItem.EphemeraId)}`,
        //                     ProjectionFields: [dependencyTag],
        //                     ConsistentRead: true
        //                 })) || {}
        //                 return { [payload.putItem.EphemeraId]: fetchValue?.[dependencyTag] || [] }
        //             }
        //             else {
        //                 return {}
        //             }
        //         }))
        //         return Object.assign({}, ...fetchDependents) as Record<string, DependencyNode>
        //     })()
        // ])
        await ephemeraDB.optimisticUpdate({
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
                    draft[dependencyTag] = []
                }
                const startGraph: Record<string, DependencyNode> = draft[dependencyTag].reduce((previous, { EphemeraId, ...rest }) => ({ ...previous, [EphemeraId]: { EphemeraId, completeness: 'Complete', ...rest }}), {})
                const reducedGraph = reduceDependencyGraph(startGraph, payloadList)
                draft[dependencyTag] = extractTree(Object.values(reducedGraph), targetId)
                    .map((node) => {
                        const { completeness, ...rest } = node
                        return rest
                    })
                // payloadList.forEach((payloadItem) => {
                //     if (isDependencyGraphPut(payloadItem)) {
                //         const { putItem } = payloadItem
                //         let alreadyFound = false
                //         draft[dependencyTag].forEach((dependentItem) => {
                //             if (compareEdges(dependentItem, putItem)) {
                //                 alreadyFound = true
                //                 if (!deepEqual(dependentItem.connections, dependencyMap[putItem.EphemeraId])) {
                //                     dependentItem.connections = dependencyMap[putItem.EphemeraId]
                //                 }
                //                 dependentItem.assets = unique(dependentItem.assets || [], putItem.assets)
                //             }
                //         })
                //         if (!alreadyFound) {
                //             draft[dependencyTag].push({
                //                 ...putItem,
                //                 connections: dependencyMap[putItem.EphemeraId]
                //             })
                //         }
                //     }
                //     if (isDependencyGraphDelete(payloadItem)) {
                //         const { deleteItem } = payloadItem
                //         draft[dependencyTag].forEach((dependentItem) => {
                //             if (compareEdges(dependentItem, deleteItem)) {
                //                 dependentItem.assets = dependentItem.assets.filter((check) => (!(deleteItem.assets.includes(check))))
                //             }
                //         })
                //         draft[dependencyTag] = draft[dependencyTag].filter(({ assets }) => (assets.length > 0))
                //     }
                // })
            }
        })
        //
        // TODO: Don't double-message when a cascade update (below) reproduces a message that was repeated as unworkable (above)
        //
        antidependency.forEach((antiDependentItem) => {
            messageBus.send({
                type: `${dependencyTag}Update`,
                EphemeraId: antiDependentItem.EphemeraId,
                putItem: {
                    key: antiDependentItem.key,
                    EphemeraId: targetId,
                    assets: antiDependentItem.assets
                }
            } as DescentUpdateMessage | AncestryUpdateMessage)
        })
    }))
}

export default dependentUpdateMessage
