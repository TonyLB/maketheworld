import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { deterministicIntentChecks } from './deterministicChecks'

describe('deterministicIntentChecks', () => {
    const northRoom = 'ROOM#north' as EphemeraRoomId

    it('returns CoyoteEngineTest for /test generation commands', () => {
        expect(deterministicIntentChecks({ command: '/test generation' })).toEqual({
            type: 'CoyoteEngineTest',
            confidence: 1,
        })
        expect(deterministicIntentChecks({ command: ' /TEST GENERATION CLUSTERING ' })).toEqual({
            type: 'CoyoteEngineTest',
            confidence: 1,
            harnessInvocation: {
                mode: 'partial',
                testOnly: 'candidates',
                harnessRunKind: 'runUntil',
            },
        })
        expect(deterministicIntentChecks({ command: ' /test generation runOnly planSelect 1 ' })).toEqual({
            type: 'CoyoteEngineTest',
            confidence: 1,
            harnessInvocation: {
                mode: 'partial',
                testOnly: 'planSelect',
                harnessRunKind: 'runOnly',
                fixtureIndex1Based: 1,
            },
        })
    })

    it('returns Parse error for invalid /test generation tails', () => {
        expect(deterministicIntentChecks({ command: '/test generation verbose' })?.type).toBe('Error')
        expect(deterministicIntentChecks({ command: '/test generation 99' })?.type).toBe('Error')
        expect(deterministicIntentChecks({ command: '/test generation planSelect 99' })?.type).toBe(
            'Error'
        )
        expect(deterministicIntentChecks({ command: '/test generation a b c' })?.type).toBe('Error')
    })

    it('returns CoyoteAffinitiesTest for valid /test affinities commands', () => {
        expect(deterministicIntentChecks({ command: '/test affinities' })).toEqual({
            type: 'CoyoteAffinitiesTest',
            confidence: 1,
        })
        expect(deterministicIntentChecks({ command: ' /test affinities 3 ' })).toEqual({
            type: 'CoyoteAffinitiesTest',
            confidence: 1,
            harnessInvocation: {
                mode: 'full',
                fixtureIndex1Based: 3,
            },
        })
        expect(deterministicIntentChecks({ command: '/test affinities verbose' })).toEqual({
            type: 'CoyoteAffinitiesTest',
            confidence: 1,
            harnessInvocation: {
                mode: 'full',
                verbose: true,
            },
        })
        expect(deterministicIntentChecks({ command: '/test affinities verbose 3' })).toEqual({
            type: 'CoyoteAffinitiesTest',
            confidence: 1,
            harnessInvocation: {
                mode: 'full',
                fixtureIndex1Based: 3,
                verbose: true,
            },
        })
        expect(deterministicIntentChecks({ command: '/test affinities 3 verbose' })).toEqual({
            type: 'CoyoteAffinitiesTest',
            confidence: 1,
            harnessInvocation: {
                mode: 'full',
                fixtureIndex1Based: 3,
                verbose: true,
            },
        })
    })

    it('returns ObjectManipulationParseTest for valid /test parse commands', () => {
        expect(deterministicIntentChecks({ command: '/test parse' })).toEqual({
            type: 'ObjectManipulationParseTest',
            confidence: 1,
        })
        expect(deterministicIntentChecks({ command: ' /test parse 3 ' })).toEqual({
            type: 'ObjectManipulationParseTest',
            confidence: 1,
            harnessInvocation: { fixtureIndex1Based: 3 },
        })
        expect(deterministicIntentChecks({ command: '/test parse "get bag from table"' })).toEqual({
            type: 'ObjectManipulationParseTest',
            confidence: 1,
            harnessInvocation: { command: 'get bag from table' },
        })
    })

    it('returns Parse error for invalid /test parse tails', () => {
        expect(deterministicIntentChecks({ command: '/test parse 99' })).toEqual({
            type: 'Error',
            errorMessage: expect.stringContaining('out of range'),
        })
    })

    it('returns Parse error for invalid /test affinities tails', () => {
        const badToken = deterministicIntentChecks({ command: '/test affinities abc' })
        expect(badToken).toEqual({
            type: 'Error',
            errorMessage: expect.stringContaining('Unknown token "abc"'),
        })

        const zero = deterministicIntentChecks({ command: '/test affinities 0' })
        expect(zero).toEqual({
            type: 'Error',
            errorMessage: expect.stringContaining('Unknown token "0"'),
        })

        const negative = deterministicIntentChecks({ command: '/test affinities -1' })
        expect(negative).toEqual({
            type: 'Error',
            errorMessage: expect.stringContaining('Unknown token "-1"'),
        })

        const decimal = deterministicIntentChecks({ command: '/test affinities 1.5' })
        expect(decimal).toEqual({
            type: 'Error',
            errorMessage: expect.stringContaining('Unknown token "1.5"'),
        })

        const outOfRange = deterministicIntentChecks({ command: '/test affinities 99' })
        expect(outOfRange).toEqual({
            type: 'Error',
            errorMessage: expect.stringContaining('Fixture index must be an integer from 1 to 11 (received 99).'),
        })

        const unknownExtra = deterministicIntentChecks({ command: '/test affinities 1 extra' })
        expect(unknownExtra).toEqual({
            type: 'Error',
            errorMessage: expect.stringContaining('Unknown token "extra"'),
        })

        const tooManyArgs = deterministicIntentChecks({ command: '/test affinities 1 2 verbose' })
        expect(tooManyArgs).toEqual({
            type: 'Error',
            errorMessage: expect.stringContaining('Too many arguments'),
        })
    })

    it('returns LookRoom only for bare look aliases', () => {
        expect(deterministicIntentChecks({ command: 'look' })).toEqual({ type: 'LookRoom', confidence: 1 })
        expect(deterministicIntentChecks({ command: '  L  ' })).toEqual({ type: 'LookRoom', confidence: 1 })
        expect(deterministicIntentChecks({ command: 'look at door' })).toBeNull()
    })

    it('returns PredictHypothesis only for bare predict', () => {
        expect(deterministicIntentChecks({ command: 'predict' })).toEqual({ type: 'PredictHypothesis', confidence: 1 })
        expect(deterministicIntentChecks({ command: '  PREDICT  ' })).toEqual({ type: 'PredictHypothesis', confidence: 1 })
        expect(deterministicIntentChecks({ command: 'predict my plan' })).toBeNull()
        expect(deterministicIntentChecks({ command: 'p' })).toBeNull()
        expect(deterministicIntentChecks({ command: 'prediction' })).toBeNull()
    })

    it('returns Help only for bare help', () => {
        expect(deterministicIntentChecks({ command: 'help' })).toEqual({ type: 'Help', confidence: 1 })
        expect(deterministicIntentChecks({ command: '  HELP  ' })).toEqual({ type: 'Help', confidence: 1 })
        expect(deterministicIntentChecks({ command: 'help me' })).toBeNull()
    })

    it('returns Home only for bare home', () => {
        expect(deterministicIntentChecks({ command: 'home' })).toEqual({ type: 'Home', confidence: 1 })
        expect(deterministicIntentChecks({ command: '  HOME  ' })).toEqual({ type: 'Home', confidence: 1 })
        expect(deterministicIntentChecks({ command: 'go home' })).toBeNull()
    })

    it('returns deterministic Navigation for exact and go-prefixed exit names', () => {
        expect(deterministicIntentChecks({
            command: 'north',
            roomExits: [{ normalizedName: 'north', targetId: northRoom }],
        })).toEqual({ type: 'Navigation', targetId: northRoom, exitName: 'north', confidence: 1 })

        expect(deterministicIntentChecks({
            command: '  GO   NORTH  ',
            roomExits: [{ normalizedName: 'north', targetId: northRoom }],
        })).toEqual({ type: 'Navigation', targetId: northRoom, exitName: 'north', confidence: 1 })
    })

    it('returns null when deterministic navigation does not resolve', () => {
        expect(deterministicIntentChecks({
            command: 'go south',
            roomExits: [{ normalizedName: 'north', targetId: northRoom }],
        })).toBeNull()
        expect(deterministicIntentChecks({ command: 'go north' })).toBeNull()
    })

    describe('manipulation fast paths', () => {
        it('returns ObjectMembershipIntent for minimal take/drop/get verbs', () => {
            expect(deterministicIntentChecks({ command: 'take broom' })).toEqual({
                type: 'ObjectMembershipIntent',
                skeletons: [[{ type: 'text', text: 'take' }, { type: 'objectSpan', span: 'broom' }]],
                confidence: 1,
            })
            expect(deterministicIntentChecks({ command: '  DROP   the rope  ' })).toEqual({
                type: 'ObjectMembershipIntent',
                skeletons: [[{ type: 'text', text: 'DROP' }, { type: 'objectSpan', span: 'the rope' }]],
                confidence: 1,
            })
            expect(deterministicIntentChecks({
                command: 'get broom',
                roomObjectLabels: ['broom'],
            })).toEqual({
                type: 'ObjectMembershipIntent',
                skeletons: [[{ type: 'text', text: 'get' }, { type: 'objectSpan', span: 'broom' }]],
                confidence: 1,
            })
        })

        it('returns null for get when noun is not in object labels (Acme fall-through)', () => {
            expect(deterministicIntentChecks({
                command: 'get rocket skates',
                roomObjectLabels: ['broom'],
            })).toBeNull()
        })

        it('returns null for paraphrases and verb-only commands', () => {
            expect(deterministicIntentChecks({ command: 'pick up the broom' })).toBeNull()
            expect(deterministicIntentChecks({ command: 'take hold of the crate' })).toBeNull()
            expect(deterministicIntentChecks({ command: 'take' })).toBeNull()
            expect(deterministicIntentChecks({ command: 'drop' })).toBeNull()
            expect(deterministicIntentChecks({ command: 'get' })).toBeNull()
        })

        it('keeps articles on the span, and a get still claims through a peeled label', () => {
            expect(deterministicIntentChecks({ command: 'take an apple' })).toEqual({
                type: 'ObjectMembershipIntent',
                skeletons: [[{ type: 'text', text: 'take' }, { type: 'objectSpan', span: 'an apple' }]],
                confidence: 1,
            })
            expect(deterministicIntentChecks({
                command: 'get a broom',
                roomObjectLabels: ['broom'],
            })).toEqual({
                type: 'ObjectMembershipIntent',
                skeletons: [[{ type: 'text', text: 'get' }, { type: 'objectSpan', span: 'a broom' }]],
                confidence: 1,
            })
            expect(deterministicIntentChecks({ command: 'drop some rope' })).toEqual({
                type: 'ObjectMembershipIntent',
                skeletons: [[{ type: 'text', text: 'drop' }, { type: 'objectSpan', span: 'some rope' }]],
                confidence: 1,
            })
        })

        it('claims a get whose label starts with an article, matched whole', () => {
            expect(deterministicIntentChecks({
                command: 'get the thing',
                roomObjectLabels: ['the thing'],
            })).toEqual({
                type: 'ObjectMembershipIntent',
                skeletons: [[{ type: 'text', text: 'get' }, { type: 'objectSpan', span: 'the thing' }]],
                confidence: 1,
            })
        })

        it('preserves article-only spans instead of rejecting them', () => {
            expect(deterministicIntentChecks({ command: 'take a' })).toEqual({
                type: 'ObjectMembershipIntent',
                skeletons: [[{ type: 'text', text: 'take' }, { type: 'objectSpan', span: 'a' }]],
                confidence: 1,
            })
            expect(deterministicIntentChecks({ command: 'drop the' })).toEqual({
                type: 'ObjectMembershipIntent',
                skeletons: [[{ type: 'text', text: 'drop' }, { type: 'objectSpan', span: 'the' }]],
                confidence: 1,
            })
        })

        describe('a qualified tail yields every fill, each a flat skeleton (PA-2 (b))', () => {
            const fillsOf = (command: string, roomObjectLabels?: string[]) => {
                const result = deterministicIntentChecks({ command, ...(roomObjectLabels ? { roomObjectLabels } : {}) })
                return result?.type === 'ObjectMembershipIntent' ? result.skeletons : result
            }
            const text = (value: string) => ({ type: 'text', text: value })
            const span = (value: string) => ({ type: 'objectSpan', span: value })

            it('includes the cut at a closed-set preposition, keeping each piece as typed', () => {
                expect(fillsOf('take the cup on the table')).toContainEqual([text('take'), span('the cup'), text('on'), span('the table')])
            })

            it('includes the whole tail as a fill, so a room label holding a preposition can match whole, for get and take', () => {
                expect(fillsOf('get the man in the moon', ['man in the moon'])).toContainEqual([text('get'), span('the man in the moon')])
                expect(fillsOf('take the man in the moon', ['man in the moon'])).toContainEqual([text('take'), span('the man in the moon')])
            })

            it('includes misspelled pieces cut, and leaves them to Identify', () => {
                expect(fillsOf('take bagg from talbe')).toContainEqual([text('take'), span('bagg'), text('from'), span('talbe')])
            })

            it('claims a get when its head piece is a room label, not its qualifier', () => {
                expect(fillsOf('get cup on table', ['cup'])).toContainEqual([text('get'), span('cup'), text('on'), span('table')])
                expect(fillsOf('get cup on table', ['table'])).toBeNull()
            })

            it('does not claim get up or get out of here', () => {
                expect(fillsOf('get up', ['cup'])).toBeNull()
                expect(fillsOf('get out of here', ['cup'])).toBeNull()
            })

            it('includes a two-qualifier tail cut into three spans', () => {
                expect(fillsOf('take cup on saucer on table')).toContainEqual([
                    text('take'), span('cup'), text('on'), span('saucer'), text('on'), span('table'),
                ])
            })

            it('returns every way to cut the tail: no fill is chosen here, Identify and the dry run choose', () => {
                const fills = fillsOf('take cup on saucer on table')
                expect(fills).toHaveLength(4)
                expect(fills).toEqual(expect.arrayContaining([
                    [text('take'), span('cup on saucer on table')],
                    [text('take'), span('cup'), text('on'), span('saucer on table')],
                    [text('take'), span('cup on saucer'), text('on'), span('table')],
                    [text('take'), span('cup'), text('on'), span('saucer'), text('on'), span('table')],
                ]))
            })

            it('claims a get when any fill\'s head is a room label: the head cut at "from"', () => {
                expect(fillsOf('get man in the moon from table', ['man in the moon', 'table'])).toContainEqual(
                    [text('get'), span('man in the moon'), text('from'), span('table')]
                )
            })

            it('cuts a drop\'s tail like any other: the cut never reads the verb', () => {
                expect(fillsOf('drop the cup in the box')).toContainEqual([text('drop'), span('the cup'), text('in'), span('the box')])
            })

            it('folds a tail with no head, as before', () => {
                expect(fillsOf('take off the hat')).toEqual([[text('take'), span('off the hat')]])
            })

            it('leaves a trailing preposition in its span', () => {
                expect(fillsOf('take cup on')).toEqual([[text('take'), span('cup on')]])
            })

            it('cuts at the longest phrase: "on top of" as one preposition', () => {
                expect(fillsOf('take cup on top of table')).toContainEqual([text('take'), span('cup'), text('on top of'), span('table')])
            })

            it('cuts at a bare "out", as Plan\'s readings read the LLM route\'s bare "out"', () => {
                expect(fillsOf('take coin out box')).toContainEqual([text('take'), span('coin'), text('out'), span('box')])
            })

            it('cuts only at whole words: "on" inside "onion" is no cut', () => {
                expect(fillsOf('take onion on table')).toContainEqual([text('take'), span('onion'), text('on'), span('table')])
            })

            it.each(['cup under table', 'box of matches', 'cup onto table', 'coin into box'])('does not cut "take %s": the word is outside the closed set', (tail) => {
                expect(fillsOf(`take ${tail}`)).toEqual([[text('take'), span(tail)]])
            })

            it('keeps the verb and preposition as typed, spacing collapsed', () => {
                expect(fillsOf('Take Cup  On   Top  OF  Table')).toContainEqual([text('Take'), span('Cup'), text('On Top OF'), span('Table')])
            })

            // Nova Micro's recorded skeletons for these commands (two `/test parse` runs, 2026-10-23), for the rows whose spans carry no article.
            // Articles are left out: the fast path keeps them as typed, Nova Micro keeps or drops them, and Identify peels both.
            it.each<[string, string[], ReturnType<typeof text | typeof span>[]]>([
                ['get bag from table', ['bag'], [text('get'), span('bag'), text('from'), span('table')]],
                ['take cup off saucer', [], [text('take'), span('cup'), text('off'), span('saucer')]],
                ['take coin out of box', [], [text('take'), span('coin'), text('out of'), span('box')]],
            ])('builds the skeleton Nova Micro returns for "%s"', (command, labels, novaMicro) => {
                expect(fillsOf(command, labels)).toContainEqual(novaMicro)
            })
        })
    })
})
