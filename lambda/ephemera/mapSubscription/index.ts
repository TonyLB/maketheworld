import { MapSubscriptionMessage, MapUnsubscribeMessage, MessageBus } from "../messageBus/baseClasses"
import { connectionDB, META_SESSION_PK, sessionMetaSortKey } from "@tonylb/mtw-utilities/ts/dynamoDB"

import internalCache from '../internalCache'
import { EphemeraCharacterId } from "@tonylb/mtw-interfaces/ts/baseClasses"
import { emptyMapSnapshotForCharacter } from '../dataSource/maps/stub'

export const mapSubscriptionMessage = async ({ payloads, messageBus }: { payloads: MapSubscriptionMessage[], messageBus: MessageBus }): Promise<void> => {

    const [RequestId, sessionId] = await Promise.all([
        internalCache.Global.get('RequestId'),
        internalCache.Global.get('SessionId')
    ])

    if (sessionId) {
        const checkCharactersFetch = await connectionDB.getItems({
            Keys: payloads.map(({ characterId }) => ({
                ConnectionId: `SESSION#${sessionId}`,
                DataCategory: characterId
            })),
            ProjectionFields: ['DataCategory']
        })
        const checkCharacters = checkCharactersFetch
            .filter((value): value is { DataCategory: EphemeraCharacterId } => (typeof value !== 'undefined'))
            .map(({ DataCategory }) => (DataCategory))
        const validCharacters = payloads
            .map(({ characterId }) => (characterId))
            .filter((characterId) => (checkCharacters.includes(characterId)))
        const sessionIsValid = await connectionDB.getItem({
            Key: {
                ConnectionId: META_SESSION_PK,
                DataCategory: sessionMetaSortKey(sessionId)
            },
            ProjectionFields: ['DataCategory']
        })

        if (sessionIsValid && validCharacters.length) {
            const snapshots = validCharacters.map((characterId) => (emptyMapSnapshotForCharacter(characterId)))
            messageBus.publish({
                type: 'ReturnValue',
                body: {
                    messageType: 'SubscribeToMaps',
                    RequestId,
                    maps: snapshots
                }
            })
        }
        else {
            messageBus.publish({
                type: 'ReturnValue',
                body: {
                    messageType: 'Error',
                    message: 'Map Subscription Failed',
                    RequestId
                }
            })
        }

    }
    else {
        messageBus.publish({
            type: 'ReturnValue',
            body: {
                messageType: 'Error',
                message: 'Map Subscription Failed',
                RequestId
            }
        })
    }

}

export const mapUnsubscribeMessage = async ({ payloads, messageBus }: { payloads: MapUnsubscribeMessage[], messageBus: MessageBus }): Promise<void> => {
    const RequestId = await internalCache.Global.get('RequestId')
    void payloads
    messageBus.publish({
        type: 'ReturnValue',
        body: {
            messageType: 'UnsubscribeFromMaps',
            RequestId
        }
    })

}

export default mapSubscriptionMessage
