import { DependencyNode, DescentUpdateMessage, MessageBus } from "../messageBus/baseClasses"

import internalCache from '../internalCache'

import { unique } from "@tonylb/mtw-utilities/dist/lists"
import messageBus from "../messageBus"
import { ephemeraDB } from "@tonylb/mtw-utilities/dist/dynamoDB"
import { splitType } from "@tonylb/mtw-utilities/dist/types"

export const descentUpdateMessage = async ({ payloads }: { payloads: DescentUpdateMessage[], messageBus?: MessageBus }): Promise<void> => {
    const updatingNodes = unique(payloads.map(({ putItem, deleteItem }) => (putItem?.EphemeraId || deleteItem?.EphemeraId || '')))
    const workablePayload = ({ targetId }: DescentUpdateMessage) => (!updatingNodes.includes(targetId))
    const workablePayloads = payloads.filter(workablePayload)
    const unworkablePayloads = payloads.filter((payload) => (!workablePayload(payload)))

    unworkablePayloads.forEach((payload) => {
        messageBus.send(payload)
    })

    await Promise.all(workablePayloads.map(async (payload) => {
        const { targetId, putItem, deleteItem } = payload
        const [targetTag] = splitType(targetId)
        const tag = `${targetTag[0].toUpperCase()}${targetTag.slice(1).toLowerCase()}` as DependencyNode["tag"]
        let updatedDescent = []
        //
        // Because we only update the Descent (and need the Ancestry's unchanged value), we run getItem and update
        // in parallel rather than suffer the hit for requesting ALL_NEW ReturnValue
        //
        const [ancestry] = await Promise.all([
            ephemeraDB.getItem<{ Ancestry: DependencyNode[] }>({
                EphemeraId: targetId,
                DataCategory: `Meta::${tag}`,
                ProjectionFields: ['Ancestry']
            }).then((value) => (value?.Ancestry || [])),
            ephemeraDB.optimisticUpdate({
                key: {
                    EphemeraId: targetId,
                    DataCategory: `Meta::${tag}`
                },
                updateKeys: ['Descent'],
                updateReducer: (draft) => {
                    if (putItem) {
                        draft.Descent = [
                            ...(draft.Descent.filter(({ EphemeraId }) => (EphemeraId !== putItem.EphemeraId))),
                            putItem
                        ]
                    }
                    if (deleteItem) {
                        draft.Descent = draft.Descent.filter(({ EphemeraId }) => (EphemeraId !== deleteItem.EphemeraId))
                    }
                    updatedDescent = draft.Descent
                }
            })
        ])
        ancestry.forEach(({ EphemeraId, key }) => {
            messageBus.send({
                type: 'DescentUpdate',
                targetId: EphemeraId,
                putItem: {
                    tag,
                    key,
                    EphemeraId: targetId,
                    connections: updatedDescent
                }
            })
        })
    }))
}

export default descentUpdateMessage
