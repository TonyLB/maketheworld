import type { EphemeraObjectId, EphemeraPresenceNodeId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { CommandAttempt, type CommandAttemptData } from './index'
import type { AttemptActionData } from './action'
import type { ChallengeData } from './challenge'
import type { PlanStep, Referent } from '../enrich/objectManipulation/plan/planStep'
import { PositionAttemptAction } from './action'
import { MetVerdict, ImpossibleVerdict, type Verdict } from './verdict'
import type { HostRelationalEdge } from '../../positions/ludicGraph/baseClasses'

const boulderId = 'OBJECT#Boulder1' as EphemeraObjectId
const forkId = 'OBJECT#Fork1' as EphemeraObjectId
const plateId = 'OBJECT#Plate1' as EphemeraObjectId
const motorcycleId = 'OBJECT#Motorcycle1' as EphemeraObjectId
const shoeboxId = 'OBJECT#Shoebox1' as EphemeraObjectId
const ropeId = 'OBJECT#Rope1' as EphemeraObjectId
const postId = 'OBJECT#Post1' as EphemeraObjectId

const positionAction = (challenges: ChallengeData[], desiredResultDescription?: string): AttemptActionData => ({
    kind: 'position',
    id: 'action-1',
    challenges,
    ...(desiredResultDescription !== undefined ? { desiredResultDescription } : {}),
})

/** A span referent as Grounding leaves it: keyed, identified, and named for the prose. */
const span = (refKey: string, id: EphemeraObjectId, shortName: string, gloss?: string): Referent => ({
    referentType: 'objectSpan',
    span: shortName,
    stableRefKey: refKey,
    groundedId: id,
    shortName,
    ...(gloss !== undefined ? { gloss } : {}),
})

/** A narration carrying the referents its prose names (the look route's shape). */
const narrateAction = (referents: Referent[], challenges: ChallengeData[], description?: string): AttemptActionData => ({
    kind: 'narrate',
    id: 'action-2',
    challenges,
    referents,
    ...(description !== undefined ? { description } : {}),
})

describe('CommandAttempt', () => {
    describe('row 2 --- get gigantic boulder', () => {
        const data: CommandAttemptData = {
            words: 'get gigantic boulder',
            referents: [],
            actions: [narrateAction(
                [span('boulderRef', boulderId, 'a gigantic boulder', 'granite, easily as tall as a person, half-sunk in the dirt')],
                [],
                "the boulder is in the character's possession"
            )],
            narrationUnits: [],
        }

        it('renders the six-section prose', () => {
            const attempt = CommandAttempt.fromJSON(data)
            expect(attempt.renderProse()).toEqual([
                "Player's words: get gigantic boulder",
                '',
                'Referents:',
                '- boulderRef -> OBJECT#Boulder1, a gigantic boulder, gloss: granite, easily as tall as a person, half-sunk in the dirt',
                '',
                'State: (none)',
                '',
                'Room context: (none)',
                '',
                'Actions:',
                "- desired result: the boulder is in the character's possession",
                '  challenges: none detected',
                '',
                "Result: succeeded: the boulder is in the character's possession",
            ].join('\n'))
        })

        it('has no challenges to adjudicate, so it succeeds with no verdict recorded', () => {
            const attempt = CommandAttempt.fromJSON(data)
            expect(attempt.result).toEqual({
                status: 'succeeded',
                outcome: "the boulder is in the character's possession",
            })
        })
    })

    describe('row 3 --- place fork to the left of plate', () => {
        const data: CommandAttemptData = {
            words: 'place fork to the left of plate',
            referents: [],
            actions: [narrateAction(
                [span('forkRef', forkId, 'a fork'), span('plateRef', plateId, 'a plate')],
                [],
                'the fork is to the left of the plate'
            )],
            narrationUnits: [],
        }

        it('renders referents with no gloss and succeeds with no challenge', () => {
            const attempt = CommandAttempt.fromJSON(data)
            expect(attempt.renderProse()).toEqual([
                "Player's words: place fork to the left of plate",
                '',
                'Referents:',
                '- forkRef -> OBJECT#Fork1, a fork',
                '- plateRef -> OBJECT#Plate1, a plate',
                '',
                'State: (none)',
                '',
                'Room context: (none)',
                '',
                'Actions:',
                '- desired result: the fork is to the left of the plate',
                '  challenges: none detected',
                '',
                'Result: succeeded: the fork is to the left of the plate',
            ].join('\n'))
        })
    })

    describe('row 5 --- put motorcycle on shoebox', () => {
        const referents: Referent[] = [
            span('motorcycleRef', motorcycleId, 'a motorcycle', 'steel and rubber, about seven feet long, several hundred pounds'),
            span('shoeboxRef', shoeboxId, 'a shoebox', 'cardboard, about a foot long, empty'),
        ]

        it("today's code detects no challenge and succeeds --- the bug CA-6 exists to fix", () => {
            const attempt = CommandAttempt.fromJSON({
                words: 'put motorcycle on shoebox',
                referents: [],
                actions: [narrateAction(referents, [], 'the motorcycle is on the shoebox')],
                narrationUnits: [],
            })
            expect(attempt.result).toEqual({
                status: 'succeeded',
                outcome: 'the motorcycle is on the shoebox',
            })
        })

        it('once a world-knowledge detector records an impossible verdict, the attempt refuses with its reason', () => {
            const weightChallenge: ChallengeData = {
                kind: 'worldKnowledge',
                id: 'motorcycleWeightVsShoebox',
                description: 'the motorcycle might be too heavy for the shoebox to bear',
            }
            const pending = CommandAttempt.fromJSON({
                words: 'put motorcycle on shoebox',
                referents: [],
                actions: [narrateAction(referents, [weightChallenge], 'the motorcycle is on the shoebox')],
                narrationUnits: [],
            })
            expect(pending.result).toEqual({ status: 'pending' })

            const adjudicated = pending.recordVerdict(
                'motorcycleWeightVsShoebox',
                new ImpossibleVerdict(
                    'putting the motorcycle on the shoebox is impossible --- a motorcycle far outweighs an empty shoebox.'
                )
            )
            expect(adjudicated.result).toEqual({
                status: 'impossible',
                reason: 'putting the motorcycle on the shoebox is impossible --- a motorcycle far outweighs an empty shoebox.',
            })
            expect(adjudicated.renderProse()).toContain(
                'Result: impossible: putting the motorcycle on the shoebox is impossible --- a motorcycle far outweighs an empty shoebox.'
            )
            // recordVerdict is pure: the original attempt is untouched.
            expect(pending.result).toEqual({ status: 'pending' })
        })
    })

    describe("row 6 --- get rope (rope lashed to a post)", () => {
        const lashedEdge: HostRelationalEdge = {
            from: ropeId,
            to: postId,
            kind: 'Custom',
            relationLabel: 'is lashed to',
        }

        const data: CommandAttemptData = {
            words: 'get rope',
            referents: [],
            actions: [
                {
                    kind: 'narrate',
                    id: 'action-3',
                    referents: [span('ropeRef', ropeId, 'a coil of rope')],
                    description: 'the rope is untied',
                    challenges: [
                        {
                            kind: 'customEdge',
                            id: 'ropeLashing',
                            edge: lashedEdge,
                            description: 'the rope is lashed to the post; that lashing must be undone.',
                        },
                    ],
                },
                positionAction([], 'taken'),
            ],
            narrationUnits: [],
        }

        it('is pending before adjudication, with the dissolve challenge phrased off the relation label', () => {
            const attempt = CommandAttempt.fromJSON(data)
            expect(attempt.result).toEqual({ status: 'pending' })
            expect(attempt.renderProse()).toContain(
                '  - the rope is lashed to the post; that lashing must be undone. (pending)'
            )
        })

        it('succeeds once Coyote preparation records every challenge as met', () => {
            const attempt = CommandAttempt.fromJSON(data).recordVerdict('ropeLashing', new MetVerdict())
            expect(attempt.result).toEqual({
                status: 'succeeded',
                outcome: 'the rope is untied and taken',
            })
            expect(attempt.renderProse()).toContain('Result: succeeded: the rope is untied and taken')
        })

        it('renders room context when a scope function supplies one', () => {
            const attempt = CommandAttempt.fromJSON(data)
            const prose = attempt.renderProse({
                hostShortName: 'ROOM#Dock',
                nodes: ['"a coil of rope"', '"a wooden post"'],
                edges: ['"a coil of rope" is lashed to "a wooden post"'],
            })
            expect(prose).toContain(
                'Room context: ROOM#Dock --- nodes: "a coil of rope", "a wooden post". Edges: "a coil of rope" is lashed to "a wooden post".'
            )
        })
    })

    describe('result fold', () => {
        it('never reports success for a verdict that neither proceeds nor refuses', () => {
            // Stand-in for a future member such as `failed`: success must require every
            // verdict to proceed, not merely that none refuses.
            const stalledVerdict: Verdict = {
                kind: 'met',
                proceeds: () => false,
                refuses: () => false,
                narrationDetail: () => undefined,
                resultText: () => 'stalled',
                toJSON: () => ({ kind: 'met' }),
            }
            const attempt = CommandAttempt.fromJSON({
                words: 'get rope',
                referents: [],
                actions: [
                    narrateAction(
                        [span('ropeRef', ropeId, 'a coil of rope')],
                        [{ kind: 'worldKnowledge', id: 'knot', description: 'the knot is tight' }],
                        'taken'
                    ),
                ],
                narrationUnits: [],
            }).recordVerdict('knot', stalledVerdict)
            expect(() => attempt.result).toThrow(/neither proceeds nor refuses/)
        })
    })

    describe('narration units', () => {
        it('round-trips through toJSON/fromJSON, distinct from the actions that carry no narration unit of their own', () => {
            const data: CommandAttemptData = {
                words: 'take the rope',
                referents: [],
                actions: [{ ...positionAction([], 'taken'), id: 'action-10' }],
                narrationUnits: [{
                    covers: ['action-10'],
                    variants: [
                        {
                            audience: { refs: [ropeId], phase: 'before' },
                            parts: [{ slot: 'actor' }, { text: ' picks up ' }, { ref: ropeId }],
                        },
                    ],
                }],
            }
            const attempt = CommandAttempt.fromJSON(data)
            expect(attempt.narrationUnits()).toEqual(data.narrationUnits)
            expect(attempt.toJSON()).toEqual(data)

            const roundTripped = CommandAttempt.fromJSON(attempt.toJSON())
            expect(roundTripped.narrationUnits()).toEqual(data.narrationUnits)
        })

        it('carries narrationUnits through recordVerdict', () => {
            const data: CommandAttemptData = {
                words: 'take the rope',
                referents: [],
                actions: [{ ...positionAction([{ kind: 'worldKnowledge', id: 'knot', description: 'none' }], 'taken'), id: 'action-11' }],
                narrationUnits: [{
                    covers: ['action-11'],
                    variants: [{
                        audience: { refs: [ropeId], phase: 'before' },
                        parts: [{ slot: 'actor' }, { text: ' picks up ' }, { ref: ropeId }],
                    }],
                }],
            }
            const attempt = CommandAttempt.fromJSON(data).recordVerdict('knot', new MetVerdict())
            expect(attempt.narrationUnits()).toEqual(data.narrationUnits)
        })
    })

    describe('prototype rule', () => {
        it('round-trips through toJSON/fromJSON', () => {
            const original = CommandAttempt.fromJSON({
                words: 'get rope',
                referents: [],
                actions: [
                    narrateAction(
                        [span('ropeRef', ropeId, 'a coil of rope')],
                        [{ kind: 'worldKnowledge', id: 'taken', description: 'none', verdict: { kind: 'met' } }],
                        'taken'
                    ),
                ],
                narrationUnits: [],
            })
            const roundTripped = CommandAttempt.fromJSON(original.toJSON())
            expect(roundTripped.toJSON()).toEqual(original.toJSON())
            expect(roundTripped.renderProse()).toEqual(original.renderProse())
        })
    })

    describe('action ids', () => {
        it('keeps each action\'s id through recordVerdict, grounded() and the JSON round trip', () => {
            const attempt = CommandAttempt.fromJSON({
                words: 'get rope',
                referents: [],
                actions: [
                    { ...narrateAction([span('ropeRef', ropeId, 'a coil of rope')], []), id: 'narrate-1' },
                    { ...positionAction([{ kind: 'worldKnowledge', id: 'knot', description: 'none' }], 'taken'), id: 'position-1' },
                ],
                narrationUnits: [],
            }).recordVerdict('knot', new MetVerdict())
            expect(attempt.actions().map((action) => action.id)).toEqual(['narrate-1', 'position-1'])
            expect(attempt.actions().map((action) => action.grounded(new Map()).id)).toEqual(['narrate-1', 'position-1'])
            expect(CommandAttempt.fromJSON(attempt.toJSON()).actions().map((action) => action.id)).toEqual(['narrate-1', 'position-1'])
        })
    })

    describe('referent presence', () => {
        it('keeps each referent\'s groundedPresence through recordVerdict, withChallenges, grounded() and the JSON round trip', () => {
            const boxBinding = 'PRESENCE#box-in-room' as EphemeraPresenceNodeId
            const roomId = 'ROOM#Kitchen' as EphemeraRoomId
            const desiredResult: PlanStep = {
                kind: 'change',
                primitive: 'dissolveRelation',
                subject: { referentType: 'objectSpan', span: 'rope', stableRefKey: 'ropeRef', groundedId: ropeId, groundedPresence: [{ host: 'OBJECT#Box' as EphemeraObjectId, presence: boxBinding }] },
                target: { referentType: 'graphNode', groundedId: forkId, groundedPresence: [roomId] },
                relationKind: 'Custom',
                relationLabel: 'is lashed to',
            }
            const attempt = CommandAttempt.fromJSON({
                words: 'get rope',
                referents: [],
                actions: [{ kind: 'position', id: 'position-1', challenges: [{ kind: 'worldKnowledge', id: 'knot', description: 'none' }], desiredResult }],
                narrationUnits: [],
            }).recordVerdict('knot', new MetVerdict())
            const [action] = attempt.actions()
            expect(action?.desiredResult).toEqual(desiredResult)
            expect(action?.withChallenges([]).desiredResult).toEqual(desiredResult)
            expect(action?.grounded(new Map()).desiredResult).toEqual(desiredResult)
            expect(CommandAttempt.fromJSON(attempt.toJSON()).actions()[0]?.desiredResult).toEqual(desiredResult)
        })
    })

    describe('NarrateAttemptAction', () => {
        it('round-trips through toJSON/fromJSON, with its referents, no challenges and no desiredResult', () => {
            const data: CommandAttemptData = {
                words: 'look at the cup',
                referents: [{ refKey: 'cupRef', id: forkId, shortName: 'a cup' }],
                actions: [narrateAction([span('cupRef', forkId, 'a cup')], [], 'Look at the cup')],
                narrationUnits: [],
            }
            const attempt = CommandAttempt.fromJSON(data)
            expect(attempt.toJSON()).toEqual(data)
        })

        it('succeeds immediately, since it detects no challenge, with its description as the outcome', () => {
            const attempt = CommandAttempt.fromJSON({
                words: 'look at the cup',
                referents: [],
                actions: [narrateAction([span('cupRef', forkId, 'a cup')], [], 'Look at the cup')],
                narrationUnits: [],
            })
            expect(attempt.result).toEqual({ status: 'succeeded', outcome: 'Look at the cup' })
        })
    })

    describe('referents are derived from the actions', () => {
        it('lists each keyed, named span once, in order of first appearance, and nothing ungrounded', () => {
            const attempt = CommandAttempt.fromJSON({
                words: 'put cup on cup',
                referents: [],
                actions: [{
                    kind: 'position',
                    id: 'action-4',
                    desiredResult: {
                        kind: 'change',
                        primitive: 'transferMembership',
                        object: span('subject', forkId, 'a cup'),
                        from: { referentType: 'currentHost', referentTarget: span('subject', forkId, 'a cup') },
                        to: { referentType: 'objectSpan', span: 'plate', stableRefKey: 'target' },
                        containment: 'On',
                    } as never,
                    challenges: [],
                }],
                narrationUnits: [],
            })
            expect(attempt.referents()).toEqual([{ refKey: 'subject', id: forkId, shortName: 'a cup' }])
        })

        it('does not list a span that Grounding has not yet named', () => {
            const attempt = CommandAttempt.create('put cup on plate', [new PositionAttemptAction('action-5', [], {
                kind: 'change',
                primitive: 'transferMembership',
                object: { referentType: 'objectSpan', span: 'cup', stableRefKey: 'subject' },
                from: { referentType: 'actingCharacter' },
                to: { referentType: 'objectSpan', span: 'plate', stableRefKey: 'target' },
            })])
            expect(attempt.referents()).toEqual([])
        })
    })
})
