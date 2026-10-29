import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type {
    EphemeraCrossingPort,
    EphemeraLudicBindingAddress,
    EphemeraLudicCrossingPortAddress,
    EphemeraLudicPortAddress,
} from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { isEphemeraLudicBindingAddress, isEphemeraLudicCrossingPortAddress } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

// Type-level checks for the terminal kinds (`EphemeraCrossingPortId`). They live in ephemera because its
// ts-jest type-checks tests; a stale `@ts-expect-error` fails this suite.

const owner = 'OBJECT#Rope' as EphemeraObjectId

describe('the two address kinds are disjoint types', () => {
    it('keeps the binding kind after a failed crossing check, and the crossing kind after a failed binding check', () => {
        const bindingOf = (address: EphemeraLudicPortAddress): EphemeraLudicBindingAddress | undefined => {
            if (isEphemeraLudicCrossingPortAddress(address)) {
                return undefined
            }
            return address
        }
        const crossingOf = (address: EphemeraLudicPortAddress): EphemeraLudicCrossingPortAddress | undefined => {
            if (isEphemeraLudicBindingAddress(address)) {
                return undefined
            }
            return address
        }
        expect(bindingOf({ owner, port: 'PRESENCE#a' })).toEqual({ owner, port: 'PRESENCE#a' })
        expect(crossingOf({ owner, port: 'PORT-a' })).toEqual({ owner, port: 'PORT-a' })
    })

    it('refuses a binding id on a crossing address, and an unprefixed id on a crossing port record', () => {
        // @ts-expect-error a binding's PRESENCE# id is not a crossing port id
        const crossing: EphemeraLudicCrossingPortAddress = { owner, port: 'PRESENCE#a' }
        // @ts-expect-error a crossing port id carries the PORT- (or STUB-) prefix
        const port: EphemeraCrossingPort = { portId: 'ab6129d', fromHostId: owner, kind: 'ConnectedTo' }
        expect([crossing, port]).toHaveLength(2)
    })
})
