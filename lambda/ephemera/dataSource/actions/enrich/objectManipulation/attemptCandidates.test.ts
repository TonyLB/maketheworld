import type { EphemeraObjectId, EphemeraPresenceNodeId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { attemptReferentAnswers, attemptSpanKeys, disambiguationLabels, expandAndAdjudicateCandidates, proposeAttemptCandidates } from './attemptCandidates'
import type { ObjectManipulationCatalogEntry } from './catalogMerge'
import { planSkeleton } from './plan/planSkeleton'
import type { ParseSkeleton } from './parse/parseToken'
import type { SpanCandidatePool } from './spanResolution'
import { CommandAttempt } from '../../commandAttempt'
import type { NarrationUnit } from '../../commandAttempt'
import { PositionAttemptAction } from '../../commandAttempt/action'
import { testLudicGraph } from '../../../positions/ludicGraph/testFixtures'
import { actingCharacterRef, currentHostRef } from './plan/planStep'

const cupId = 'OBJECT#Cup' as EphemeraObjectId
const trayId = 'OBJECT#Tray' as EphemeraObjectId

const catalog: ObjectManipulationCatalogEntry[] = [
    { objectId: cupId, normalizedShortName: 'cup', catalogScope: 'room' },
    { objectId: trayId, normalizedShortName: 'tray', catalogScope: 'room' },
]

const pool = (span: string, id: EphemeraObjectId): SpanCandidatePool => ({
    span,
    candidates: [{ id, label: span, jointRelevance: 1, sourceTags: ['exact'], locus: { kind: 'room' } }],
})

const attemptFor = (skeleton: ParseSkeleton, command: string): CommandAttempt => {
    const plan = planSkeleton(skeleton, command)
    if (plan.type !== 'attempts') {
        throw new Error(`Plan declined "${command}"`)
    }
    return plan.attempts[0]!
}

const relationSkeleton: ParseSkeleton = [
    { type: 'text', text: 'put' },
    { type: 'objectSpan', span: 'cup', stableRefKey: 'cupRef' },
    { type: 'text', text: 'on' },
    { type: 'objectSpan', span: 'tray', stableRefKey: 'trayRef' },
]

describe('attemptSpanKeys', () => {
    it('lists the distinct stableRefKeys the attempt names, in order', () => {
        expect(attemptSpanKeys([attemptFor(relationSkeleton, 'put cup on tray')])).toEqual(['cupRef', 'trayRef'])
    })
})

describe('proposeAttemptCandidates over an object seen in several positions', () => {
    const roomA = 'ROOM#A' as EphemeraRoomId
    const roomB = 'ROOM#B' as EphemeraRoomId
    const clothId = 'OBJECT#Cloth' as EphemeraObjectId
    const tableId = 'OBJECT#Table' as EphemeraObjectId
    const roomBinding = 'PRESENCE#room' as EphemeraPresenceNodeId
    const tableBinding = 'PRESENCE#table' as EphemeraPresenceNodeId
    const hanging = 'PRESENCE#hanging' as EphemeraPresenceNodeId
    const lying = 'PRESENCE#lying' as EphemeraPresenceNodeId

    // The cloth draped over the table: both parts are seen from the actor's room.
    const drapedCloth: ObjectManipulationCatalogEntry = {
        objectId: clothId,
        normalizedShortName: 'cloth',
        catalogScope: 'room',
        placement: [{ host: clothId, bindings: [
            { presence: hanging, under: [{ host: roomA, presence: roomBinding }], rooms: [roomA] },
            { presence: lying, under: [{ host: tableId, presence: tableBinding }], rooms: [roomA] },
        ] }],
    }
    // A rope across two rooms: only one end reaches the actor's room.
    const acrossRooms: ObjectManipulationCatalogEntry = {
        ...drapedCloth,
        placement: [{ host: clothId, bindings: [
            { presence: hanging, under: [{ host: roomA, presence: roomBinding }], rooms: [roomA] },
            { presence: lying, under: [{ host: roomB, presence: roomBinding }], rooms: [roomB] },
        ] }],
    }
    const table: ObjectManipulationCatalogEntry = { objectId: tableId, normalizedShortName: 'table', catalogScope: 'room' }

    const propose = (entry: ObjectManipulationCatalogEntry, extra: Partial<Parameters<typeof proposeAttemptCandidates>[0]> = {}) => proposeAttemptCandidates({
        command: 'put cloth on tray',
        attempts: [attemptFor(relationSkeleton, 'put cloth on tray')],
        spanPools: new Map([['cupRef', pool('cloth', clothId)], ['trayRef', pool('tray', trayId)]]),
        catalog: [entry, table, catalog[1]!],
        noAssignmentReason: 'none',
        actorRoom: roomA,
        ...extra,
    })
    const candidatesOf = (result: ReturnType<typeof proposeAttemptCandidates>) => {
        if (!result.ok) {
            throw new Error(result.reason)
        }
        return result.candidates
    }
    const clothSpan = (candidate: ReturnType<typeof candidatesOf>[number]) => candidate.attempt.actions()[0]?.referents()[0]

    it('offers each position and the whole where the actor\'s own position does not pick one', () => {
        const candidates = candidatesOf(propose(drapedCloth))

        expect(candidates.map(({ viewAnswers }) => viewAnswers)).toEqual([
            { cupRef: [hanging] },
            { cupRef: [lying] },
            { cupRef: 'whole' },
        ])
        expect(candidates.map(({ viewLabels }) => viewLabels)).toEqual([
            { cupRef: 'the cloth in the room' },
            { cupRef: 'the cloth on the table' },
            { cupRef: 'both parts of the cloth' },
        ])
    })

    it('stamps the chosen position as the referent\'s view, and every own binding for the whole', () => {
        const [hangingCandidate, lyingCandidate, wholeCandidate] = candidatesOf(propose(drapedCloth))

        expect(clothSpan(hangingCandidate!)).toEqual(expect.objectContaining({ groundedId: clothId, view: [hanging] }))
        expect(clothSpan(lyingCandidate!)).toEqual(expect.objectContaining({ view: [lying] }))
        expect(clothSpan(wholeCandidate!)).toEqual(expect.objectContaining({ view: [hanging, lying] }))
    })

    it('does not ask where the actor\'s own position picks one, and stamps that position as the view', () => {
        const candidates = candidatesOf(propose(acrossRooms))

        expect(candidates).toHaveLength(1)
        expect(candidates[0]).not.toHaveProperty('viewAnswers')
        expect(clothSpan(candidates[0]!)).toEqual(expect.objectContaining({ view: [hanging] }))
    })

    it('offers the parts and not the whole where the object is what a mover lands on', () => {
        // "put cup on cloth": the cloth is the destination of the move, which lands under one part of it.
        const result = propose(drapedCloth, { spanPools: new Map([['cupRef', pool('cup', cupId)], ['trayRef', pool('cloth', clothId)]]), catalog: [drapedCloth, table, catalog[0]!], attempts: [attemptFor(relationSkeleton, 'put cup on cloth')] })
        const candidates = candidatesOf(result)

        expect(candidates.map(({ viewAnswers }) => viewAnswers)).toEqual([{ trayRef: [hanging] }, { trayRef: [lying] }])
        expect(candidates.map(({ viewLabels }) => viewLabels)).toEqual([{ trayRef: 'the cloth in the room' }, { trayRef: 'the cloth on the table' }])
    })

    it('stamps an object\'s one position as its view when it is at the actor\'s', () => {
        const oneBinding: ObjectManipulationCatalogEntry = { ...drapedCloth, placement: [{ host: clothId, bindings: [drapedCloth.placement![0]!.bindings[0]!] }] }

        expect(clothSpan(candidatesOf(propose(oneBinding))[0]!)).toEqual(expect.objectContaining({ view: [hanging] }))
    })

    it('never offers a position out of the actor\'s reach: with one part here and two elsewhere, it is meant here unasked', () => {
        const elsewhere: ObjectManipulationCatalogEntry = {
            ...drapedCloth,
            placement: [{ host: clothId, bindings: [
                drapedCloth.placement![0]!.bindings[0]!,
                { presence: lying, under: [{ host: roomB, presence: roomBinding }], rooms: [roomB] },
                { presence: 'PRESENCE#far' as EphemeraPresenceNodeId, under: [{ host: tableId, presence: tableBinding }], rooms: [roomB] },
            ] }],
        }
        const candidates = candidatesOf(propose(elsewhere))

        expect(candidates).toHaveLength(1)
        expect(candidates[0]).not.toHaveProperty('viewAnswers')
        expect(clothSpan(candidates[0]!)).toEqual(expect.objectContaining({ view: [hanging] }))
    })

    it('counts a part the actor holds as at the actor\'s position, and names it in the actor\'s hands', () => {
        const actor = 'CHARACTER#Tess' as const
        const heldAndHere: ObjectManipulationCatalogEntry = {
            ...drapedCloth,
            placement: [{ host: clothId, bindings: [
                drapedCloth.placement![0]!.bindings[0]!,
                // The room's cache holds no character, so the held part's walk upward reaches no room.
                { presence: lying, under: [{ host: actor, presence: 'PRESENCE#Base' as EphemeraPresenceNodeId }], rooms: [] },
            ] }],
        }

        // Not knowing the actor, only the part in the room is at its position, and it is meant unasked.
        const [unknownActor, ...more] = candidatesOf(propose(heldAndHere))
        expect(more).toEqual([])
        expect(clothSpan(unknownActor!)).toEqual(expect.objectContaining({ view: [hanging] }))
        expect(candidatesOf(propose(heldAndHere, { actorCharacter: actor })).map(({ viewLabels }) => viewLabels)).toEqual([
            { cupRef: 'the cloth in the room' },
            { cupRef: 'the cloth in your hands' },
            { cupRef: 'both parts of the cloth' },
        ])
    })

    it('does not ask without an actor\'s room, or for an entry with no placement', () => {
        expect(candidatesOf(propose(drapedCloth, { actorRoom: undefined }))).toHaveLength(1)
        const { placement, ...bare } = drapedCloth
        expect(candidatesOf(propose(bare))).toHaveLength(1)
    })

    it('narrows a resumed command to the position it was answered with', () => {
        const [only, ...rest] = candidatesOf(propose(drapedCloth, { viewAnswers: { cupRef: [lying] } }))

        expect(rest).toEqual([])
        expect(only!.viewAnswers).toEqual({ cupRef: [lying] })
        expect(clothSpan(only!)).toEqual(expect.objectContaining({ view: [lying] }))
    })

    it('narrows a resumed command answered with the whole to the whole, every own binding', () => {
        const [only, ...rest] = candidatesOf(propose(drapedCloth, { viewAnswers: { cupRef: 'whole' } }))

        expect(rest).toEqual([])
        expect(clothSpan(only!)).toEqual(expect.objectContaining({ view: [hanging, lying] }))
    })

    it.each<[string, ObjectManipulationCatalogEntry]>([
        ['a position the object no longer has', { ...drapedCloth, placement: [{ host: clothId, bindings: [drapedCloth.placement![0]!.bindings[0]!, { presence: 'PRESENCE#gone' as EphemeraPresenceNodeId, under: [{ host: tableId, presence: tableBinding }], rooms: [roomA] }] }] }],
        ['an object whose position now picks itself', acrossRooms],
    ])('refuses a stale answer: %s', (_label, entry) => {
        const result = propose(entry, { viewAnswers: { cupRef: [lying] } })

        expect(result).toEqual({ ok: false, reason: expect.stringContaining('no longer available'), stale: true })
    })

    it('names each candidate\'s referents by where they sit, for telling same-named options apart', () => {
        const [first] = candidatesOf(propose(drapedCloth))
        const [unasked] = candidatesOf(propose(acrossRooms))

        expect(first!.placeNames).toEqual({ cupRef: 'the cloth in the room', trayRef: 'tray' })
        expect(unasked!.placeNames).toEqual({ cupRef: 'the cloth in the room', trayRef: 'tray' })
    })
})

describe('proposeAttemptCandidates', () => {
    it('grounds the step and describes it, keeping today\'s Consult wording', () => {
        const attempt = attemptFor(relationSkeleton, 'put cup on tray')
        const result = proposeAttemptCandidates({
            command: 'put cup on tray',
            attempts: [attempt],
            spanPools: new Map([['cupRef', pool('cup', cupId)], ['trayRef', pool('tray', trayId)]]),
            catalog,
            noAssignmentReason: 'none',
        })

        expect(result.ok).toBe(true)
        if (!result.ok) {
            return
        }
        expect(result.candidates).toHaveLength(1)
        const [candidate] = result.candidates
        expect(candidate.alternative).toEqual({ label: 'cup / tray', proposedCommand: 'put the cup on the tray' })
        expect(attemptReferentAnswers(candidate.attempt)).toEqual({ cupRef: cupId, trayRef: trayId })
        const [action] = candidate.attempt.actions()
        expect(action.describe()).toBe('Put cup on tray')
        expect(action.referents()).toEqual([
            expect.objectContaining({ referentType: 'objectSpan', groundedId: cupId, shortName: 'cup' }),
            expect.objectContaining({ referentType: 'currentHost' }),
            expect.objectContaining({ referentType: 'objectSpan', groundedId: trayId, shortName: 'tray' }),
        ])
    })

    it('keeps the Plan action\'s id on every identity candidate grounded from it', () => {
        const otherCupId = 'OBJECT#OtherCup' as EphemeraObjectId
        const attempt = attemptFor(relationSkeleton, 'put cup on tray')
        const twoCups: SpanCandidatePool = {
            span: 'cup',
            candidates: [cupId, otherCupId].map((id) => ({ id, label: 'cup', jointRelevance: 1, sourceTags: ['exact' as const], locus: { kind: 'room' as const } })),
        }
        const result = proposeAttemptCandidates({
            command: 'put cup on tray',
            attempts: [attempt],
            spanPools: new Map([['cupRef', twoCups], ['trayRef', pool('tray', trayId)]]),
            catalog: [...catalog, { objectId: otherCupId, normalizedShortName: 'cup', catalogScope: 'room' }],
            noAssignmentReason: 'none',
        })

        expect(result.ok).toBe(true)
        if (!result.ok) {
            return
        }
        expect(result.candidates).toHaveLength(2)
        const [planAction] = attempt.actions()
        expect(result.candidates.map((candidate) => candidate.attempt.actions()[0]?.id)).toEqual([planAction.id, planAction.id])
    })

    it('stamps each identity candidate\'s span with the presence its own catalog entry was seen in', () => {
        const otherCupId = 'OBJECT#OtherCup' as EphemeraObjectId
        const roomId = 'ROOM#Kitchen' as EphemeraRoomId
        const shelfBinding = 'PRESENCE#shelf-in-kitchen' as EphemeraPresenceNodeId
        const attempt = attemptFor(relationSkeleton, 'put cup on tray')
        const twoCups: SpanCandidatePool = {
            span: 'cup',
            candidates: [cupId, otherCupId].map((id) => ({ id, label: 'cup', jointRelevance: 1, sourceTags: ['exact' as const], locus: { kind: 'room' as const } })),
        }
        const result = proposeAttemptCandidates({
            command: 'put cup on tray',
            attempts: [attempt],
            spanPools: new Map([['cupRef', twoCups], ['trayRef', pool('tray', trayId)]]),
            catalog: [
                { objectId: cupId, normalizedShortName: 'cup', catalogScope: 'room', presence: [roomId] },
                { objectId: otherCupId, normalizedShortName: 'cup', catalogScope: 'room', presence: [{ host: 'OBJECT#Shelf' as EphemeraObjectId, presence: shelfBinding }] },
                { objectId: trayId, normalizedShortName: 'tray', catalogScope: 'room' },
            ],
            noAssignmentReason: 'none',
        })

        expect(result.ok).toBe(true)
        if (!result.ok) {
            return
        }
        const cupSpans = result.candidates.map((candidate) => candidate.attempt.actions()[0]?.referents()[0])
        expect(cupSpans).toEqual(expect.arrayContaining([
            expect.objectContaining({ groundedId: cupId, groundedPresence: [roomId] }),
            expect.objectContaining({ groundedId: otherCupId, groundedPresence: [{ host: 'OBJECT#Shelf' as EphemeraObjectId, presence: shelfBinding }] }),
        ]))
        const traySpan = result.candidates[0]?.attempt.actions()[0]?.referents()[2]
        expect(traySpan).toEqual(expect.objectContaining({ groundedId: trayId }))
        expect(traySpan).not.toHaveProperty('groundedPresence')
    })

    it('never binds two distinct span keys of one step to the same object', () => {
        const sameObject = attemptFor([
            { type: 'text', text: 'put' },
            { type: 'objectSpan', span: 'cup', stableRefKey: 'cupRef' },
            { type: 'text', text: 'on' },
            { type: 'objectSpan', span: 'cup', stableRefKey: 'cupRef2' },
        ], 'put cup on cup')

        const result = proposeAttemptCandidates({
            command: 'put cup on cup',
            attempts: [sameObject],
            spanPools: new Map([['cupRef', pool('cup', cupId)], ['cupRef2', pool('cup', cupId)]]),
            catalog,
            noAssignmentReason: 'no pairing',
        })

        expect(result).toEqual({ ok: false, reason: 'no pairing' })
    })

    it('builds each candidate from its own attempt, so two attempts sharing a span key never pool their actions', () => {
        // No real skeleton yields two attempts today (the templates are disjoint), so the pair is hand-built.
        const putOnTray = attemptFor(relationSkeleton, 'put cup on tray')
        const takeCup = attemptFor([
            { type: 'text', text: 'take' },
            { type: 'objectSpan', span: 'cup', stableRefKey: 'cupRef' },
        ], 'take cup')

        const result = proposeAttemptCandidates({
            command: 'put cup on tray',
            attempts: [putOnTray, takeCup],
            spanPools: new Map([['cupRef', pool('cup', cupId)], ['trayRef', pool('tray', trayId)]]),
            catalog,
            noAssignmentReason: 'none',
        })

        expect(result.ok).toBe(true)
        if (!result.ok) {
            return
        }
        // One assignment (cupRef and trayRef each have one candidate), one candidate per attempt.
        expect(result.candidates.map((candidate) => candidate.attempt.actions().map((action) => action.describe()))).toEqual([
            ['Put cup on tray'],
            ['Take: cup'],
        ])
        expect(result.candidates.map((candidate) => candidate.alternative)).toEqual([
            { label: 'cup / tray', proposedCommand: 'put the cup on the tray' },
            { objectId: cupId, label: 'cup', proposedCommand: 'take the cup' },
        ])
    })

    it('reads the joint assignment off each grounded attempt, one key per span', () => {
        const secondCupId = 'OBJECT#Cup2' as EphemeraObjectId
        const result = proposeAttemptCandidates({
            command: 'put cup on tray',
            attempts: [attemptFor(relationSkeleton, 'put cup on tray')],
            spanPools: new Map([
                ['cupRef', { ...pool('cup', cupId), candidates: [pool('cup', cupId).candidates[0]!, pool('cup', secondCupId).candidates[0]!] }],
                ['trayRef', pool('tray', trayId)],
            ]),
            catalog: [...catalog, { objectId: secondCupId, normalizedShortName: 'cup', catalogScope: 'room' }],
            noAssignmentReason: 'none',
        })

        expect(result.ok).toBe(true)
        if (!result.ok) {
            return
        }
        expect(result.candidates.map((candidate) => attemptReferentAnswers(candidate.attempt))).toEqual([
            { cupRef: cupId, trayRef: trayId },
            { cupRef: secondCupId, trayRef: trayId },
        ])
    })

    it('abstains with the keyed-pool wording when a referent has no pool', () => {
        const result = proposeAttemptCandidates({
            command: 'put cup on tray',
            attempts: [attemptFor(relationSkeleton, 'put cup on tray')],
            spanPools: new Map([['cupRef', pool('cup', cupId)]]),
            catalog,
            noAssignmentReason: 'none',
        })

        expect(result).toEqual({ ok: false, reason: 'No resolution supplied for stableRefKey "trayRef"' })
    })
})

describe('a spread (keepFrom)', () => {
    const spreadSkeleton: ParseSkeleton = [
        { type: 'text', text: 'spread' },
        { type: 'objectSpan', span: 'cup', stableRefKey: 'cupRef' },
        { type: 'text', text: 'on' },
        { type: 'objectSpan', span: 'tray', stableRefKey: 'trayRef' },
    ]

    it('describes itself as a spread, and its Consult wording proposes a spread, not a put', () => {
        const result = proposeAttemptCandidates({
            command: 'spread cup on tray',
            attempts: [attemptFor(spreadSkeleton, 'spread cup on tray')],
            spanPools: new Map([['cupRef', pool('cup', cupId)], ['trayRef', pool('tray', trayId)]]),
            catalog,
            noAssignmentReason: 'none',
        })

        expect(result.ok).toBe(true)
        if (!result.ok) {
            return
        }
        const [candidate] = result.candidates
        expect(candidate!.alternative).toEqual({ label: 'cup / tray', proposedCommand: 'spread the cup on the tray' })
        const [extend, move] = candidate!.attempt.actions()
        expect(extend!.describe()).toBe('Extend cup')
        expect(move!.describe()).toBe('Spread cup on tray')
    })

    it('is left unexpanded: the object leaves nothing, so a tie it has gets no dissolve, where a take of it does', () => {
        const roomId = 'ROOM#Bridge' as EphemeraRoomId
        const ropeId = 'OBJECT#Rope' as EphemeraObjectId
        const postId = 'OBJECT#Post' as EphemeraObjectId
        const graph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Object' as const, universalKey: ropeId },
                { tag: 'Object' as const, universalKey: postId },
            ],
            edges: [{ tag: 'Relational', from: ropeId, to: postId, kind: 'Custom', relationLabel: 'is lashed to' }],
        })
        const rope = { referentType: 'objectSpan' as const, span: 'rope', stableRefKey: 'ropeRef', groundedId: ropeId }
        const transfer = (keepFrom: boolean) => new PositionAttemptAction('move', [], {
            kind: 'change',
            primitive: 'transferMembership',
            object: rope,
            from: currentHostRef({ referentType: 'objectSpan', span: 'rope', stableRefKey: 'ropeRef' }),
            to: { referentType: 'objectSpan', span: 'tray', stableRefKey: 'trayRef', groundedId: trayId },
            containment: 'On',
            ...(keepFrom ? { keepFrom: true as const } : {}),
        })
        const env = {
            getGraph: (hostId: string) => (hostId === roomId ? graph : undefined),
            getCurrentHost: (id: string) => (id === ropeId ? roomId : undefined),
            getMembershipContainers: () => [],
        }
        const expand = (keepFrom: boolean) => expandAndAdjudicateCandidates(
            [{ attempt: CommandAttempt.create('move rope', [transfer(keepFrom)]), confidence: 1, alternative: { label: 'rope', proposedCommand: 'move the rope' } }],
            env as never
        )[0]!.attempt.actions()

        expect(expand(false)).toHaveLength(2)
        const spreadActions = expand(true)
        expect(spreadActions).toHaveLength(1)
        expect(spreadActions[0]!.challenges()).toEqual([])
    })
})

