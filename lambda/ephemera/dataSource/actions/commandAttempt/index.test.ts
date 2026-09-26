import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { CommandAttempt, type CommandAttemptData } from './index'

const boulderId = 'OBJECT#Boulder1' as EphemeraObjectId
const forkId = 'OBJECT#Fork1' as EphemeraObjectId
const plateId = 'OBJECT#Plate1' as EphemeraObjectId
const motorcycleId = 'OBJECT#Motorcycle1' as EphemeraObjectId
const shoeboxId = 'OBJECT#Shoebox1' as EphemeraObjectId
const ropeId = 'OBJECT#Rope1' as EphemeraObjectId

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
            actions: [
                {
                    desiredResultDescription: "the boulder is in the character's possession",
                    challenges: [],
                },
            ],
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
            actions: [
                {
                    desiredResultDescription: 'the fork is to the left of the plate',
                    challenges: [],
                },
            ],
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
                actions: [
                    {
                        desiredResultDescription: 'the motorcycle is on the shoebox',
                        challenges: [],
                    },
                ],
            })
            expect(attempt.result).toEqual({
                status: 'succeeded',
                outcome: 'the motorcycle is on the shoebox',
            })
        })

        it('once a world-knowledge detector records an impossible verdict, the attempt refuses with its reason', () => {
            const pending = CommandAttempt.fromJSON({
                words: 'put motorcycle on shoebox',
                referents,
                actions: [
                    {
                        desiredResultDescription: 'the motorcycle is on the shoebox',
                        challenges: [
                            {
                                description: 'the motorcycle might be too heavy for the shoebox to bear',
                                verdict: 'pending',
                            },
                        ],
                    },
                ],
            })
            expect(pending.result).toEqual({ status: 'pending' })

            const adjudicated = pending.recordVerdict(
                0,
                0,
                'impossible',
                'putting the motorcycle on the shoebox is impossible --- a motorcycle far outweighs an empty shoebox.'
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
        const data: CommandAttemptData = {
            words: 'get rope',
            referents: [
                { refKey: 'ropeRef', id: ropeId, shortName: 'a coil of rope' },
            ],
            actions: [
                {
                    desiredResultDescription: 'the rope is untied',
                    challenges: [
                        {
                            description: 'the rope is lashed to the post; that lashing must be undone.',
                            verdict: 'pending',
                        },
                    ],
                },
                {
                    desiredResultDescription: 'taken',
                    challenges: [],
                },
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
            const attempt = CommandAttempt.fromJSON(data).recordVerdict(0, 0, 'met')
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

    describe('prototype rule', () => {
        it('round-trips through toJSON/fromJSON', () => {
            const original = CommandAttempt.fromJSON({
                words: 'get rope',
                referents: [{ refKey: 'ropeRef', id: ropeId, shortName: 'a coil of rope' }],
                actions: [
                    {
                        desiredResultDescription: 'taken',
                        challenges: [{ description: 'none', verdict: 'met' }],
                    },
                ],
            })
            const roundTripped = CommandAttempt.fromJSON(original.toJSON())
            expect(roundTripped.toJSON()).toEqual(original.toJSON())
            expect(roundTripped.renderProse()).toEqual(original.renderProse())
        })
    })
})
