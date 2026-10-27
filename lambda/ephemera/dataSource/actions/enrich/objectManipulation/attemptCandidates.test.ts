import type { EphemeraCharacterId, EphemeraObjectId, EphemeraPresenceNodeId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import { attemptDryRun, attemptReferentAnswers, attemptSpanKeys, buildAttemptEnvironment, disambiguationLabels, expandAndAdjudicateCandidates, proposeAttemptCandidates } from './attemptCandidates'
import type { ObjectManipulationCatalogEntry } from './catalogMerge'
import { planFillOf } from './plan/attemptTemplateFixture'
import type { ParseSkeleton } from './parse/parseToken'
import type { SpanCandidatePool } from './spanResolution'
import { CommandAttempt } from '../../commandAttempt'
import type { NarrationUnit } from '../../commandAttempt'
import { PositionAttemptAction } from '../../commandAttempt/action'
import { testLudicGraph } from '../../../positions/ludicGraph/testFixtures'
import { actingCharacterRef, currentHostRef } from './plan/planStep'
import { COMMAND_GRANULES, planTokens } from './plan/planSkeleton'
import { tokenize } from '../../deterministicTemplate/granuleTokens'
import { navigationIntentErrorMessages } from '../../discriminateIntent/exitResolution'
import type { ContainedByAssertion } from './plan/planStep'

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
    return planFillOf(skeleton, command).attempts[0]!
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
            { type: 'objectSpan', span: 'cup', stableRefKey: 'cupRef1' },
            { type: 'text', text: 'on' },
            { type: 'objectSpan', span: 'cup', stableRefKey: 'cupRef2' },
        ], 'put cup on cup')

        const result = proposeAttemptCandidates({
            command: 'put cup on cup',
            attempts: [sameObject],
            spanPools: new Map([['cupRef1', pool('cup', cupId)], ['cupRef2', pool('cup', cupId)]]),
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

describe('a spread (extend, then a move of the minted binding)', () => {
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

    it('is left unexpanded: a move of the minted binding leaves nothing, so a tie gets no dissolve, where a move of the rope does', () => {
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
        const extend = new PositionAttemptAction('extend', [], { kind: 'change', primitive: 'extend', object: rope, presenceUuid: 'fresh' })
        const transfer = (minted: boolean) => new PositionAttemptAction('move', [], {
            kind: 'change',
            primitive: 'transferMembership',
            object: minted ? { ...rope, view: ['PRESENCE#fresh' as EphemeraPresenceNodeId] } : rope,
            from: currentHostRef({ referentType: 'objectSpan', span: 'rope', stableRefKey: 'ropeRef' }),
            to: { referentType: 'objectSpan', span: 'tray', stableRefKey: 'trayRef', groundedId: trayId },
            containment: 'On',
        })
        const env = {
            getGraph: (hostId: string) => (hostId === roomId ? graph : undefined),
            getCurrentHost: (id: string) => (id === ropeId ? roomId : undefined),
            getMembershipContainers: () => [],
        }
        const expand = (minted: boolean) => expandAndAdjudicateCandidates(
            [{ attempt: CommandAttempt.create('spread', 'move rope', minted ? [extend, transfer(true)] : [transfer(false)]), confidence: 1, alternative: { label: 'rope', proposedCommand: 'move the rope' } }],
            env as never
        )[0]!.attempt.actions()

        expect(expand(false)).toHaveLength(2)
        const spreadActions = expand(true)
        expect(spreadActions).toHaveLength(2)
        expect(spreadActions.map((action) => action.challenges())).toEqual([[], []])
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
            attempts: [CommandAttempt.create(planned.kind, planned.words, planned.actions(), [unit])],
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
            [{ attempt: CommandAttempt.create('membership', 'take rope', [take], [unit]), confidence: 1, alternative: { label: 'rope', proposedCommand: 'take the rope' } }],
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
        expect(disambiguationLabels([
            { answers: { clothRef: 'OBJECT#Cloth' }, views: { clothRef: ['PRESENCE#a' as EphemeraPresenceNodeId] }, names: { clothRef: 'the cloth on the table' }, skeleton },
            { answers: { clothRef: 'OBJECT#Cloth' }, views: { clothRef: 'whole' }, names: { clothRef: 'both parts of the cloth' }, skeleton },
        ])).toEqual(['the cloth on the table', 'both parts of the cloth'])
    })

    it('words the whole command where more than one referent is ambiguous', () => {
        const two: ParseSkeleton = [...skeleton, { type: 'text', text: 'from' }, { type: 'objectSpan', span: 'box', stableRefKey: 'boxRef' }]
        expect(disambiguationLabels([
            { answers: { clothRef: 'OBJECT#Cloth', boxRef: 'OBJECT#Red' }, views: { clothRef: 'whole' }, names: { clothRef: 'both parts of the cloth', boxRef: 'red box' }, skeleton: two },
            { answers: { clothRef: 'OBJECT#Cloth', boxRef: 'OBJECT#Blue' }, views: { clothRef: ['PRESENCE#a' as EphemeraPresenceNodeId] }, names: { clothRef: 'the cloth on the table', boxRef: 'blue box' }, skeleton: two },
        ])).toEqual(['get both parts of the cloth from red box', 'get the cloth on the table from blue box'])
    })
})

describe('a qualifier\'s containedBy assertion, judged in the dry run', () => {
    // Hand-built: no template emits an assertion yet. "get the cup on the table" is [check, take].
    const roomId = 'ROOM#Cafe' as EphemeraRoomId
    const actor = 'CHARACTER#Tess' as EphemeraCharacterId
    const tableId = 'OBJECT#Table' as EphemeraObjectId
    const tableCupId = 'OBJECT#TableCup' as EphemeraObjectId
    const floorCupId = 'OBJECT#FloorCup' as EphemeraObjectId
    const clothId = 'OBJECT#Cloth' as EphemeraObjectId
    const hanging = 'PRESENCE#hanging' as EphemeraPresenceNodeId
    const lying = 'PRESENCE#lying' as EphemeraPresenceNodeId

    const table: ObjectManipulationCatalogEntry = { objectId: tableId, normalizedShortName: 'table', catalogScope: 'room' }
    const cups: ObjectManipulationCatalogEntry[] = [
        { objectId: tableCupId, normalizedShortName: 'cup', catalogScope: 'room' },
        { objectId: floorCupId, normalizedShortName: 'cup', catalogScope: 'room' },
    ]
    const cloth: ObjectManipulationCatalogEntry = {
        objectId: clothId,
        normalizedShortName: 'cloth',
        catalogScope: 'room',
        placement: [{ host: clothId, bindings: [
            { presence: hanging, under: [{ host: roomId, presence: 'PRESENCE#room' as EphemeraPresenceNodeId }], rooms: [roomId] },
            { presence: lying, under: [{ host: tableId, presence: 'PRESENCE#table' as EphemeraPresenceNodeId }], rooms: [roomId] },
        ] }],
    }
    const hostsOf: Record<string, EphemeraMembershipHostId[]> = {
        [tableId]: [roomId],
        [tableCupId]: [tableId],
        [floorCupId]: [roomId],
        [clothId]: [roomId, tableId],
    }
    const reads = {
        getMembershipContainers: jest.fn(async (id: string) => hostsOf[id] ?? []),
        getLudicGraph: jest.fn(async (hostId: string) => testLudicGraph(hostId as EphemeraRoomId)),
    }

    const qualifiedTake = (span: string, overrides: Partial<ContainedByAssertion> = {}): CommandAttempt => {
        const take = attemptFor([{ type: 'text', text: 'get' }, { type: 'objectSpan', span, stableRefKey: `${span}Ref` }], `get ${span}`).actions()[0]!
        const check = new PositionAttemptAction('qualifier', [], {
            kind: 'assertion',
            predicate: 'containedBy',
            subject: { referentType: 'objectSpan', span, stableRefKey: `${span}Ref` },
            object: { referentType: 'objectSpan', span: 'table', stableRefKey: 'tableRef' },
            negate: false,
            relation: 'On',
            ...overrides,
        })
        return CommandAttempt.create('membership', `get the ${span} on the table`, [check, take])
    }

    const dryRuns = async (span: string, subjects: ObjectManipulationCatalogEntry[], overrides: Partial<ContainedByAssertion> = {}) => {
        const subjectPool: SpanCandidatePool = {
            span,
            candidates: subjects.map(({ objectId }) => ({ id: objectId, label: span, jointRelevance: 1, sourceTags: ['exact' as const], locus: { kind: 'room' as const } })),
        }
        const catalogHere = [...subjects, table]
        const proposed = proposeAttemptCandidates({
            command: `get the ${span} on the table`,
            attempts: [qualifiedTake(span, overrides)],
            spanPools: new Map([[`${span}Ref`, subjectPool], ['tableRef', pool('table', tableId)]]),
            catalog: catalogHere,
            noAssignmentReason: 'none',
            actorRoom: roomId,
            actorCharacter: actor,
        })
        if (!proposed.ok) {
            throw new Error(proposed.reason)
        }
        const env = await buildAttemptEnvironment(proposed.candidates, roomId, testLudicGraph(roomId), reads, catalogHere)
        return proposed.candidates.map((candidate) => ({
            candidate,
            outcome: attemptDryRun(candidate, env, { roomId, actorCharacterId: actor }),
        }))
    }
    const subjectIdOf = (candidate: Awaited<ReturnType<typeof dryRuns>>[number]['candidate']) => attemptReferentAnswers(candidate.attempt).cupRef

    it('keeps the cup on the table and refuses the cup on the floor, naming host and subject', async () => {
        const results = await dryRuns('cup', cups)

        expect(results.map(({ candidate, outcome }) => [subjectIdOf(candidate), outcome.verdict, outcome.reason])).toEqual([
            [tableCupId, 'legal', undefined],
            [floorCupId, 'illegal', 'The table has no cup.'],
        ])
    })

    it('still runs the take after a met check: the plan is the take\'s transfer', async () => {
        const [met] = await dryRuns('cup', cups)

        expect(met!.outcome.plan?.steps).toEqual([expect.objectContaining({ kind: 'transferMembership' })])
    })

    it('judges every binding of the view: the cloth\'s part on the table passes, its hanging part and the whole fail', async () => {
        const results = await dryRuns('cloth', [cloth])

        expect(results.map(({ candidate, outcome }) => [candidate.viewAnswers?.clothRef, outcome.verdict, outcome.reason])).toEqual([
            [[hanging], 'illegal', 'The table has no cloth.'],
            [[lying], 'legal', undefined],
            ['whole', 'illegal', 'The table has no cloth.'],
        ])
    })

    it('flips the verdict when negated', async () => {
        const results = await dryRuns('cup', cups, { negate: true })

        expect(results.map(({ candidate, outcome }) => [subjectIdOf(candidate), outcome.verdict, outcome.reason])).toEqual([
            [tableCupId, 'illegal', 'The table has the cup.'],
            [floorCupId, 'legal', undefined],
        ])
    })

    it('describes the check, worded from its relation, and keeps the take as the candidate\'s primary', async () => {
        const [{ candidate }] = await dryRuns('cup', [cups[0]!])
        const fromTable = (await dryRuns('cup', [cups[0]!], { relation: undefined }))[0]!.candidate

        expect(candidate.attempt.actions().map((action) => action.describe())).toEqual(['Check: cup on table', 'Take: cup'])
        expect(fromTable.attempt.actions()[0]!.describe()).toBe('Check: cup at table')
        expect(candidate.alternative).toEqual({ objectId: tableCupId, label: 'cup', proposedCommand: 'take the cup' })
    })
})

describe('a navigation (an exit span, grounded to the room it leads to)', () => {
    const northRoom = 'ROOM#North' as EphemeraRoomId
    const atticRoom = 'ROOM#Attic' as EphemeraRoomId
    const readingsOf = (command: string) => planTokens(tokenize(COMMAND_GRANULES, command), command).flatMap(({ attempts }) => attempts)
    const exitPool = (span: string, ...ids: EphemeraRoomId[]): SpanCandidatePool => ({
        span,
        candidates: ids.map((id) => ({ id, label: span, jointRelevance: 1, sourceTags: ['exact'], locus: { kind: 'room' } })),
    })
    const propose = (command: string, spanPools: Map<string, SpanCandidatePool>, extra: Partial<Parameters<typeof proposeAttemptCandidates>[0]> = {}) => proposeAttemptCandidates({
        command,
        attempts: readingsOf(command),
        spanPools,
        catalog,
        noAssignmentReason: 'no assignment',
        ...extra,
    })

    it('grounds the exit to its room, named by the exit, and words it as going there', () => {
        const result = propose('north', new Map([['northExitRef', exitPool('north', northRoom)]]))
        if (!result.ok) {
            throw new Error(result.reason)
        }
        expect(result.candidates).toHaveLength(1)
        const [candidate] = result.candidates
        expect(candidate.attempt.kind).toBe('navigation')
        expect(candidate.attempt.referents()).toEqual([{ refKey: 'northExitRef', id: northRoom, shortName: 'north' }])
        expect(candidate.attempt.actions()[0]!.describe()).toBe('Go north')
        expect(candidate.alternative).toEqual({ label: 'north', proposedCommand: 'go north' })
    })

    it('drops only the reading whose exit grounds nothing: the take beside it stands', () => {
        const result = propose('take cup', new Map([['cupRef', pool('cup', cupId)], ['takeCupExitRef', exitPool('take cup')]]))
        if (!result.ok) {
            throw new Error(result.reason)
        }
        expect(result.candidates.map(({ attempt }) => attempt.kind)).toEqual(['membership'])
    })

    it('abstains with the empty span\'s wording when every reading reads a span that grounds nothing', () => {
        expect(propose('north', new Map([['northExitRef', exitPool('north')]]))).toEqual({ ok: false, reason: 'No candidates found for span "north"' })
    })

    it('refuses a resumed answer whose span grounds nothing now as stale, not as a dropped reading', () => {
        const result = propose('take cup', new Map([['cupRef', pool('cup', cupId)], ['takeCupExitRef', exitPool('take cup')]]), {
            referentAnswers: { takeCupExitRef: northRoom },
        })
        expect(result).toMatchObject({ ok: false, stale: true })
    })

    describe('the dry run judges that the exit is here, and leads to one room', () => {
        const candidatesFor = (...ids: EphemeraRoomId[]) => {
            const result = propose('north', new Map([['northExitRef', exitPool('north', ...ids)]]))
            if (!result.ok) {
                throw new Error(result.reason)
            }
            return result.candidates
        }

        it('is legal, with nothing to run, when the exit leads to the room it grounded to', () => {
            const [candidate] = candidatesFor(northRoom)
            expect(attemptDryRun(candidate!, undefined, { exits: [{ normalizedName: 'north', targetId: northRoom }] })).toEqual({ verdict: 'legal', decidable: true })
        })

        it('is illegal when no exit here leads there (the world changed since Identify, or no exits)', () => {
            const [candidate] = candidatesFor(northRoom)
            expect(attemptDryRun(candidate!, undefined, { exits: [] })).toEqual({ verdict: 'illegal', decidable: true, reason: navigationIntentErrorMessages.noMatch })
        })

        it('is illegal on every reading when the name leads to two rooms: the ambiguity is the answer', () => {
            const exits = [{ normalizedName: 'north', targetId: northRoom }, { normalizedName: 'north', targetId: atticRoom }]
            expect(candidatesFor(northRoom, atticRoom).map((candidate) => attemptDryRun(candidate, undefined, { exits }))).toEqual([
                { verdict: 'illegal', decidable: true, reason: navigationIntentErrorMessages.ambiguousMatch },
                { verdict: 'illegal', decidable: true, reason: navigationIntentErrorMessages.ambiguousMatch },
            ])
        })
    })
})
