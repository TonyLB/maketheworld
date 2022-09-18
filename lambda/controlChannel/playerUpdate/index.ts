import { MessageBus, PlayerUpdateMessage } from "../messageBus/baseClasses"
import { ephemeraDB } from "@tonylb/mtw-utilities/dist/dynamoDB"

export const playerUpdateMessage = async ({ payloads }: { payloads: PlayerUpdateMessage[], messageBus?: MessageBus }): Promise<void> => {
    await Promise.all(payloads
        .filter(({ player }) => (player))
        .map(async ({ player, Characters = [], Assets = [] }) => {
            await ephemeraDB.optimisticUpdate({
                key: {
                    EphemeraId: `PLAYER#${player}`,
                    DataCategory: 'Meta::Player'
                },
                updateKeys: ['Characters', 'Assets'],
                updateReducer: (draft) => {
                    draft.Characters = Characters
                    draft.Assets = Assets
                }
            })
        })
    )
}

export default playerUpdateMessage
