/**
 * Request-scoped memo of play position graphs via mtw-gateways PositionsCacheHandler.
 */
import {
    PositionsCacheHandler,
    createPositionsCacheHandler,
    extractCharacterIdsFromPlayPositionGraph,
    type PositionsCacheSetParams,
    type PlayPositionRoomRosterEntry,
} from '@tonylb/mtw-gateways/ts/ephemera/positions'
import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'

import { hydrateRoomRosterFromCharacterIds } from './hydrateRoomRoster'

export type { PositionsCacheSetParams }

export class PositionsData extends PositionsCacheHandler {
    constructor() {
        super(ephemeraDB)
    }

    /**
     * @deprecated Prefer `getRoomCharacterList`; callers should migrate in a follow-up slice (D2).
     */
    override async getRoomRoster(roomId: EphemeraRoomId): Promise<PlayPositionRoomRosterEntry[]> {
        const graph = await this.getPositionGraph(roomId)
        const characterIds = extractCharacterIdsFromPlayPositionGraph(graph)
        return hydrateRoomRosterFromCharacterIds(characterIds)
    }
}

export const createPositionsData = (): PositionsData => new PositionsData()

export { createPositionsCacheHandler, PositionsCacheHandler }
