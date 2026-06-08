import { deIndentWML } from '../../../schema/utils'
import { treeFromWML } from '../../../schema'
import { StandardExitFromEndpoint, StandardExitToEndpoint } from './endpointReference'
import { referenceFromExitEndpoint, referencesFromExitEndpoint } from './endpointReference'
import { StandardExitEdge } from './exitEdge'

describe('StandardExitEndpoint reference extraction', () => {
    describe('Plain', () => {
        it('should extract legalKey reference from From endpoint', () => {
            const endpoint = new StandardExitFromEndpoint({ key: 'highway', tag: 'Room' })
            const refs = referencesFromExitEndpoint(endpoint)
            expect(refs).toHaveLength(1)
            expect(refs[0].toJSON()).toEqual({ key: 'highway', tag: 'Room' })
            expect(referenceFromExitEndpoint(endpoint)?.toJSON()).toEqual({ key: 'highway', tag: 'Room' })
        })

        it('should extract universal key reference from To endpoint', () => {
            const endpoint = new StandardExitToEndpoint('ROOM#townCenter')
            const refs = referencesFromExitEndpoint(endpoint)
            expect(refs).toHaveLength(1)
            expect(refs[0].universalKey).toEqual('ROOM#townCenter')
            expect(referenceFromExitEndpoint(endpoint)?.universalKey).toEqual('ROOM#townCenter')
        })
    })

    describe('Unset', () => {
        it('should return empty references for unset endpoint', () => {
            const endpoint = new StandardExitFromEndpoint(undefined)
            expect(referencesFromExitEndpoint(endpoint)).toEqual([])
            expect(referenceFromExitEndpoint(endpoint)).toBeUndefined()
        })
    })

    describe('Remove', () => {
        it('should include match in references() but not reference() from JSON', () => {
            const endpoint = new StandardExitFromEndpoint({
                tag: 'Remove',
                match: 'ROOM#highway',
            })
            const refs = referencesFromExitEndpoint(endpoint)
            expect(refs).toHaveLength(1)
            expect(refs[0].universalKey).toEqual('ROOM#highway')
            expect(referenceFromExitEndpoint(endpoint)).toBeUndefined()
        })

        it('should include match in references() from WML Remove envelope', () => {
            const edge = new StandardExitEdge(treeFromWML(deIndentWML(`
                <Exit uuid=(e1)>
                    <From>ROOM#highway</From>
                    <Remove><To>ROOM#outside</To></Remove>
                </Exit>
            `)))
            const endpoint = edge.to
            const refs = referencesFromExitEndpoint(endpoint)
            expect(refs).toHaveLength(1)
            expect(refs[0].universalKey).toEqual('ROOM#outside')
            expect(referenceFromExitEndpoint(endpoint)).toBeUndefined()
        })
    })

    describe('Replace', () => {
        it('should include both match and payload in references() but only payload in reference() from JSON', () => {
            const endpoint = new StandardExitToEndpoint({
                tag: 'Replace',
                match: 'ROOM#townCenter',
                payload: 'ROOM#ghi',
            })
            const refs = referencesFromExitEndpoint(endpoint)
            expect(refs).toHaveLength(2)
            expect(refs.map((ref) => ref.universalKey)).toEqual(['ROOM#townCenter', 'ROOM#ghi'])
            expect(referenceFromExitEndpoint(endpoint)?.universalKey).toEqual('ROOM#ghi')
        })

        it('should include both match and payload from WML Replace/With envelope', () => {
            const edge = new StandardExitEdge(treeFromWML(deIndentWML(`
                <Exit uuid=(e1)>
                    <From>ROOM#highway</From>
                    <Replace><To>ROOM#townCenter</To></Replace>
                    <With><To>ROOM#ghi</To></With>
                </Exit>
            `)))
            const endpoint = edge.to
            const refs = referencesFromExitEndpoint(endpoint)
            expect(refs).toHaveLength(2)
            expect(refs.map((ref) => ref.universalKey)).toEqual(['ROOM#townCenter', 'ROOM#ghi'])
            expect(referenceFromExitEndpoint(endpoint)?.universalKey).toEqual('ROOM#ghi')
        })
    })
})
