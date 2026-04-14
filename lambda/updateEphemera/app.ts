import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { EventBridgeUpdatePlayerCharacter, EventBridgeUpdatePlayerAsset } from '@tonylb/mtw-interfaces/ts/eventBridge'
import { coyoteGameEnabled } from '@tonylb/mtw-base/ts/coyoteGame'

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
                    updateKeys: ['assets', 'Color', 'Name', 'player', 'pronouns', 'RoomId', 'Description'],
                    updateReducer: (draft) => {
                        draft.assets = event.Assets.map(({ AssetId }) => (AssetId))
                        draft.Color = 'pink'
                        draft.Name = coyoteGameEnabled ? event.player : event.guestName
                        draft.player = event.player
                        draft.pronouns = 'they/them'
                        if (coyoteGameEnabled) {
                            draft.Description = 'A scraggly coyote with a hungry and cunning look in his eye.'
                        }
                        if (!draft.RoomId) {
                            draft.RoomId = 'VORTEX'
                        }
                    }
                })
            }
    }
}
