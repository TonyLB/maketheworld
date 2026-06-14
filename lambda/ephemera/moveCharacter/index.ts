import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { PositionsPublishedPayload } from '../dataSource/positions/publishedEvents'
import { MoveCharacterMessage, MessageBus } from "../messageBus/baseClasses"
import { executeCharacterNavigate } from "./executeCharacterNavigate"

export type { RoomStackItem } from '../dataSource/positions/membership/types'

const getPositionsStreamEvent = (): StreamEventFunction<PositionsPublishedPayload> => {
    // Lazy load: moveCharacter is registered on messageBus at module init; a top-level
    // import of positions/index would cycle messageBus -> moveCharacter -> positions -> messageBus.
    const { default: ephemeraPositionsDataSource } = require('../dataSource/positions') as {
        default: { streamEvent: StreamEventFunction<PositionsPublishedPayload> };
    }
    return ephemeraPositionsDataSource.streamEvent.bind(ephemeraPositionsDataSource)
}

export const moveCharacter = async ({ payloads, messageBus }: { payloads: MoveCharacterMessage[], messageBus: MessageBus }): Promise<void> => {
    const streamEvent = getPositionsStreamEvent()
    await Promise.all(payloads.map(async (payload) => {
        const { characterId, roomId, ...rest } = payload
        await executeCharacterNavigate({
            characterId,
            targetRoomId: roomId,
            messageBus,
            streamEvent,
            payload: rest,
        })
    }))
}

export default moveCharacter
