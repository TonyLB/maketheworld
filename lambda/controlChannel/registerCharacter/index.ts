import { RegisterCharacterMessage, MessageBus } from "../messageBus/baseClasses"
import messageBus from "../messageBus"
import { ephemeraDB, assetDB } from "@tonylb/mtw-utilities/dist/dynamoDB"

import internalCache from '../internalCache'
import { splitType } from "@tonylb/mtw-utilities/dist/types"

export const registerCharacter = async ({ payloads }: { payloads: RegisterCharacterMessage[], messageBus: MessageBus }): Promise<void> => {

    const connectionId = await internalCache.get({ category: 'Global', key: 'ConnectionId' })

    if (connectionId) {
        const RequestId = await internalCache.get({ category: 'Global', key: 'RequestId' })
        const handleOneRegistry = async (payload: RegisterCharacterMessage): Promise<void> => {
            const { characterId: CharacterId } = payload
            const EphemeraId = `CHARACTERINPLAY#${CharacterId}`
            const [{ Name = '', HomeId = '' } = {}, characterQueryItems = []] = await Promise.all([
                assetDB.getItem<{ Name: string; HomeId: string }>({
                    AssetId: `CHARACTER#${CharacterId}`,
                    DataCategory: 'Meta::Character',
                    ProjectionFields: ['#name', 'HomeId'],
                    ExpressionAttributeNames: {
                        '#name': 'Name'
                    }
                }),
                ephemeraDB.query<{ DataCategory: string }[]>({
                    EphemeraId,
                    KeyConditionExpression: 'begins_with(DataCategory, :dc)',
                    ExpressionAttributeValues: {
                        ':dc': 'CONNECTION#'
                    }
                })
            ])
            const ConnectionIds = [...(new Set([
                ...characterQueryItems.map(({ DataCategory }) => (splitType(DataCategory)[1])),
                connectionId
            ]))]
            await Promise.all([
                ephemeraDB.update({
                    EphemeraId,
                    DataCategory: 'Meta::Character',
                    UpdateExpression: 'SET Connected = :true, #name = if_not_exists(#name, :name), RoomId = if_not_exists(RoomId, :roomId), ConnectionIds = :connectionIds',
                    ExpressionAttributeNames: {
                        '#name': 'Name'
                    },
                    ExpressionAttributeValues: {
                        ':true': true,
                        ':name': Name,
                        ':roomId': HomeId || 'VORTEX',
                        ':connectionIds': ConnectionIds
                    }
                }),
                ephemeraDB.putItem({
                    EphemeraId,
                    DataCategory: `CONNECTION#${connectionId}`
                })
            ])
    
        }

        await Promise.all(payloads.map(handleOneRegistry))

        if (payloads.length > 0) {
            messageBus.send({
                type: 'ReturnValue',
                body: {
                    messageType: 'Registration',
                    CharacterId: payloads[0].characterId,
                    RequestId
                }
            })
        }
    }

}

export default registerCharacter
