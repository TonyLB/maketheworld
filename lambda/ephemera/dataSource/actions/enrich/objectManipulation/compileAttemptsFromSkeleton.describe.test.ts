import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import { compileAttemptsFromSkeleton } from './compileAttemptsFromSkeleton'
import type { ParseSkeleton } from './parse/parseToken'
import { objectManipulationErrorMessages } from './resolveObjectSpan'
import { planFillOf } from './plan/attemptTemplateFixture'
import { CommandAttempt } from '../../commandAttempt'
import { lookedAtObjectIdOf } from '../../commandAttempt/lookedAtObjectId'
import { testLudicGraph } from '../../../positions/ludicGraph/testFixtures'

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
    return planFillOf(skeleton, 'test command').attempts[0]
}

describe('compileAttemptsFromSkeleton (a look)', () => {
    it('returns LookComponent for a matched closed-template command with grounded catalog', async () => {
        const result = await compileAttemptsFromSkeleton(
            {
                command: 'look rocket skates',
                fills: [{ skeleton: lookSkeleton('look', 'rocket skates', 'rocketSkatesRef'), attempts: [planned(lookSkeleton('look', 'rocket skates', 'rocketSkatesRef'))] }],
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
                fills: [{ skeleton: lookSkeleton('examine', 'rocket skates', 'rocketSkatesRef'), attempts: [planned(lookSkeleton('examine', 'rocket skates', 'rocketSkatesRef'))] }],
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
                fills: [{ skeleton: lookSkeleton('look', 'lantern', 'lanternRef'), attempts: [planned(lookSkeleton('look', 'lantern', 'lanternRef'))] }],
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
                fills: [{ skeleton: [
                    { type: 'text', text: 'balance' },
                    { type: 'objectSpan', span: 'broom', stableRefKey: 'broomRef' },
                    { type: 'text', text: 'carefully' },
                ], attempts: [CommandAttempt.create('look', 'balance broom carefully', [])] }],
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
                fills: [{ skeleton: lookSkeleton('look', 'rocket skates', 'rocketSkatesRef'), attempts: [planned(lookSkeleton('look', 'rocket skates', 'rocketSkatesRef'))] }],
                roomObjectCatalog: [{ objectId: rocketSkatesId, normalizedShortName: 'rocket skates' }],
            },
            0.9
        )

        expect(result).toEqual({
            type: 'Error',
            errorMessage: objectManipulationErrorMessages.noActingCharacter,
        })
    })

    it('abstains when there is no catalog to resolve the span against (nothing grounds)', async () => {
        const result = await compileAttemptsFromSkeleton(
            {
                command: 'look sword',
                fills: [{ skeleton: lookSkeleton('look', 'sword', 'swordRef'), attempts: [planned(lookSkeleton('look', 'sword', 'swordRef'))] }],
                characterId,
            },
            0.9
        )

        expect(result.type).toBe('Abstain')
    })

    it('returns Consult, naming both candidates, when the span resolves to more than one object', async () => {
        const secondRocketSkatesId = 'OBJECT#RocketSkates2' as EphemeraObjectId
        const result = await compileAttemptsFromSkeleton(
            {
                command: 'look rocket skates',
                fills: [{ skeleton: lookSkeleton('look', 'rocket skates', 'rocketSkatesRef'), attempts: [planned(lookSkeleton('look', 'rocket skates', 'rocketSkatesRef'))] }],
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
            pass: 'pure',
            root: {
                command: 'look rocket skates',
                // Plan mints fresh action ids per call, so the frozen attempts are matched by shape.
                fills: [{ skeleton: lookSkeleton('look', 'rocket skates', 'rocketSkatesRef'), attempts: [expect.objectContaining({ actions: expect.any(Array) })] }],
                confidence: 0.9,
            },
        })
    })

    it('carries a NarrateAttemptAction on the published attempt', async () => {
        const result = await compileAttemptsFromSkeleton(
            {
                command: 'look rocket skates',
                fills: [{ skeleton: lookSkeleton('look', 'rocket skates', 'rocketSkatesRef'), attempts: [planned(lookSkeleton('look', 'rocket skates', 'rocketSkatesRef'))] }],
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

describe('compileAttemptsFromSkeleton (a qualified look)', () => {
    const roomId = 'ROOM#Bridge' as EphemeraRoomId
    const tableCupId = 'OBJECT#TableCup' as EphemeraObjectId
    const floorCupId = 'OBJECT#FloorCup' as EphemeraObjectId
    const tableId = 'OBJECT#Table' as EphemeraObjectId
    const skeleton: ParseSkeleton = [
        { type: 'text', text: 'look' },
        { type: 'text', text: 'at' },
        { type: 'objectSpan', span: 'cup', stableRefKey: 'cupRef' },
        { type: 'text', text: 'on' },
        { type: 'objectSpan', span: 'table', stableRefKey: 'tableRef' },
    ]
    const compile = (catalog: { objectId: EphemeraObjectId; normalizedShortName: string }[], hostsOf: Record<string, EphemeraMembershipHostId[]>) => compileAttemptsFromSkeleton(
        {
            command: 'look at the cup on the table',
            fills: [planFillOf(skeleton, 'look at the cup on the table')],
            characterId,
            hostRoomId: roomId,
            roomObjectCatalog: catalog,
        },
        0.9,
        {
            positionsReadDeps: {
                getMembershipContainers: jest.fn(async (id: string) => hostsOf[id] ?? []),
                getLudicGraph: jest.fn(async (hostId: string) => testLudicGraph(hostId as EphemeraRoomId)),
            },
        }
    )

    it('looks at the cup on the table without asking: the qualifier\'s assertion rules out the cup on the floor', async () => {
        const result = await compile(
            [{ objectId: tableCupId, normalizedShortName: 'cup' }, { objectId: floorCupId, normalizedShortName: 'cup' }, { objectId: tableId, normalizedShortName: 'table' }],
            { [tableCupId]: [tableId], [floorCupId]: [roomId], [tableId]: [roomId] }
        )

        expect(result).toEqual({ type: 'CommandAttempt', attempt: expect.anything(), confidence: 0.9 })
        if (result.type === 'CommandAttempt') {
            expect(lookedAtObjectIdOf(result.attempt)).toBe(tableCupId)
        }
    })

    it('refuses with the world\'s reason when no cup is on the table', async () => {
        const result = await compile(
            [{ objectId: floorCupId, normalizedShortName: 'cup' }, { objectId: tableId, normalizedShortName: 'table' }],
            { [floorCupId]: [roomId], [tableId]: [roomId] }
        )

        expect(result).toEqual({ type: 'Error', errorMessage: 'The table has no cup.' })
    })
})
