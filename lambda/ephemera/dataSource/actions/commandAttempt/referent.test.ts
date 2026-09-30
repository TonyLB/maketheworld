import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { buildCommandAttemptReferent } from './referent'

describe('buildCommandAttemptReferent', () => {
    it('round-trips id/shortName/gloss', () => {
        const referent = buildCommandAttemptReferent('primaryObject', 'OBJECT#Rope' as EphemeraObjectId, 'rope', 'a coil of thick hemp rope')
        expect(referent).toEqual({
            refKey: 'primaryObject',
            id: 'OBJECT#Rope',
            shortName: 'rope',
            gloss: 'a coil of thick hemp rope',
        })
    })

    it('omits gloss when absent', () => {
        const referent = buildCommandAttemptReferent('primaryObject', 'OBJECT#Rope' as EphemeraObjectId, 'rope')
        expect(referent).toEqual({
            refKey: 'primaryObject',
            id: 'OBJECT#Rope',
            shortName: 'rope',
        })
        expect('gloss' in referent).toBe(false)
    })
})
