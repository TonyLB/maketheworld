import { COYOTE_ENGINE_TEST_FIXTURES } from '../../coyoteGame/generators/testHarness/coyoteEngineTestFixtures'
import { parseCoyoteEngineTestSlashTail } from './parseCoyoteEngineTestSlash'

const n = COYOTE_ENGINE_TEST_FIXTURES.length

describe('parseCoyoteEngineTestSlashTail', () => {
    it('accepts empty tail', () => {
        expect(parseCoyoteEngineTestSlashTail('/test generation', n)).toEqual({ ok: true })
    })

    it('maps phase-only and phase + index', () => {
        expect(parseCoyoteEngineTestSlashTail('/test generation planSelect', n)).toEqual({
            ok: true,
            harnessInvocation: {
                mode: 'partial',
                testOnly: 'planSelect',
                harnessRunKind: 'runUntil',
            },
        })
        expect(parseCoyoteEngineTestSlashTail('/test generation CLUSTERING 1', n)).toEqual({
            ok: true,
            harnessInvocation: {
                mode: 'partial',
                testOnly: 'clustering',
                harnessRunKind: 'runUntil',
                fixtureIndex1Based: 1,
            },
        })
    })

    it('maps explicit run kind forms', () => {
        expect(parseCoyoteEngineTestSlashTail('/test generation runOnly planSelect', n)).toEqual({
            ok: true,
            harnessInvocation: {
                mode: 'partial',
                testOnly: 'planSelect',
                harnessRunKind: 'runOnly',
            },
        })
        expect(parseCoyoteEngineTestSlashTail('/test generation RUNUNTIL phasePlan 1', n)).toEqual({
            ok: true,
            harnessInvocation: {
                mode: 'partial',
                testOnly: 'phasePlan',
                harnessRunKind: 'runUntil',
                fixtureIndex1Based: 1,
            },
        })
    })

    it('maps fixture-only full mode', () => {
        expect(parseCoyoteEngineTestSlashTail(`/test generation ${n}`, n)).toEqual({
            ok: true,
            harnessInvocation: { mode: 'full', fixtureIndex1Based: n },
        })
    })

    it('rejects fixture index first in two-token form', () => {
        const r = parseCoyoteEngineTestSlashTail('/test generation 1 clustering', n)
        expect(r.ok).toBe(false)
        if (!r.ok) {
            expect(r.errorMessage).toContain('fixture index first')
        }
    })

    it('rejects invalid explicit run kind tails', () => {
        const unknownPhase = parseCoyoteEngineTestSlashTail('/test generation runOnly nope', n)
        expect(unknownPhase.ok).toBe(false)
        if (!unknownPhase.ok) {
            expect(unknownPhase.errorMessage).toContain('Unknown phase alias "nope"')
        }

        const badIndex = parseCoyoteEngineTestSlashTail('/test generation runOnly planSelect nope', n)
        expect(badIndex.ok).toBe(false)
        if (!badIndex.ok) {
            expect(badIndex.errorMessage).toContain('Third token must be a fixture index')
        }
    })
})