describe('describe-only (look) grounding', () => {
    it('names the look by its grounded referent and keeps "Look at the" wording', () => {
        const look = attemptFor([
            { type: 'text', text: 'look' },
            { type: 'objectSpan', span: 'cup', stableRefKey: 'cupRef' },
        ], 'look cup')

        const result = proposeAttemptCandidates({
            command: 'look cup',
            attempts: [look],
            spanPools: new Map([['cupRef', pool('cup', cupId)]]),
            catalog,
            noAssignmentReason: 'none',
        })

        expect(result.ok).toBe(true)
        if (!result.ok) {
            return
        }
        const [candidate] = result.candidates
        expect(candidate.alternative).toEqual({ objectId: cupId, label: 'cup', proposedCommand: 'look at the cup' })
        expect(candidate.attempt.actions()[0].describe()).toBe('Look at the cup')
        expect(candidate.attempt.actions()[0].referents()).toEqual([
            expect.objectContaining({ groundedId: cupId, shortName: 'cup' }),
        ])
    })

})

describe('narration units through candidate building and Expansion', () => {
    const authoredUnit = (actionId: string): NarrationUnit => ({
        covers: [actionId],
        variants: [{ audience: { refs: ['cupRef'], phase: 'before' }, parts: [{ slot: 'actor' }, { text: ' moves ' }, { ref: 'cupRef' }] }],
    })

    it('keeps the Plan attempt\'s own narration units on every grounded candidate', () => {
        const planned = attemptFor(relationSkeleton, 'put cup on tray')
        const unit = authoredUnit(planned.actions()[0]!.id)
        const result = proposeAttemptCandidates({
            command: 'put cup on tray',
            attempts: [CommandAttempt.create(planned.words, planned.actions(), [unit])],
            spanPools: new Map([['cupRef', pool('cup', cupId)], ['trayRef', pool('tray', trayId)]]),
            catalog,
            noAssignmentReason: 'none',
        })

        expect(result.ok).toBe(true)
        if (!result.ok) {
            return
        }
        expect(result.candidates[0]?.attempt.narrationUnits()).toEqual([unit])
    })

    it('adds Expansion\'s dissolve units beside the attempt\'s own, rather than replacing them', () => {
        const roomId = 'ROOM#Bridge' as EphemeraRoomId
        const ropeId = 'OBJECT#Rope' as EphemeraObjectId
        const postId = 'OBJECT#Post' as EphemeraObjectId
        const graph = testLudicGraph(roomId, {
            nodes: [
                { tag: 'Object' as const, universalKey: ropeId },
                { tag: 'Object' as const, universalKey: postId },
            ],
            edges: [{ tag: 'Relational', from: ropeId, to: postId, kind: 'Custom', relationLabel: 'is lashed to' }],
        })
        const take = new PositionAttemptAction('take', [], {
            kind: 'change',
            primitive: 'transferMembership',
            object: { referentType: 'objectSpan', span: 'rope', stableRefKey: 'ropeRef', groundedId: ropeId },
            from: currentHostRef({ referentType: 'objectSpan', span: 'rope', stableRefKey: 'ropeRef' }),
            to: actingCharacterRef,
        }, 'Take: rope')
        const unit = authoredUnit('take')

        const [expanded] = expandAndAdjudicateCandidates(
            [{ attempt: CommandAttempt.create('take rope', [take], [unit]), confidence: 1, alternative: { label: 'rope', proposedCommand: 'take the rope' } }],
            {
                getGraph: (hostId) => (hostId === roomId ? graph : undefined),
                getCurrentHost: (id) => (id === ropeId ? roomId : undefined),
                getMembershipContainers: () => [],
            }
        )

        const [dissolve] = expanded!.attempt.actions()
        expect(expanded!.attempt.narrationUnits()).toEqual([
            unit,
            expect.objectContaining({ covers: [dissolve!.id] }),
        ])
    })
})

