import { WhoAmIMessage, MessageBus } from "../messageBus/baseClasses"
import { assetDB } from "@tonylb/mtw-utilities/dist/dynamoDB"
import { generatePersonalAssetLibrary } from '@tonylb/mtw-utilities/dist/selfHealing/index.js'

import internalCache from '../internalCache'

export const whoAmIMessage = async ({ payloads, messageBus }: { payloads: WhoAmIMessage[], messageBus: MessageBus }): Promise<void> => {

    const username = await internalCache.get({ category: 'CurrentPlayerMeta', key: 'player' })
    if (username) {
        const [{ CodeOfConductConsent = false } = {}, { Characters = [], Assets = [] }] = await Promise.all([
            assetDB.getItem<{ CodeOfConductConsent: boolean }>({
                AssetId: `PLAYER#${username}`,
                DataCategory: 'Meta::Player',
                ProjectionFields: ['CodeOfConductConsent']
            }),
            generatePersonalAssetLibrary(username)
        ])
        const RequestId = await internalCache.get({ category: 'Global', key: 'RequestId' })
        messageBus.send({
            type: 'ReturnValue',
            body: {
                messageType: 'Player',
                PlayerName: username,
                Assets,
                Characters,
                CodeOfConductConsent,
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
