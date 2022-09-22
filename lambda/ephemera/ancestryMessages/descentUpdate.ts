import { DependencyNode, DescentUpdateMessage, MessageBus } from "../messageBus/baseClasses"

import internalCache from '../internalCache'

import { unique } from "@tonylb/mtw-utilities/dist/lists"
import messageBus from "../messageBus"
import { ephemeraDB } from "@tonylb/mtw-utilities/dist/dynamoDB"
import { splitType } from "@tonylb/mtw-utilities/dist/types"

export const descentUpdateMessage = async ({ payloads }: { payloads: DescentUpdateMessage[], messageBus?: MessageBus }): Promise<void> => {
    const updatingNodes = unique(payloads.map(({ targetId }) => (targetId)))
    const workablePayload = ({ putItem, deleteItem }: DescentUpdateMessage) => (!updatingNodes.includes(putItem?.EphemeraId ?? deleteItem?.EphemeraId ?? ''))
    const payloadsByTarget = payloads
        .filter(workablePayload)
        .reduce<Record<string, DescentUpdateMessage[]>>((previous, { targetId, ...rest }) => ({
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
        // Because we only update the Descent (and need the Ancestry's unchanged value), we run getItem and update
        // in parallel rather than suffer the hit for requesting ALL_NEW ReturnValue
        //
        const [ancestry, descentMap] = await Promise.all([
            ephemeraDB.getItem<{ Ancestry: DependencyNode[] }>({
                EphemeraId: targetId,
                DataCategory: `Meta::${tag}`,
                ProjectionFields: ['Ancestry']
            }).then((value) => (value?.Ancestry || [])),
            (async () => {
                const fetchDescents = await Promise.all(payloadList.map(async (payload) => {
                    if (payload.putItem) {
                        const { Descent = [] } = (await ephemeraDB.getItem<{ Descent: DependencyNode[] }>({
                            EphemeraId: payload.putItem.EphemeraId,
                            DataCategory: `Meta::${payload.putItem.tag}`,
                            ProjectionFields: ['Descent']
                        })) || {}
                        return { [payload.putItem.EphemeraId]: Descent }
                    }
                    else {
                        return {}
                    }
                }))
                return Object.assign({}, ...fetchDescents) as Record<string, DependencyNode>
            })()
        ])
        await ephemeraDB.optimisticUpdate({
            key: {
                EphemeraId: targetId,
                DataCategory: `Meta::${tag}`
            },
            updateKeys: ['Descent'],
            updateReducer: (draft) => {
                payloadList.forEach(({ putItem, deleteItem }) => {
                    if (putItem) {
                        draft.Descent = [
                            ...(draft.Descent.filter(({ EphemeraId }) => (EphemeraId !== putItem.EphemeraId))),
                            {
                                ...putItem,
                                connections: descentMap[putItem.EphemeraId]
                            }
                        ]
                    }
                    if (deleteItem) {
                        draft.Descent = draft.Descent.filter(({ EphemeraId }) => (EphemeraId !== deleteItem.EphemeraId))
                    }
                })
            }
        })
        ancestry.forEach(({ EphemeraId, key }) => {
            messageBus.send({
                type: 'DescentUpdate',
                targetId: EphemeraId,
                putItem: {
                    tag,
                    key,
                    EphemeraId: targetId
                }
            })
        })
    }))
}

export default descentUpdateMessage