describe('disambiguationLabels over views', () => {
    const skeleton: ParseSkeleton = [
        { type: 'text', text: 'get' },
        { type: 'objectSpan', span: 'cloth', stableRefKey: 'clothRef' },
    ]

    it('treats two readings of one object as ambiguous, labelled by the part meant', () => {
        expect(disambiguationLabels(skeleton, [
            { answers: { clothRef: 'OBJECT#Cloth' }, views: { clothRef: ['PRESENCE#a' as EphemeraPresenceNodeId] }, names: { clothRef: 'the cloth on the table' } },
            { answers: { clothRef: 'OBJECT#Cloth' }, views: { clothRef: 'whole' }, names: { clothRef: 'both parts of the cloth' } },
        ])).toEqual(['the cloth on the table', 'both parts of the cloth'])
    })

    it('words the whole command where more than one referent is ambiguous', () => {
        const two: ParseSkeleton = [...skeleton, { type: 'text', text: 'from' }, { type: 'objectSpan', span: 'box', stableRefKey: 'boxRef' }]
        expect(disambiguationLabels(two, [
            { answers: { clothRef: 'OBJECT#Cloth', boxRef: 'OBJECT#Red' }, views: { clothRef: 'whole' }, names: { clothRef: 'both parts of the cloth', boxRef: 'red box' } },
            { answers: { clothRef: 'OBJECT#Cloth', boxRef: 'OBJECT#Blue' }, views: { clothRef: ['PRESENCE#a' as EphemeraPresenceNodeId] }, names: { clothRef: 'the cloth on the table', boxRef: 'blue box' } },
        ])).toEqual(['get both parts of the cloth from red box', 'get the cloth on the table from blue box'])
    })
})
