import { isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraMetaRoomObject } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { buildPlanSelectPrompt } from '../pipelines/hypothesis/planSelect/buildPlanSelectPrompt'
import {
    isValidMaterializedAffordanceStableKey,
    parsePlanSelectOutput,
} from '../pipelines/hypothesis/planSelect/parsePlanSelectOutput'
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
        const parts = buildPlanSelectPrompt({
            roomObjectsByRoom: inject!.roomObjectsByRoom,
            combined: inject!.combined,
        })
        expect(parts.invariantPrefix.length).toBeGreaterThan(0)
        expect(parts.dynamicSuffix).toContain('"schemaVersion":4')
        expect(parts.dynamicSuffix).toContain('candidate-1')
    })

    it('fixture-01 narrativeBeatsInject planSelectOutput carries a materialized affordance Finishing Move member', () => {
        const phaseInject = COYOTE_ENGINE_TEST_FIXTURES[0].narrativeBeatsInject
        expect(phaseInject).toBeDefined()
        const selected = phaseInject!.planSelectOutput.selectedCandidate
        expect(selected).toBeDefined()
        const fm = selected!.tropeAssignments['Finishing Move']
        expect(fm?.members.length).toBeGreaterThan(0)
        const coyoteRow = fm!.members.find((m) => m.stableKey === 'affordance:coyote')
        expect(coyoteRow).toBeDefined()
        expect(isValidMaterializedAffordanceStableKey(coyoteRow!.stableKey)).toBe(true)
    })

    it('fixture-01 narrativeBeats handoff parses through parsePlanSelectOutput like production output', () => {
        const handoff = COYOTE_ENGINE_TEST_FIXTURES[0].narrativeBeatsInject!.planSelectOutput
        const raw = [
            '## Intent conflicts',
            '- (fixture harness)',
            '## Rubric comparison',
            '- candidate-1.',
            '## Winner selection',
            '- Winner: candidate-1.',
            '',
            '```json',
            JSON.stringify(handoff),
            '```',
        ].join('\n')
        const parsed = parsePlanSelectOutput(raw)
        expect(parsed.ok).toBe(true)
        if (!parsed.ok) {
            throw new Error(parsed.reason)
        }
        expect(parsed.handoff.paragraphSummary).toBe(handoff.paragraphSummary)
        expect(parsed.handoff.selectedCandidate?.tropeAssignments['Finishing Move']?.members[0]?.stableKey).toBe(
            'affordance:coyote'
        )
    })

    it('fixture-10 planSelectInject includes cannon member in combined contraption lane', () => {
        const fixture10 = COYOTE_ENGINE_TEST_FIXTURES.find(({ id }) => id === 'fixture-10')
        expect(fixture10).toBeDefined()
        const contraptionMembers = fixture10?.planSelectInject?.combined.candidates[0]?.tropeAssignments.Contraption?.members ?? []
        const cannonMember = contraptionMembers.find((member) => member.identifier === 'cannon-0')
        expect(cannonMember).toBeDefined()
    })
})

describe('resolveCoyoteHarnessStartAtInject', () => {
    it('returns planSelect inject for fixture index 1', () => {
        const r = resolveCoyoteHarnessStartAtInject({
            fixtureIndex1Based: 1,
            phase: 'planSelect',
        })
        expect(r.ok).toBe(true)
        if (r.ok && r.phase === 'planSelect') {
            expect(r.inject.combined.candidates.length).toBeGreaterThan(0)
        }
    })

    it('returns planSelect inject for fixture index 2', () => {
        const r = resolveCoyoteHarnessStartAtInject({
            fixtureIndex1Based: 2,
            phase: 'planSelect',
        })
        expect(r.ok).toBe(true)
        if (r.ok && r.phase === 'planSelect') {
            expect(r.inject.combined.candidates.length).toBeGreaterThan(0)
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

    it('returns narrativeBeats inject for fixture index 1', () => {
        const r = resolveCoyoteHarnessStartAtInject({
            fixtureIndex1Based: 1,
            phase: 'narrativeBeats',
        })
        expect(r.ok).toBe(true)
        if (r.ok && r.phase === 'narrativeBeats') {
            expect(r.phase).toBe('narrativeBeats')
            expect(r.inject.planSelectOutput.paragraphSummary.length).toBeGreaterThan(0)
        }
    })

    it('returns narrativeBeats inject for fixture index 2', () => {
        const r = resolveCoyoteHarnessStartAtInject({
            fixtureIndex1Based: 2,
            phase: 'narrativeBeats',
        })
        expect(r.ok).toBe(true)
        if (r.ok && r.phase === 'narrativeBeats') {
            expect(r.phase).toBe('narrativeBeats')
            expect(r.inject.planSelectOutput.paragraphSummary.length).toBeGreaterThan(0)
            expect(Array.isArray(r.inject.planSelectOutput.planIssues)).toBe(true)
        }
    })
})
