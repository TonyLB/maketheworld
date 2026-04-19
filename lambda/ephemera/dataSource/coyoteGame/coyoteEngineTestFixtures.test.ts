import { isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraMetaRoomObject } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { COYOTE_ENGINE_TEST_FIXTURES } from './coyoteEngineTestFixtures'

const ALLOWED_COYOTE_ROOM_IDS = new Set([
    'ROOM#VORTEX',
    'ROOM#STRAIGHTAWAY',
    'ROOM#CLIFFTOP',
    'ROOM#CORNER',
    'ROOM#BRIDGE',
])

describe('COYOTE_ENGINE_TEST_FIXTURES', () => {
    it('contains exactly ten fixtures with unique non-empty ids', () => {
        expect(COYOTE_ENGINE_TEST_FIXTURES).toHaveLength(10)
        const ids = COYOTE_ENGINE_TEST_FIXTURES.map(({ id }) => id)
        expect(ids.every((id) => typeof id === 'string' && id.trim().length > 0)).toBe(true)
        expect(new Set(ids).size).toBe(ids.length)
    })

    it('uses only valid EphemeraRoomId values from the coyote room set', () => {
        for (const fixture of COYOTE_ENGINE_TEST_FIXTURES) {
            for (const roomId of Object.keys(fixture.roomObjectsByRoom)) {
                expect(isEphemeraRoomId(roomId)).toBe(true)
                expect(ALLOWED_COYOTE_ROOM_IDS.has(roomId)).toBe(true)
            }
        }
    })

    it('stores room object lists as valid EphemeraMetaRoomObject rows', () => {
        for (const fixture of COYOTE_ENGINE_TEST_FIXTURES) {
            for (const objects of Object.values(fixture.roomObjectsByRoom)) {
                expect(Array.isArray(objects)).toBe(true)
                for (const row of objects ?? []) {
                    expect(isEphemeraMetaRoomObject(row)).toBe(true)
                    expect(row.shortName.trim().length).toBeGreaterThan(0)
                }
            }
        }
    })
})
