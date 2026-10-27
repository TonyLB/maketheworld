import type { EphemeraCharacterId, EphemeraObjectId, EphemeraPresenceNodeId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import { compileAttemptsFromSkeleton } from './compileAttemptsFromSkeleton'
import { complexErrorMessage } from './complexityClasses'
import { objectManipulationErrorMessages } from './resolveObjectSpan'
import type { ParseSkeleton } from './parse/parseToken'
import { planFillOf } from './plan/attemptTemplateFixture'
import { planSkeleton } from './plan/attemptTemplateFixture'

/** The attempt's last action's desired result: the transfer, which Plan's templates put last. */
const transferStepOf = (result: { type: string; attempt?: unknown }): any => {
    const actions = (result.attempt as { actions: { desiredResult?: unknown }[] }).actions
    return actions[actions.length - 1]?.desiredResult
}
import { testLudicGraph } from '../../../positions/ludicGraph/testFixtures'

/** Room and host graphs for the shared dry run; the containment move needs the subject's room. */
const containmentPositionsReads = () => ({
    getMembershipContainers: jest.fn().mockResolvedValue([roomId]),
    getLudicGraph: jest.fn().mockImplementation(async (hostId: string) => testLudicGraph(hostId as EphemeraRoomId)),
})

/** Plan's attempt for a containment skeleton, as parseCommand hands it to the producer. */
const planAttempt = (skeleton: ParseSkeleton, command: string) => {
    return planFillOf(skeleton, command).attempts[0]!
}

const cupId = 'OBJECT#Cup' as EphemeraObjectId
const trayId = 'OBJECT#Tray' as EphemeraObjectId
const roomId = 'ROOM#Bridge' as EphemeraRoomId
const tableId = 'OBJECT#Table' as EphemeraObjectId

const containmentSkeleton = (
    verb: string,
    subjectSpan: string,
    subjectKey: string,
    prep: string,
    targetSpan: string,
    targetKey: string
): ParseSkeleton => [
    { type: 'text', text: verb },
    { type: 'objectSpan', span: subjectSpan, stableRefKey: subjectKey },
    { type: 'text', text: prep },
    { type: 'objectSpan', span: targetSpan, stableRefKey: targetKey },
]

describe('compileAttemptsFromSkeleton (take, drop and containment)', () => {
    it('returns ObjectContainment when subject and target each resolve to exactly one object', async () => {
        const result = await compileAttemptsFromSkeleton(
            {
                command: 'put cup on tray',
                fills: [{ skeleton: containmentSkeleton('put', 'cup', 'cupRef', 'on', 'tray', 'trayRef'), attempts: [planAttempt(containmentSkeleton('put', 'cup', 'cupRef', 'on', 'tray', 'trayRef'), 'put cup on tray')] }],
                hostRoomId: roomId,
                roomObjectCatalog: [
                    { objectId: cupId, normalizedShortName: 'cup' },
                    { objectId: trayId, normalizedShortName: 'tray' },
                ],
            },
            0.9,
            { positionsReadDeps: containmentPositionsReads() }
        )

        expect(result).toEqual({ type: 'CommandAttempt', attempt: expect.anything(), confidence: 0.9 })
        expect(transferStepOf(result)).toMatchObject({ containment: 'On', object: { groundedId: cupId }, to: { groundedId: trayId } })
    })

    it('returns ObjectContainment with containment In when the caller forwards the In kind', async () => {
        const result = await compileAttemptsFromSkeleton(
            {
                command: 'put cup in tray',
                fills: [{ skeleton: containmentSkeleton('put', 'cup', 'cupRef', 'in', 'tray', 'trayRef'), attempts: [planAttempt(containmentSkeleton('put', 'cup', 'cupRef', 'in', 'tray', 'trayRef'), 'put cup in tray')] }],
                hostRoomId: roomId,
                roomObjectCatalog: [
                    { objectId: cupId, normalizedShortName: 'cup' },
                    { objectId: trayId, normalizedShortName: 'tray' },
                ],
            },
            0.9,
            { positionsReadDeps: containmentPositionsReads() }
        )

        expect(result).toEqual({ type: 'CommandAttempt', attempt: expect.anything(), confidence: 0.9 })
        expect(transferStepOf(result)).toMatchObject({ containment: 'In', object: { groundedId: cupId }, to: { groundedId: trayId } })
    })

    it('resolves the subject from held inventory when it is not in the room catalog', async () => {
        const result = await compileAttemptsFromSkeleton(
            {
                command: 'put cup on tray',
                fills: [{ skeleton: containmentSkeleton('put', 'cup', 'cupRef', 'on', 'tray', 'trayRef'), attempts: [planAttempt(containmentSkeleton('put', 'cup', 'cupRef', 'on', 'tray', 'trayRef'), 'put cup on tray')] }],
                hostRoomId: roomId,
                roomObjectCatalog: [{ objectId: trayId, normalizedShortName: 'tray' }],
                heldInventoryCatalog: [{ objectId: cupId, normalizedShortName: 'cup' }],
            },
            0.9,
            { positionsReadDeps: containmentPositionsReads() }
        )

        expect(result).toEqual({ type: 'CommandAttempt', attempt: expect.anything(), confidence: 0.9 })
        expect(transferStepOf(result)).toMatchObject({ containment: 'On', object: { groundedId: cupId }, to: { groundedId: trayId } })
    })

    it('errors with noHostRoom when no hostRoomId is supplied', async () => {
        const result = await compileAttemptsFromSkeleton(
            {
                command: 'put cup on tray',
                fills: [{ skeleton: containmentSkeleton('put', 'cup', 'cupRef', 'on', 'tray', 'trayRef'), attempts: [planAttempt(containmentSkeleton('put', 'cup', 'cupRef', 'on', 'tray', 'trayRef'), 'put cup on tray')] }],
            },
            0.9,
            { positionsReadDeps: containmentPositionsReads() }
        )

        expect(result).toEqual({ type: 'Error', errorMessage: objectManipulationErrorMessages.noHostRoom })
    })

    it('abstains with noCatalog when neither catalog is supplied (nothing grounds)', async () => {
        const result = await compileAttemptsFromSkeleton(
            {
                command: 'put cup on tray',
                fills: [{ skeleton: containmentSkeleton('put', 'cup', 'cupRef', 'on', 'tray', 'trayRef'), attempts: [planAttempt(containmentSkeleton('put', 'cup', 'cupRef', 'on', 'tray', 'trayRef'), 'put cup on tray')] }],
                hostRoomId: roomId,
            },
            0.9,
            { positionsReadDeps: containmentPositionsReads() }
        )

        expect(result).toEqual({ type: 'Abstain', confidence: 0.9, reason: objectManipulationErrorMessages.noCatalog })
    })

    it('abstains on a take of something absent: nothing grounds, so the command is not understood here and climbs', async () => {
        const skeleton: ParseSkeleton = [
            { type: 'text', text: 'take' },
            { type: 'objectSpan', span: 'unicorn', stableRefKey: 'unicornRef' },
        ]
        const result = await compileAttemptsFromSkeleton(
            {
                command: 'take unicorn',
                fills: [{ skeleton, attempts: [planAttempt(skeleton, 'take unicorn')] }],
                characterId: 'CHARACTER#Alpha' as EphemeraCharacterId,
                hostRoomId: roomId,
                roomObjectCatalog: [{ objectId: cupId, normalizedShortName: 'cup' }],
            },
            0.9,
            {
                embedSpan: jest.fn().mockResolvedValue({ success: false, errorMessage: 'embedding stubbed as unavailable' }),
                positionsReadDeps: containmentPositionsReads(),
            }
        )

        expect(result).toMatchObject({ type: 'Abstain', confidence: 0.9 })
    })

    it('returns Consult, naming both candidates, when the subject span resolves to more than one object', async () => {
        const secondCupId = 'OBJECT#Cup2' as EphemeraObjectId
        const result = await compileAttemptsFromSkeleton(
            {
                command: 'put cup on tray',
                fills: [{ skeleton: containmentSkeleton('put', 'cup', 'cupRef', 'on', 'tray', 'trayRef'), attempts: [planAttempt(containmentSkeleton('put', 'cup', 'cupRef', 'on', 'tray', 'trayRef'), 'put cup on tray')] }],
                hostRoomId: roomId,
                roomObjectCatalog: [
                    { objectId: cupId, normalizedShortName: 'cup' },
                    { objectId: secondCupId, normalizedShortName: 'cup' },
                    { objectId: trayId, normalizedShortName: 'tray' },
                ],
            },
            0.9,
            { positionsReadDeps: containmentPositionsReads() }
        )

        expect(result).toEqual({
            type: 'Consult',
            alternatives: [
                { proposedCommand: 'put the cup on the tray', label: 'cup', referentAnswers: { cupRef: cupId, trayRef: trayId } },
                { proposedCommand: 'put the cup on the tray', label: 'cup', referentAnswers: { cupRef: secondCupId, trayRef: trayId } },
            ],
            confidence: 0.9,
            root: {
                command: 'put cup on tray',
                // Plan mints fresh action ids per call, so the frozen attempts are matched by shape.
                fills: [{ skeleton: containmentSkeleton('put', 'cup', 'cupRef', 'on', 'tray', 'trayRef'), attempts: [expect.objectContaining({ actions: expect.any(Array) })] }],
                confidence: 0.9,
            },
        })
    })

    it('labels each Consult alternative as the whole command when several referents are ambiguous', async () => {
        const redId = 'OBJECT#RedCup' as EphemeraObjectId
        const blueId = 'OBJECT#BlueCup' as EphemeraObjectId
        const skeleton = containmentSkeleton('put', 'cup', 'cupRef1', 'on', 'cup', 'cupRef2')
        const result = await compileAttemptsFromSkeleton(
            {
                command: 'put cup on cup',
                fills: [{ skeleton, attempts: [planAttempt(skeleton, 'put cup on cup')] }],
                hostRoomId: roomId,
                roomObjectCatalog: [
                    { objectId: redId, normalizedShortName: 'Red cup' },
                    { objectId: blueId, normalizedShortName: 'Blue cup' },
                ],
            },
            0.9,
            { positionsReadDeps: containmentPositionsReads() }
        )

        if (result.type !== 'Consult') {
            throw new Error(`expected a Consult, got ${result.type}`)
        }
        expect(result.alternatives.map(({ label }) => label).sort()).toEqual(['put Blue cup on Red cup', 'put Red cup on Blue cup'])
    })

    it('labels with just the ambiguous referent\'s names when the other referent is settled', async () => {
        const redId = 'OBJECT#RedCup' as EphemeraObjectId
        const blueId = 'OBJECT#BlueCup' as EphemeraObjectId
        const skeleton = containmentSkeleton('put', 'cup', 'cupRef', 'on', 'tray', 'trayRef')
        const result = await compileAttemptsFromSkeleton(
            {
                command: 'put cup on tray',
                fills: [{ skeleton, attempts: [planAttempt(skeleton, 'put cup on tray')] }],
                hostRoomId: roomId,
                roomObjectCatalog: [
                    { objectId: redId, normalizedShortName: 'Red cup' },
                    { objectId: blueId, normalizedShortName: 'Blue cup' },
                    { objectId: trayId, normalizedShortName: 'tray' },
                ],
            },
            0.9,
            { positionsReadDeps: containmentPositionsReads() }
        )

        if (result.type !== 'Consult') {
            throw new Error(`expected a Consult, got ${result.type}`)
        }
        expect(result.alternatives.map(({ label }) => label).sort()).toEqual(['Blue cup', 'Red cup'])
    })

    it('tells two same-named cups apart by where each sits, where the names alone would read the same', async () => {
        const secondCupId = 'OBJECT#Cup2' as EphemeraObjectId
        const base = 'PRESENCE#base' as EphemeraPresenceNodeId
        const onTable = 'PRESENCE#on-table' as EphemeraPresenceNodeId
        const result = await compileAttemptsFromSkeleton(
            {
                command: 'put cup on tray',
                fills: [{ skeleton: containmentSkeleton('put', 'cup', 'cupRef', 'on', 'tray', 'trayRef'), attempts: [planAttempt(containmentSkeleton('put', 'cup', 'cupRef', 'on', 'tray', 'trayRef'), 'put cup on tray')] }],
                hostRoomId: roomId,
                roomObjectCatalog: [
                    { objectId: cupId, normalizedShortName: 'cup', placement: [{ host: cupId, bindings: [{ presence: base, under: [{ host: roomId, presence: base }], rooms: [roomId] }] }] },
                    { objectId: secondCupId, normalizedShortName: 'cup', placement: [{ host: secondCupId, bindings: [{ presence: onTable, under: [{ host: tableId, presence: base }], rooms: [roomId] }] }] },
                    { objectId: tableId, normalizedShortName: 'table' },
                    { objectId: trayId, normalizedShortName: 'tray' },
                ],
            },
            0.9,
            { positionsReadDeps: containmentPositionsReads() }
        )

        if (result.type !== 'Consult') {
            throw new Error(`expected a Consult, got ${result.type}`)
        }
        expect(result.alternatives.map(({ label }) => label)).toEqual(['the cup in the room', 'the cup on the table'])
        // One reading each, so nothing is asked by position: the answers are objects alone.
        expect(result.alternatives.every((alternative) => alternative.viewAnswers === undefined)).toBe(true)
    })

    it('abstains when subject and target resolve to the same object', async () => {
        const result = await compileAttemptsFromSkeleton(
            {
                command: 'put cup on cup',
                fills: [{ skeleton: containmentSkeleton('put', 'cup', 'cupRef1', 'on', 'cup', 'cupRef2'), attempts: [planAttempt(containmentSkeleton('put', 'cup', 'cupRef1', 'on', 'cup', 'cupRef2'), 'put cup on cup')] }],
                hostRoomId: roomId,
                roomObjectCatalog: [
                    { objectId: cupId, normalizedShortName: 'cup' },
                ],
            },
            0.9,
            { positionsReadDeps: containmentPositionsReads() }
        )

        expect(result).toEqual({
            type: 'Abstain',
            confidence: 0.9,
            reason: expect.any(String),
        })
    })

    it('builds a real, ungrounded transferMembership desiredResult carrying the containment flag', async () => {
        const result = await compileAttemptsFromSkeleton(
            {
                command: 'put cup on tray',
                fills: [{ skeleton: containmentSkeleton('put', 'cup', 'cupRef', 'on', 'tray', 'trayRef'), attempts: [planAttempt(containmentSkeleton('put', 'cup', 'cupRef', 'on', 'tray', 'trayRef'), 'put cup on tray')] }],
                hostRoomId: roomId,
                roomObjectCatalog: [
                    { objectId: cupId, normalizedShortName: 'cup' },
                    { objectId: trayId, normalizedShortName: 'tray' },
                ],
            },
            0.9,
            { positionsReadDeps: containmentPositionsReads() }
        )

        if (result.type !== 'CommandAttempt') {
            throw new Error(`expected CommandAttempt, got ${result.type}`)
        }
        const desiredResult = transferStepOf(result)
        expect(desiredResult).toMatchObject({
            kind: 'change',
            primitive: 'transferMembership',
            object: { referentType: 'objectSpan', stableRefKey: 'cupRef' },
            from: { referentType: 'currentHost' },
            to: { referentType: 'objectSpan', stableRefKey: 'trayRef' },
        })
    })
})

describe('compileAttemptsFromSkeleton (a qualified take, on the LLM route)', () => {
    const actor = 'CHARACTER#Tess' as EphemeraCharacterId
    const tableCupId = 'OBJECT#TableCup' as EphemeraObjectId
    const floorCupId = 'OBJECT#FloorCup' as EphemeraObjectId
    const bagId = 'OBJECT#Bag' as EphemeraObjectId
    const clothId = 'OBJECT#Cloth' as EphemeraObjectId
    const hanging = 'PRESENCE#hanging' as EphemeraPresenceNodeId
    const lying = 'PRESENCE#lying' as EphemeraPresenceNodeId

    const table = { objectId: tableId, normalizedShortName: 'table' }
    const cloth = {
        objectId: clothId,
        normalizedShortName: 'cloth',
        placement: [{ host: clothId, bindings: [
            { presence: hanging, under: [{ host: roomId, presence: 'PRESENCE#room' as EphemeraPresenceNodeId }], rooms: [roomId] },
            { presence: lying, under: [{ host: tableId, presence: 'PRESENCE#table' as EphemeraPresenceNodeId }], rooms: [roomId] },
        ] }],
    }

    /** Parse's flat skeleton for a qualified command, Planned as parseCommand does, then compiled. */
    const compile = (
        verb: string,
        subject: string,
        preposition: string,
        host: string,
        catalog: { objectId: EphemeraObjectId; normalizedShortName: string }[],
        hostsOf: Record<string, EphemeraMembershipHostId[]>
    ) => {
        const command = `${verb} the ${subject} ${preposition} the ${host}`
        const skeleton = containmentSkeleton(verb, subject, `${subject}Ref`, preposition, host, `${host}Ref`)
        return compileAttemptsFromSkeleton(
            {
                command,
                fills: planSkeleton(skeleton, command).fills,
                characterId: actor,
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
    }

    const twoCups = [
        { objectId: tableCupId, normalizedShortName: 'cup' },
        { objectId: floorCupId, normalizedShortName: 'cup' },
        table,
    ]
    const twoCupsHosts = { [tableCupId]: [tableId], [floorCupId]: [roomId], [tableId]: [roomId] }

    it.each(['on', 'from'])('takes the cup %s the table without asking: the check rules out the cup on the floor', async (preposition) => {
        const result = await compile('get', 'cup', preposition, 'table', twoCups, twoCupsHosts)

        expect(result).toEqual({ type: 'CommandAttempt', attempt: expect.anything(), confidence: 0.9 })
        expect(transferStepOf(result)).toMatchObject({ object: { groundedId: tableCupId }, to: { referentType: 'actingCharacter' } })
    })

    it('takes the part of a draped cloth on the table without asking: the hanging part and the whole fail the check', async () => {
        const result = await compile('get', 'cloth', 'on', 'table', [cloth, table], { [clothId]: [roomId, tableId], [tableId]: [roomId] })

        expect(result).toEqual({ type: 'CommandAttempt', attempt: expect.anything(), confidence: 0.9 })
        expect(transferStepOf(result)).toMatchObject({ object: { groundedId: clothId, view: [lying] } })
    })

    it('refuses a take whose only candidate is not on the qualifier, naming host and subject', async () => {
        const result = await compile('get', 'bag', 'from', 'table', [{ objectId: bagId, normalizedShortName: 'bag' }, table], { [bagId]: [roomId], [tableId]: [roomId] })

        expect(result).toEqual({ type: 'Error', errorMessage: 'The table has no bag.' })
    })

    it('still asks when both cups are on the table: the check passes for both (labels as today)', async () => {
        const result = await compile('get', 'cup', 'on', 'table', twoCups, { ...twoCupsHosts, [floorCupId]: [tableId] })

        if (result.type !== 'Consult') {
            throw new Error(`expected a Consult, got ${result.type}`)
        }
        expect(result.alternatives.map(({ objectId }) => objectId).sort()).toEqual([floorCupId, tableCupId].sort())
        expect(result.alternatives.map(({ label }) => label)).toEqual(['cup', 'cup'])
    })

    it('moves the cup on the saucer on the table onto the table: a reading that needs two tables does not sink the one that needs one', async () => {
        const blueCupId = 'OBJECT#BlueCup' as EphemeraObjectId
        const blueSaucerId = 'OBJECT#BlueSaucer' as EphemeraObjectId
        const redCupId = 'OBJECT#RedCup' as EphemeraObjectId
        const redSaucerId = 'OBJECT#RedSaucer' as EphemeraObjectId
        const command = 'put cup on saucer on table on table'
        const skeleton: ParseSkeleton = [
            { type: 'text', text: 'put' },
            { type: 'objectSpan', span: 'cup', stableRefKey: 'cupRef' },
            { type: 'text', text: 'on' },
            { type: 'objectSpan', span: 'saucer', stableRefKey: 'saucerRef' },
            { type: 'text', text: 'on' },
            { type: 'objectSpan', span: 'table', stableRefKey: 'tableRef1' },
            { type: 'text', text: 'on' },
            { type: 'objectSpan', span: 'table', stableRefKey: 'tableRef2' },
        ]
        const hostsOf: Record<string, EphemeraMembershipHostId[]> = {
            [blueCupId]: [blueSaucerId],
            [blueSaucerId]: [roomId],
            [redCupId]: [redSaucerId],
            [redSaucerId]: [tableId],
            [tableId]: [roomId],
        }
        const result = await compileAttemptsFromSkeleton(
            {
                command,
                fills: [planFillOf(skeleton, command)],
                characterId: actor,
                hostRoomId: roomId,
                roomObjectCatalog: [
                    { objectId: blueCupId, normalizedShortName: 'cup' },
                    { objectId: redCupId, normalizedShortName: 'cup' },
                    { objectId: blueSaucerId, normalizedShortName: 'saucer' },
                    { objectId: redSaucerId, normalizedShortName: 'saucer' },
                    table,
                ],
            },
            0.9,
            {
                positionsReadDeps: {
                    getMembershipContainers: jest.fn(async (id: string) => hostsOf[id] ?? []),
                    getLudicGraph: jest.fn(async (hostId: string) => testLudicGraph(hostId as EphemeraRoomId)),
                },
            }
        )

        expect(result).toEqual({ type: 'CommandAttempt', attempt: expect.anything(), confidence: 0.9 })
        expect(transferStepOf(result)).toMatchObject({ object: { groundedId: redCupId }, to: { groundedId: tableId } })
    })

    it('reads a preposition outside the qualifier set as part of the span: no reading leaves a span unread', async () => {
        const command = 'get the cup under the table'
        const { fills } = planSkeleton(containmentSkeleton('get', 'cup', 'cupRef', 'under', 'table', 'tableRef'), command)
        expect(fills.map(({ skeleton }) => skeleton.map((token) => (token.type === 'objectSpan' ? `[${token.span}]` : token.text)).join(' '))).toEqual(['get [cup under table]', '[get cup under table]'])

        const result = await compile('get', 'cup', 'under', 'table', twoCups, twoCupsHosts)

        expect(result).not.toMatchObject({ reason: complexErrorMessage('multiObject') })
    })

    it('refuses a drop of a cup it does not hold through the qualified reading: the plain drop leaves the table unread', async () => {
        const result = await compile('drop', 'cup', 'in', 'table', twoCups, twoCupsHosts)

        expect(result).toEqual({ type: 'Error', errorMessage: objectManipulationErrorMessages.notCarryingObject })
    })

    it('takes the cup on the saucer on the table without asking: the reading of every span survives the gate, and its checks rule out the floor stack', async () => {
        const tableSaucerId = 'OBJECT#TableSaucer' as EphemeraObjectId
        const floorSaucerId = 'OBJECT#FloorSaucer' as EphemeraObjectId
        const command = 'take cup on saucer on table'
        const skeleton: ParseSkeleton = [
            { type: 'text', text: 'take' },
            { type: 'objectSpan', span: 'cup', stableRefKey: 'cupRef' },
            { type: 'text', text: 'on' },
            { type: 'objectSpan', span: 'saucer', stableRefKey: 'saucerRef' },
            { type: 'text', text: 'on' },
            { type: 'objectSpan', span: 'table', stableRefKey: 'tableRef' },
        ]
        const hostsOf: Record<string, EphemeraMembershipHostId[]> = {
            [tableCupId]: [tableSaucerId],
            [tableSaucerId]: [tableId],
            [floorCupId]: [floorSaucerId],
            [floorSaucerId]: [roomId],
            [tableId]: [roomId],
        }
        const result = await compileAttemptsFromSkeleton(
            {
                command,
                fills: [planFillOf(skeleton, command)],
                characterId: actor,
                hostRoomId: roomId,
                roomObjectCatalog: [
                    { objectId: tableCupId, normalizedShortName: 'cup' },
                    { objectId: floorCupId, normalizedShortName: 'cup' },
                    { objectId: tableSaucerId, normalizedShortName: 'saucer' },
                    { objectId: floorSaucerId, normalizedShortName: 'saucer' },
                    table,
                ],
            },
            0.9,
            {
                positionsReadDeps: {
                    getMembershipContainers: jest.fn(async (id: string) => hostsOf[id] ?? []),
                    getLudicGraph: jest.fn(async (hostId: string) => testLudicGraph(hostId as EphemeraRoomId)),
                },
            }
        )

        expect(result).toEqual({ type: 'CommandAttempt', attempt: expect.anything(), confidence: 0.9 })
        expect(transferStepOf(result)).toMatchObject({ object: { groundedId: tableCupId }, to: { referentType: 'actingCharacter' } })
    })
})
