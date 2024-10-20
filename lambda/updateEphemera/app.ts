import { ephemeraDB } from '@tonylb/mtw-utilities/dist/dynamoDB'
import { EventBridgeUpdatePlayerCharacter, EventBridgeUpdatePlayerAsset } from '@tonylb/mtw-interfaces/ts/eventBridge'

type PlayerUpdate = {
    Characters: EventBridgeUpdatePlayerCharacter[];
    Assets: EventBridgeUpdatePlayerAsset[];
    guestName?: string;
    guestId?: string;
}

export const handler = async (event) => {

    switch(event.type) {
        case 'Player':
            const { guestId: retrievedGuestId } = (await ephemeraDB.optimisticUpdate<{ EphemeraId: string, DataCategory: string } & PlayerUpdate>({
                Key: {
                    EphemeraId: `PLAYER#${event.player}`,
                    DataCategory: 'Meta::Player'
                },
                updateKeys: ['Characters', 'Assets', 'guestName', 'guestId'],
                updateReducer: (draft) => {
                    draft.Characters = event.Characters
                    draft.Assets = event.Assets
                    draft.guestName = event.guestName
                    draft.guestId = event.guestId
                },
                ReturnValues: 'ALL_NEW'
            })) || {}
            if (retrievedGuestId) {
                await ephemeraDB.optimisticUpdate({
                    Key: {
                        EphemeraId: `CHARACTER#${retrievedGuestId}`,
                        DataCategory: 'Meta::Character'
                    },
                    updateKeys: ['assets', 'Color', 'FirstImpression', 'Name', 'OneCoolThing', 'player', 'pronouns', 'RoomId'],
                    updateReducer: (draft) => {
                        draft.assets = event.Assets.map(({ AssetId }) => (AssetId))
                        draft.Color = 'pink'
                        draft.FirstImpression = 'Friendly Tourist'
                        draft.Name = event.guestName
                        draft.OneCoolThing = 'Enthusiastic Curiosity'
                        draft.player = event.player
                        draft.pronouns = {
                            subject: 'they',
                            object: 'them',
                            adjective: 'theirs',
                            possessive: 'their',
                            reflexive: 'themself'
                        }
                        if (!draft.RoomId) {
                            draft.RoomId = 'VORTEX'
                        }
                    }
                })
            }
    }
}
