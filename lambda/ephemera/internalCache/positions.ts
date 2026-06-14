/**
 * Request-scoped memo of play position graphs via mtw-gateways PositionsCacheHandler.
 */
import {
    PositionsCacheHandler,
    createPositionsCacheHandler,
    type PositionsCacheSetParams,
} from '@tonylb/mtw-gateways/ts/ephemera/positions'
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'

export type { PositionsCacheSetParams }

export class PositionsData extends PositionsCacheHandler {
    constructor() {
        super(ephemeraDB)
    }
}

export const createPositionsData = (): PositionsData => new PositionsData()

export { createPositionsCacheHandler, PositionsCacheHandler }
