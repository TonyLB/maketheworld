import { ConnectMessage, MessageBus } from "../messageBus/baseClasses"
import { legacyConnectionDB as connectionDB } from "@tonylb/mtw-utilities/dist/dynamoDB"

import internalCache from '../internalCache'
import { pushCharacterEphemera } from "../cacheAsset";

const confirmGuestCharacter = async ({ characterId, name }: { characterId?: string; name?: string }): Promise<void> => {
    if (!(characterId && name)) {
        return
    }
    await pushCharacterEphemera({
        key: characterId,
        EphemeraId: `CHARACTER#${characterId}`,
        Name: name,
        OneCoolThing: 'Enthusiastic Curiosity',
        FirstImpression: 'Friendly Tourist',
        Color: 'pink',
        Pronouns: {
            subject: 'they',
            object: 'them',
            possessive: 'their',
            adjective: 'theirs',
            reflexive: 'themself'
        },
        assets: [],
        RoomId: 'VORTEX'
    })
}

export const connectMessage = async ({ payloads, messageBus }: { payloads: ConnectMessage[], messageBus: MessageBus }): Promise<void> => {

    const connectionId = await internalCache.Global.get('ConnectionId')

    const payloadLookups = await Promise.all(payloads.map(async ({ userName }) => {
        const { guestId, guestName } = await internalCache.PlayerMeta.get(userName) || {}
        return { userName, guestId, guestName }
    }))
    const lookupByUserName = payloadLookups.reduce((previous, { userName, guestId, guestName }) => ({
        ...previous,
        [userName]: {
            guestId,
            guestName
        }
    }), {})
    if (connectionId) {
        const aggregatePromises = payloads.reduce((previous, payload) => {
            const { guestId, guestName } = lookupByUserName[payload.userName]
            return [
                ...previous,
                //
                // TODO: Check for the existence of needed guest character, and
                // synthesize into the ephemera table if absent
                //
                confirmGuestCharacter({ characterId: guestId, name: guestName }),
                connectionDB.putItem({
                    ConnectionId: `CONNECTION#${connectionId}`,
                    DataCategory: 'Meta::Connection',
                    player: payload.userName
                }),
            ]
        }, [
            connectionDB.optimisticUpdate({
                key: {
                    ConnectionId: 'Global',
                    DataCategory: 'Connections'    
                },
                updateKeys: ['connections'],
                updateReducer: (draft: { connections?: Record<string, string> }) => {
                    payloads.forEach((payload) => {
                        if (draft.connections === undefined) {
                            draft.connections = {}
                        }
                        if (payload.userName) {
                            draft.connections[connectionId] = payload.userName
                        }
                    })
                },
            })
        ] as Promise<any>[])
    
        await Promise.all(aggregatePromises)

        messageBus.send({
            type: 'ReturnValue',
            body: { statusCode: 200 }
        })

    }
    else {
        messageBus.send({
            type: 'ReturnValue',
            body: {
                statusCode: 500,
                message: 'Internal Server Error'
            }
        })
    }

}

export default connectMessage
