import { MessageBus, PlayerUpdateMessage } from "../messageBus/baseClasses"
import { ephemeraDB } from "@tonylb/mtw-utilities/dist/dynamoDB"

export const playerUpdateMessage = async ({ payloads }: { payloads: PlayerUpdateMessage[], messageBus?: MessageBus }): Promise<void> => {
    await Promise.all(payloads
        .filter(({ player }) => (player))
        .map(async ({ player, Characters = [], Assets = [], guestName, guestId }) => {
            const { guestId: retrievedGuestId } = await ephemeraDB.optimisticUpdate({
                key: {
                    EphemeraId: `PLAYER#${player}`,
                    DataCategory: 'Meta::Player'
                },
                updateKeys: ['Characters', 'Assets', 'guestName', 'guestId'],
                updateReducer: (draft) => {
                    draft.Characters = Characters
                    draft.Assets = Assets
                    draft.guestName = guestName
                    draft.guestId = guestId
                },
                ReturnValues: 'ALL_NEW'
            })
            if (retrievedGuestId) {
                await ephemeraDB.optimisticUpdate({
                    key: {
                        EphemeraId: `CHARACTER#${retrievedGuestId}`,
                        DataCategory: 'Meta::Character'
                    },
                    updateKeys: ['assets'],
                    updateReducer: (draft) => {
                        draft.assets = Assets.map(({ AssetId }) => (AssetId))
                    }
                })
            }
        })
    )
}

export default playerUpdateMessage
