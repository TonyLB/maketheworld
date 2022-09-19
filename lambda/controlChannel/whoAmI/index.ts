import { WhoAmIMessage, MessageBus } from "../messageBus/baseClasses"
import { ephemeraDB } from "@tonylb/mtw-utilities/dist/dynamoDB"

import internalCache from '../internalCache'
import { EventBridgeUpdatePlayerAsset, EventBridgeUpdatePlayerCharacter } from "@tonylb/mtw-interfaces/dist/eventBridge"

export const whoAmIMessage = async ({ payloads, messageBus }: { payloads: WhoAmIMessage[], messageBus: MessageBus }): Promise<void> => {

    const username = await internalCache.Global.get('player')
    if (username) {
        const { Characters = [], Assets = [] } = (await ephemeraDB.getItem<{ Characters: EventBridgeUpdatePlayerCharacter[], Assets: EventBridgeUpdatePlayerAsset[] }>({
                EphemeraId: `PLAYER#${username}`,
                DataCategory: 'Meta::Player',
                ProjectionFields: ['Characters', 'Assets']
            })) || {}
        const RequestId = await internalCache.Global.get('RequestId')
        messageBus.send({
            type: 'ReturnValue',
            body: {
                messageType: 'Player',
                PlayerName: username,
                Assets,
                Characters,
                CodeOfConductConsent: false,
                RequestId
            }
        })
    }
    else {
        messageBus.send({
            type: 'ReturnValue',
            body: { messageType: 'Error' }
        })
    }
}

export default whoAmIMessage
