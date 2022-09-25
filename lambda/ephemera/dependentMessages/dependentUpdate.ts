import { AncestryUpdateNonAssetMessage, LegacyDependencyNode, DependencyUpdateMessage, DescentUpdateMessage, DescentUpdateNonAssetMessage, MessageBus } from "../messageBus/baseClasses"

import { unique } from "@tonylb/mtw-utilities/dist/lists"
import { ephemeraDB } from "@tonylb/mtw-utilities/dist/dynamoDB"
import { deepEqual } from "@tonylb/mtw-utilities/dist/objects"
import internalCache from "../internalCache"
import { compareEdges } from "../internalCache/dependencyGraph"
import { DependencyEdge, DependencyNode, isLegalDependencyTag, LegalDependencyTag } from "../internalCache/baseClasses"
import { splitType } from "@tonylb/mtw-utilities/dist/types"

const tagFromEphemeraId = (EphemeraId: string): ('Asset' | LegalDependencyTag) => {
    const [upperTag] = splitType(EphemeraId)
    const tag = `${upperTag[0].toUpperCase()}${upperTag.slice(1).toLowerCase()}`
    if (isLegalDependencyTag(tag) || tag === 'Asset') {
        return tag
    }
    else {
        throw new Error(`Invalid dependency tag: ${tag}`)
    }
}

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

export const dependentUpdateMessage = (dependencyTag: 'Descent' | 'Ancestry') => async ({ payloads, messageBus }: { payloads: ({ type: 'DescentUpdate' | 'AncestryUpdate' } & DependencyUpdateMessage)[]; messageBus: MessageBus }): Promise<void> => {
    const updatingNodes = unique(payloads.map(({ targetId }) => ([
        targetId,
        ...(internalCache[dependencyTag].getPartial(targetId).map(({ EphemeraId }) => (EphemeraId)))
    ])))
    const workablePayload = ({ putItem, deleteItem }: DependencyUpdateMessage) => (!updatingNodes.includes(putItem?.EphemeraId ?? deleteItem?.EphemeraId ?? ''))
    const payloadsByTarget = payloads
        .filter(workablePayload)
        .reduce<Record<string, DependencyUpdateMessage[]>>((previous, { targetId, ...rest }) => ({
            ...previous,
            [targetId]: [
                ...(previous[targetId] || []),
                { targetId, ...rest }
            ]
        }), {})
    const unworkablePayloads = payloads.filter((payload) => (!workablePayload(payload)))

    unworkablePayloads.forEach((payload) => {
        messageBus.send({
            ...payload
        })
    })

    await Promise.all(Object.entries(payloadsByTarget).map(async ([targetId, payloadList]) => {
        const tag = tagFromEphemeraId(targetId)
        //
        // Because we only update the Descent (and need the Ancestry's unchanged value), we run getItem and update
        // in parallel rather than suffer the hit for requesting ALL_NEW ReturnValue
        //
        const [antidependency, dependencyMap] = await Promise.all([
            getAntiDependency(dependencyTag)(targetId),
            (async () => {
                const fetchDependents = await Promise.all(payloadList.map(async (payload) => {
                    if (payload.putItem) {
                        //
                        // TODO: Figure out how to use eventually-consistent reads, and then do a
                        // transactional lock to check that they haven't been changed as part of the
                        // update, rather than depend upon consistent reads:  May get better performance.
                        //
                        const fetchValue = (await ephemeraDB.getItem<{ Ancestry?: DependencyNode[]; Descent?: DependencyNode[] }>({
                            EphemeraId: payload.putItem.EphemeraId,
                            DataCategory: `Meta::${tagFromEphemeraId(payload.putItem.EphemeraId)}`,
                            ProjectionFields: [dependencyTag],
                            ConsistentRead: true
                        })) || {}
                        return { [payload.putItem.EphemeraId]: fetchValue?.[dependencyTag] || [] }
                    }
                    else {
                        return {}
                    }
                }))
                return Object.assign({}, ...fetchDependents) as Record<string, DependencyNode>
            })()
        ])
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
                payloadList.forEach((payloadItem) => {
                    const { putItem, deleteItem } = payloadItem
                    if (putItem) {
                        let alreadyFound = false
                        draft[dependencyTag].forEach((dependentItem) => {
                            if (compareEdges(dependentItem, putItem)) {
                                alreadyFound = true
                                if (!deepEqual(dependentItem.connections, dependencyMap[putItem.EphemeraId])) {
                                    dependentItem.connections = dependencyMap[putItem.EphemeraId]
                                }
                                dependentItem.assets = unique(dependentItem.assets || [], putItem.assets)
                            }
                        })
                        if (!alreadyFound) {
                            draft[dependencyTag].push({
                                ...putItem,
                                connections: dependencyMap[putItem.EphemeraId]
                            })
                        }
                    }
                    if (deleteItem) {
                        draft[dependencyTag].forEach((dependentItem) => {
                            if (compareEdges(dependentItem, deleteItem)) {
                                dependentItem.assets = dependentItem.assets.filter((check) => (!(deleteItem.assets.includes(check))))
                            }
                        })
                        draft[dependencyTag] = draft[dependencyTag].filter(({ assets }) => (assets.length > 0))
                    }
                })
            }
        })
        antidependency.forEach((antiDependentItem) => {
            messageBus.send({
                type: `${dependencyTag}Update`,
                targetId: antiDependentItem.EphemeraId,
                putItem: {
                    key: antiDependentItem.key,
                    EphemeraId: targetId,
                    assets: antiDependentItem.assets
                }
            })    
        })
    }))
}

export default dependentUpdateMessage
