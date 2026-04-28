import { isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraMetaRoomObject } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { buildHypothesisPlanSelectionPromptParts } from '../pipelines/hypothesis/buildHypothesisPlanSelectionPromptParts'
import {
    COYOTE_ENGINE_TEST_FIXTURES,
    resolveCoyoteHarnessStartAtInject,
} from './coyoteEngineTestFixtures'

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

    it('fixture-01 planSelectInject drives plan-selection prompt parts', () => {
        const inject = COYOTE_ENGINE_TEST_FIXTURES[0].planSelectInject
        expect(inject).toBeDefined()
        const parts = buildHypothesisPlanSelectionPromptParts({
            roomObjectsByRoom: inject!.roomObjectsByRoom,
            combinedMarkdown: inject!.combinedMarkdown,
        })
        expect(parts.invariantPrefix.length).toBeGreaterThan(0)
        expect(parts.dynamicSuffix).toContain('## Combined clustering')
    })
})

describe('resolveCoyoteHarnessStartAtInject', () => {
    it('returns planSelect inject for fixture index 1', () => {
        const r = resolveCoyoteHarnessStartAtInject({
            fixtureIndex1Based: 1,
            phase: 'planSelect',
        })
        expect(r.ok).toBe(true)
        if (r.ok) {
            expect(r.phase).toBe('planSelect')
            expect(r.inject.combinedMarkdown).toContain('## Combined clustering')
        }
    })

    it('returns missing inject error for planSelect when fixture has no bundle', () => {
        const r = resolveCoyoteHarnessStartAtInject({
            fixtureIndex1Based: 2,
            phase: 'planSelect',
        })
        expect(r.ok).toBe(false)
        if (!r.ok) {
            expect(r.message).toContain('planSelect')
            expect(r.message).toContain('fixture index 2')
            expect(r.message).toContain('fixture-02')
        }
    })

    it('rejects out-of-range fixture indices', () => {
        expect(
            resolveCoyoteHarnessStartAtInject({ fixtureIndex1Based: 0, phase: 'planSelect' }).ok
        ).toBe(false)
        expect(
            resolveCoyoteHarnessStartAtInject({ fixtureIndex1Based: 11, phase: 'planSelect' }).ok
        ).toBe(false)
        expect(
            resolveCoyoteHarnessStartAtInject({ fixtureIndex1Based: 1.5, phase: 'planSelect' }).ok
        ).toBe(false)
    })

    it('returns phasePlan inject for fixture index 1', () => {
        const r = resolveCoyoteHarnessStartAtInject({
            fixtureIndex1Based: 1,
            phase: 'phasePlan',
        })
        expect(r.ok).toBe(true)
        if (r.ok && r.phase === 'phasePlan') {
            expect(r.phase).toBe('phasePlan')
            expect(r.inject.hop1Handoff.paragraphSummary.length).toBeGreaterThan(0)
        }
    })

    it('returns missing inject for phasePlan when fixture has no bundle', () => {
        const r = resolveCoyoteHarnessStartAtInject({
            fixtureIndex1Based: 2,
            phase: 'phasePlan',
        })
        expect(r.ok).toBe(false)
        if (!r.ok) {
            expect(r.message).toContain('phasePlan')
            expect(r.message).toContain('fixture-02')
        }
    })
})
