/**
 * Connect/disconnect handler for the `mtw.ephemera.positions` lane.
 *
 * Owns the ephemera-side projection of character presence transitions emitted
 * by `mtw.connections.characters`:
 *   - Character Connected   -> trigger CheckLocation(forceMove) so moveCharacter
 *                              runs the room.activeCharacters add and arrival
 *                              messaging through the existing flow.
 *   - Character Disconnected -> conditional Meta::Room.activeCharacters projection;
 *                               when the character is actually removed (idempotency
 *                               gate), publish departure WorldMessage + RoomUpdate.
 *
 * At-least-once delivery: duplicate events are no-ops because the second
 * disconnect projection finds nothing to remove and the second connect
 * CheckLocation/moveCharacter sees the character already in the target room.
 */
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import {
    ConnectionsCharactersConnectedEvent,
    ConnectionsCharactersDisconnectedEvent
} from '@tonylb/mtw-interfaces/ts/eventBridge/connections/characters'
import internalCache from '../../internalCache'
import type { MessageBus } from '../../messageBus/baseClasses'

export const handleCharacterConnected = async (
    event: ConnectionsCharactersConnectedEvent,
    { messageBus }: { messageBus: MessageBus }
): Promise<void> => {
    messageBus.send({
        type: 'CheckLocation',
        characterId: event.characterId,
        forceMove: true,
        arriveMessage: ' has connected.',
        suppressArrival: false
    })
}

export const handleCharacterDisconnected = async (
    event: ConnectionsCharactersDisconnectedEvent,
    { messageBus }: { messageBus: MessageBus }
): Promise<void> => {
    const meta = await internalCache.CharacterMeta.get(event.characterId)
    const RoomId = meta?.RoomId
    const Name = meta?.Name
    if (!RoomId) {
        return
    }

    let removed = false
    await ephemeraDB.optimisticUpdate({
        Key: {
            EphemeraId: RoomId,
            DataCategory: 'Meta::Room'
        },
        updateKeys: ['activeCharacters'],
        updateReducer: (draft) => {
            const before = (draft.activeCharacters as { EphemeraId: string }[]) ?? []
            const after = before.filter(({ EphemeraId }) => (EphemeraId !== event.characterId))
            if (after.length !== before.length) {
                removed = true
            }
            draft.activeCharacters = after
        },
        successCallback: ({ activeCharacters }) => {
            internalCache.ComponentEphemeraMeta.invalidate(RoomId)
            internalCache.AffordanceRoomDeliverable.invalidate(RoomId)
            internalCache.RoomCharacterList.set({ key: RoomId, value: activeCharacters ?? [] })
            if (removed) {
                messageBus.send({
                    type: 'PublishMessage',
                    targets: [RoomId, `!${event.characterId}`],
                    displayProtocol: 'WorldMessage',
                    message: [`${Name || 'Someone'} has disconnected.`]
                })
                messageBus.send({
                    type: 'RoomUpdate',
                    roomId: RoomId
                })
            }
        }
    })
}
