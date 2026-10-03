import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { CommandAttempt, type CommandAttemptData } from './index'
import type { AttemptActionData } from './action'
import type { ChallengeData } from './challenge'
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
    challenges,
    ...(desiredResultDescription !== undefined ? { desiredResultDescription } : {}),
})

describe('CommandAttempt', () => {
    describe('row 2 --- get gigantic boulder', () => {
        const data: CommandAttemptData = {
            words: 'get gigantic boulder',
            referents: [
                {
                    refKey: 'boulderRef',
                    id: boulderId,
                    shortName: 'a gigantic boulder',
                    gloss: 'granite, easily as tall as a person, half-sunk in the dirt',
                },
            ],
            actions: [positionAction([], "the boulder is in the character's possession")],
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
            referents: [
                { refKey: 'forkRef', id: forkId, shortName: 'a fork' },
                { refKey: 'plateRef', id: plateId, shortName: 'a plate' },
            ],
            actions: [positionAction([], 'the fork is to the left of the plate')],
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
        const referents: CommandAttemptData['referents'] = [
            {
                refKey: 'motorcycleRef',
                id: motorcycleId,
                shortName: 'a motorcycle',
                gloss: 'steel and rubber, about seven feet long, several hundred pounds',
            },
            {
                refKey: 'shoeboxRef',
                id: shoeboxId,
                shortName: 'a shoebox',
                gloss: 'cardboard, about a foot long, empty',
            },
        ]

        it("today's code detects no challenge and succeeds --- the bug CA-6 exists to fix", () => {
            const attempt = CommandAttempt.fromJSON({
                words: 'put motorcycle on shoebox',
                referents,
                actions: [positionAction([], 'the motorcycle is on the shoebox')],
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
                referents,
                actions: [positionAction([weightChallenge], 'the motorcycle is on the shoebox')],
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
            referents: [
                { refKey: 'ropeRef', id: ropeId, shortName: 'a coil of rope' },
            ],
            actions: [
                positionAction(
                    [
                        {
                            kind: 'customEdge',
                            id: 'ropeLashing',
                            edge: lashedEdge,
                            description: 'the rope is lashed to the post; that lashing must be undone.',
                        },
                    ],
                    'the rope is untied'
                ),
                positionAction([], 'taken'),
            ],
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
                referents: [{ refKey: 'ropeRef', id: ropeId, shortName: 'a coil of rope' }],
                actions: [
                    positionAction([{ kind: 'worldKnowledge', id: 'knot', description: 'the knot is tight' }], 'taken'),
                ],
            }).recordVerdict('knot', stalledVerdict)
            expect(() => attempt.result).toThrow(/neither proceeds nor refuses/)
        })
    })

    describe('prototype rule', () => {
        it('round-trips through toJSON/fromJSON', () => {
            const original = CommandAttempt.fromJSON({
                words: 'get rope',
                referents: [{ refKey: 'ropeRef', id: ropeId, shortName: 'a coil of rope' }],
                actions: [
                    positionAction(
                        [{ kind: 'worldKnowledge', id: 'taken', description: 'none', verdict: { kind: 'met' } }],
                        'taken'
                    ),
                ],
            })
            const roundTripped = CommandAttempt.fromJSON(original.toJSON())
            expect(roundTripped.toJSON()).toEqual(original.toJSON())
            expect(roundTripped.renderProse()).toEqual(original.renderProse())
        })
    })

    describe('NarrateAttemptAction (slice 4, AP-5)', () => {
        const narrateAction = (description?: string): AttemptActionData => ({
            kind: 'narrate',
            challenges: [],
            ...(description !== undefined ? { description } : {}),
        })

        it('round-trips through toJSON/fromJSON, with no challenges and no desiredResult', () => {
            const data: CommandAttemptData = {
                words: 'look at the cup',
                referents: [{ refKey: 'cupRef', id: forkId, shortName: 'a cup' }],
                actions: [narrateAction('Look at the cup')],
            }
            const attempt = CommandAttempt.fromJSON(data)
            expect(attempt.toJSON()).toEqual(data)
        })

        it('succeeds immediately, since it detects no challenge, with its description as the outcome', () => {
            const attempt = CommandAttempt.fromJSON({
                words: 'look at the cup',
                referents: [{ refKey: 'cupRef', id: forkId, shortName: 'a cup' }],
                actions: [narrateAction('Look at the cup')],
            })
            expect(attempt.result).toEqual({ status: 'succeeded', outcome: 'Look at the cup' })
        })
    })
})
