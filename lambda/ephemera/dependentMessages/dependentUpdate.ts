import { AncestryUpdateNonAssetMessage, DependencyNode, DependencyUpdateMessage, DescentUpdateMessage, DescentUpdateNonAssetMessage, MessageBus } from "../messageBus/baseClasses"

import { unique } from "@tonylb/mtw-utilities/dist/lists"
import { ephemeraDB } from "@tonylb/mtw-utilities/dist/dynamoDB"
import { splitType } from "@tonylb/mtw-utilities/dist/types"

export const dependentUpdateMessage = (dependencyTag: 'Descent' | 'Ancestry') => async ({ payloads, messageBus }: { payloads: ({ type: 'DescentUpdate' | 'AncestryUpdate' } & DependencyUpdateMessage)[]; messageBus: MessageBus }): Promise<void> => {
    const antiDependencyTag = dependencyTag === 'Descent' ? 'Ancestry' : 'Descent'
    const updatingNodes = unique(payloads.map(({ targetId }) => (targetId)))
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
        const [targetTag] = splitType(targetId)
        const tag = `${targetTag[0].toUpperCase()}${targetTag.slice(1).toLowerCase()}` as DependencyNode["tag"]
        //
        // Because we only update the Descent (and need the Ancestry's unchanged value), we run getItem and update
        // in parallel rather than suffer the hit for requesting ALL_NEW ReturnValue
        //
        const [antidependency, dependencyMap] = await Promise.all([
            ephemeraDB.getItem<{ Ancestry?: DependencyNode[]; Descent?: DependencyNode[]; }>({
                EphemeraId: targetId,
                DataCategory: `Meta::${tag}`,
                ProjectionFields: [antiDependencyTag]
            }).then((value) => (value?.[antiDependencyTag] || [])),
            (async () => {
                const fetchDependents = await Promise.all(payloadList.map(async (payload) => {
                    if (payload.putItem) {
                        const fetchValue = (await ephemeraDB.getItem<{ Ancestry?: DependencyNode[]; Descent?: DependencyNode[] }>({
                            EphemeraId: payload.putItem.EphemeraId,
                            DataCategory: `Meta::${payload.tag}`,
                            ProjectionFields: [dependencyTag]
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
            updateKeys: [dependencyTag],
            updateReducer: (draft) => {
                payloadList.forEach((payloadItem) => {
                    const compareDependentItems = ({ key: keyA, EphemeraId: EphemeraA }: { key?: string; EphemeraId: string; }, { key: keyB, EphemeraId: EphemeraB }: { key?: string; EphemeraId: string; }) => {
                        if (EphemeraA !== EphemeraB) {
                            return false
                        }
                        if (payloadItem.tag === 'Asset') {
                            return true
                        }
                        if (keyA === keyB) {
                            return true
                        }
                        if ((typeof keyA === 'undefined') && (typeof keyB === 'undefined')) {
                            return true
                        }
                        return false
                    }
                    const { putItem, deleteItem } = payloadItem
                    if (putItem) {
                        let alreadyFound = false
                        draft[dependencyTag].forEach((dependentItem) => {
                            if (compareDependentItems(dependentItem, putItem)) {
                                alreadyFound = true
                                dependentItem.connections = dependencyMap[putItem.EphemeraId]
                                if (payloadItem.tag !== 'Asset') {
                                    dependentItem.assets = unique(dependentItem.assets || [], [payloadItem.assetId])
                                }
                            }
                        })
                        if (!alreadyFound) {
                            draft[dependencyTag].push({
                                ...putItem,
                                tag: payloadItem.tag,
                                ...(payloadItem.tag === 'Asset' ? {} : { assets: [payloadItem.assetId] }),
                                connections: dependencyMap[putItem.EphemeraId]
                            })
                        }
                    }
                    if (deleteItem) {
                        if (payloadItem.tag === 'Asset') {
                            draft[dependencyTag] = draft[dependencyTag].filter(({ EphemeraId }) => (EphemeraId !== deleteItem.EphemeraId))
                        }
                        else {
                            draft[dependencyTag].forEach((dependentItem) => {
                                if (compareDependentItems(dependentItem, deleteItem)) {
                                    dependentItem.assets = dependentItem.assets.filter((check) => (check !== payloadItem.assetId))
                                }
                            })
                            draft[dependencyTag] = draft[dependencyTag].filter(({ assets }) => (assets.length === 0))    
                        }
                    }
                })
            }
        })
        antidependency.forEach((antiDependentItem) => {
            if (tag === 'Asset') {
                messageBus.send({
                    type: `${dependencyTag}Update`,
                    targetId: antiDependentItem.EphemeraId,
                    tag, // Assets can only have asset children tags
                    putItem: {
                        EphemeraId: targetId
                    }
                })
            }
            else {
                if (antiDependentItem.tag !== 'Asset') {
                    const assets = unique(payloadList.filter((prop): prop is DescentUpdateNonAssetMessage | AncestryUpdateNonAssetMessage => (prop.tag !== 'Asset')).map(({ assetId }) => (assetId))) as string[]
                    assets.forEach((assetId) => {
                        messageBus.send({
                            type: `${dependencyTag}Update`,
                            targetId: antiDependentItem.EphemeraId,
                            assetId,
                            tag,
                            putItem: {
                                key: antiDependentItem.key,
                                EphemeraId: targetId
                            }
                        })    
                    })
                }
            }
        })
    }))
}

export default dependentUpdateMessage
