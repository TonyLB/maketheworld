import { DependencyNode, AncestryUpdateMessage, MessageBus, AncestryUpdateNonAssetMessage } from "../messageBus/baseClasses"

import { unique } from "@tonylb/mtw-utilities/dist/lists"
import messageBus from "../messageBus"
import { ephemeraDB } from "@tonylb/mtw-utilities/dist/dynamoDB"
import { splitType } from "@tonylb/mtw-utilities/dist/types"

export const ancestryUpdateMessage = async ({ payloads }: { payloads: AncestryUpdateMessage[], messageBus?: MessageBus }): Promise<void> => {
    const updatingNodes = unique(payloads.map(({ targetId }) => (targetId)))
    const workablePayload = ({ putItem, deleteItem }: AncestryUpdateMessage) => (!updatingNodes.includes(putItem?.EphemeraId ?? deleteItem?.EphemeraId ?? ''))
    const payloadsByTarget = payloads
        .filter(workablePayload)
        .reduce<Record<string, AncestryUpdateMessage[]>>((previous, { targetId, ...rest }) => ({
            ...previous,
            [targetId]: [
                ...(previous[targetId] || []),
                { targetId, ...rest }
            ]
        }), {})
    const unworkablePayloads = payloads.filter((payload) => (!workablePayload(payload)))

    unworkablePayloads.forEach((payload) => {
        messageBus.send(payload)
    })

    await Promise.all(Object.entries(payloadsByTarget).map(async ([targetId, payloadList]) => {
        const [targetTag] = splitType(targetId)
        const tag = `${targetTag[0].toUpperCase()}${targetTag.slice(1).toLowerCase()}` as DependencyNode["tag"]
        //
        // Because we only update the Ancestry (and need the Decsent's unchanged value), we run getItem and update
        // in parallel rather than suffer the hit for requesting ALL_NEW ReturnValue
        //
        const [descent, ancestryMap] = await Promise.all([
            ephemeraDB.getItem<{ Descent: DependencyNode[] }>({
                EphemeraId: targetId,
                DataCategory: `Meta::${tag}`,
                ProjectionFields: ['Descent']
            }).then((value) => (value?.Descent || [])),
            (async () => {
                const fetchAncestries = await Promise.all(payloadList.map(async (payload) => {
                    if (payload.putItem) {
                        const { Ancestry = [] } = (await ephemeraDB.getItem<{ Ancestry: DependencyNode[] }>({
                            EphemeraId: payload.putItem.EphemeraId,
                            DataCategory: `Meta::${payload.tag}`,
                            ProjectionFields: ['Ancestry']
                        })) || {}
                        return { [payload.putItem.EphemeraId]: Ancestry }
                    }
                    else {
                        return {}
                    }
                }))
                return Object.assign({}, ...fetchAncestries) as Record<string, DependencyNode>
            })()
        ])
        await ephemeraDB.optimisticUpdate({
            key: {
                EphemeraId: targetId,
                DataCategory: `Meta::${tag}`
            },
            updateKeys: ['Ancestry'],
            updateReducer: (draft) => {
                payloadList.forEach((payloadItem) => {
                    const { putItem, deleteItem } = payloadItem
                    if (putItem) {
                        let alreadyFound = false
                        draft.Ancestry.forEach((ancestryItem) => {
                            if (ancestryItem.EphemeraId === putItem.EphemeraId) {
                                alreadyFound = true
                                ancestryItem.connections = ancestryMap[putItem.EphemeraId]
                                if (payloadItem.tag !== 'Asset') {
                                    ancestryItem.assets = unique(ancestryItem.assets || [], [payloadItem.assetId])
                                }
                            }
                        })
                        if (!alreadyFound) {
                            draft.Ancestry.push({
                                ...putItem,
                                tag: payloadItem.tag,
                                ...(payloadItem.tag === 'Asset' ? {} : { assets: [payloadItem.assetId] }),
                                connections: ancestryMap[putItem.EphemeraId]
                            })
                        }
                    }
                    if (deleteItem) {
                        if (payloadItem.tag === 'Asset') {
                            draft.Ancestry = draft.Ancestry.filter(({ EphemeraId }) => (EphemeraId !== deleteItem.EphemeraId))
                        }
                        else {
                            draft.Ancestry.forEach((descentItem) => {
                                descentItem.assets = descentItem.assets.filter((check) => (check !== payloadItem.assetId))
                            })
                            draft.Ancestry = draft.Descent.filter(({ assets }) => (assets.length === 0))
                        }
                    }
                })
            }
        })
        descent.forEach((descentItem) => {
            if (tag === 'Asset') {
                messageBus.send({
                    type: 'AncestryUpdate',
                    targetId: descentItem.EphemeraId,
                    tag, // Assets can only have asset children tags
                    putItem: {
                        EphemeraId: targetId
                    }
                })
            }
            else {
                if (descentItem.tag !== 'Asset') {
                    const assets = unique(payloadList.filter((prop): prop is AncestryUpdateNonAssetMessage => (prop.tag !== 'Asset')).map(({ assetId }) => (assetId))) as string[]
                    assets.forEach((assetId) => {
                        messageBus.send({
                            type: 'AncestryUpdate',
                            targetId: descentItem.EphemeraId,
                            assetId,
                            tag,
                            putItem: {
                                key: descentItem.key,
                                EphemeraId: targetId
                            }
                        })    
                    })
                }
            }
        })
    }))
}

export default ancestryUpdateMessage
