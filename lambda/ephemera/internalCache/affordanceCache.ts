/**
 * Request-scoped memo of affordance-topology Dynamo rows via mtw-gateways AffordanceCacheCacheHandler.
 */
import {
    AffordanceCacheCacheHandler,
    createAffordanceCacheCacheHandler,
    type AffordanceCacheSetParams,
} from '@tonylb/mtw-gateways/ts/ephemera/affordanceCache'
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'

export type { AffordanceCacheSetParams }

export class AffordanceCacheData extends AffordanceCacheCacheHandler {
    constructor() {
        super(ephemeraDB)
    }
}

export const createAffordanceCacheData = (): AffordanceCacheData => new AffordanceCacheData()

/** @deprecated Prefer AffordanceCacheData; factory alias for package parity. */
export { createAffordanceCacheCacheHandler, AffordanceCacheCacheHandler }
