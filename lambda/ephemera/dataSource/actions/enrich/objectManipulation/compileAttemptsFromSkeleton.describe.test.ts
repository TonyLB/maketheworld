import type { EphemeraCharacterId, EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { compileAttemptsFromSkeleton } from './compileAttemptsFromSkeleton'
import type { ParseSkeleton } from './parse/parseToken'
import { objectManipulationErrorMessages } from './resolveObjectSpan'
import { planSkeleton } from './plan/planSkeleton'
import { CommandAttempt } from '../../commandAttempt'

/** The object the look names: the attempt's first referent. */
const lookedAtId = (result: { type: string; attempt?: unknown }): unknown => (result.attempt as { referents: { id: unknown }[] }).referents[0]?.id

const rocketSkatesId = 'OBJECT#RocketSkates' as EphemeraObjectId
const characterId = 'CHARACTER#Alpha' as EphemeraCharacterId

const lookSkeleton = (verb: string, span: string, stableRefKey: string): ParseSkeleton => [
    { type: 'text', text: verb },
    { type: 'objectSpan', span, stableRefKey },
]

/** Plan's primary attempt for a skeleton: the input the producers take (ISS8203 slice 1). */
const planned = (skeleton: ParseSkeleton) => {
    const plan = planSkeleton(skeleton, 'test command')
    if (plan.type !== 'attempts' || plan.attempts.length === 0) {
        throw new Error('planSkeleton produced no attempt for this skeleton')
    }
    return plan.attempts[0]
}

describe('compileAttemptsFromSkeleton (a look)', () => {
    it('returns LookComponent for a matched closed-template command with grounded catalog', async () => {
        const result = await compileAttemptsFromSkeleton(
            {
                command: 'look rocket skates',
                skeleton: lookSkeleton('look', 'rocket skates', 'rocketSkatesRef'),
                attempts: [planned(lookSkeleton('look', 'rocket skates', 'rocketSkatesRef'))],
                characterId,
                roomObjectCatalog: [{ objectId: rocketSkatesId, normalizedShortName: 'rocket skates' }],
            },
            0.9
        )

        expect(result).toEqual({ type: 'CommandAttempt', attempt: expect.anything(), confidence: 0.9 })
        expect(lookedAtId(result)).toBe(rocketSkatesId)
    })

    it('matches "examine" the same way as "look"', async () => {
        const result = await compileAttemptsFromSkeleton(
            {
                command: 'examine rocket skates',
                skeleton: lookSkeleton('examine', 'rocket skates', 'rocketSkatesRef'),
                attempts: [planned(lookSkeleton('examine', 'rocket skates', 'rocketSkatesRef'))],
                characterId,
                roomObjectCatalog: [{ objectId: rocketSkatesId, normalizedShortName: 'rocket skates' }],
            },
            0.9
        )

        expect(result).toEqual({ type: 'CommandAttempt', attempt: expect.anything(), confidence: 0.9 })
        expect(lookedAtId(result)).toBe(rocketSkatesId)
    })

    it('resolves from the held-inventory catalog as well as the room catalog', async () => {
        const result = await compileAttemptsFromSkeleton(
            {
                command: 'look lantern',
                skeleton: lookSkeleton('look', 'lantern', 'lanternRef'),
                attempts: [planned(lookSkeleton('look', 'lantern', 'lanternRef'))],
                characterId,
                heldInventoryCatalog: [{ objectId: rocketSkatesId, normalizedShortName: 'lantern' }],
            },
            0.9
        )

        expect(result).toEqual({ type: 'CommandAttempt', attempt: expect.anything(), confidence: 0.9 })
        expect(lookedAtId(result)).toBe(rocketSkatesId)
    })

    it('abstains when the skeleton does not match the closed look template', async () => {
        const result = await compileAttemptsFromSkeleton(
            {
                command: 'balance broom carefully',
                skeleton: [
                    { type: 'text', text: 'balance' },
                    { type: 'objectSpan', span: 'broom', stableRefKey: 'broomRef' },
                    { type: 'text', text: 'carefully' },
                ],
                attempts: [CommandAttempt.create('balance broom carefully', [])],
                characterId,
            },
            0.9
        )

        expect(result).toEqual({
            type: 'Abstain',
            confidence: 0.9,
            reason: objectManipulationErrorMessages.lookNoTemplateMatch,
        })
    })

    it('returns noActingCharacter Error when characterId is absent', async () => {
        const result = await compileAttemptsFromSkeleton(
            {
                command: 'look rocket skates',
                skeleton: lookSkeleton('look', 'rocket skates', 'rocketSkatesRef'),
                attempts: [planned(lookSkeleton('look', 'rocket skates', 'rocketSkatesRef'))],
                roomObjectCatalog: [{ objectId: rocketSkatesId, normalizedShortName: 'rocket skates' }],
            },
            0.9
        )

        expect(result).toEqual({
            type: 'Error',
            errorMessage: objectManipulationErrorMessages.noActingCharacter,
        })
    })

    it('errors when there is no catalog to resolve the span against', async () => {
        const result = await compileAttemptsFromSkeleton(
            {
                command: 'look sword',
                skeleton: lookSkeleton('look', 'sword', 'swordRef'),
                attempts: [planned(lookSkeleton('look', 'sword', 'swordRef'))],
                characterId,
            },
            0.9
        )

        expect(result.type).toBe('Error')
    })

    it('returns Consult, naming both candidates, when the span resolves to more than one object', async () => {
        const secondRocketSkatesId = 'OBJECT#RocketSkates2' as EphemeraObjectId
        const result = await compileAttemptsFromSkeleton(
            {
                command: 'look rocket skates',
                skeleton: lookSkeleton('look', 'rocket skates', 'rocketSkatesRef'),
                attempts: [planned(lookSkeleton('look', 'rocket skates', 'rocketSkatesRef'))],
                characterId,
                roomObjectCatalog: [
                    { objectId: rocketSkatesId, normalizedShortName: 'rocket skates' },
                    { objectId: secondRocketSkatesId, normalizedShortName: 'rocket skates' },
                ],
            },
            0.9
        )

        expect(result).toEqual({
            type: 'Consult',
            alternatives: [
                { proposedCommand: 'look at the rocket skates', objectId: rocketSkatesId, label: 'rocket skates', referentAnswers: { rocketSkatesRef: rocketSkatesId } },
                { proposedCommand: 'look at the rocket skates', objectId: secondRocketSkatesId, label: 'rocket skates', referentAnswers: { rocketSkatesRef: secondRocketSkatesId } },
            ],
            confidence: 0.9,
            root: {
                command: 'look rocket skates',
                skeleton: lookSkeleton('look', 'rocket skates', 'rocketSkatesRef'),
                // Plan mints fresh action ids per call, so the frozen attempts are matched by shape.
                attempts: [expect.objectContaining({ actions: expect.any(Array) })],
                confidence: 0.9,
            },
        })
    })

    it('carries a NarrateAttemptAction on the published attempt', async () => {
        const result = await compileAttemptsFromSkeleton(
            {
                command: 'look rocket skates',
                skeleton: lookSkeleton('look', 'rocket skates', 'rocketSkatesRef'),
                attempts: [planned(lookSkeleton('look', 'rocket skates', 'rocketSkatesRef'))],
                characterId,
                roomObjectCatalog: [{ objectId: rocketSkatesId, normalizedShortName: 'rocket skates' }],
            },
            0.9
        )

        if (result.type !== 'CommandAttempt') {
            throw new Error(`Expected CommandAttempt, got ${result.type}`)
        }
        expect(result.attempt.actions).toEqual([
            expect.objectContaining({ kind: 'narrate', description: 'Look at the rocket skates' }),
        ])
    })
})
