import { parseUpstreamOptions, pickPaired, pickStageInput, stageValueHash, type StageInput } from './stageInput'

describe('stageInput', () => {
    describe('the upstream option', () => {
        const shape = "options must be { upstream: 'golden' | 'lifted' }, named in every payload"
        it.each([
            [{ upstream: 'golden' }, { upstream: 'golden' }],
            [{ upstream: 'lifted' }, { upstream: 'lifted' }],
            [undefined, shape],
            [{}, shape],
            [{ upstream: 'both' }, shape],
            [{ upstream: 'golden', securing: 'omitted' }, shape],
            ['golden', shape],
        ])('parses %j, with no default', (value, parsed) => {
            expect(parseUpstreamOptions(value)).toEqual(parsed)
        })
    })

    describe('picking a source', () => {
        const both: StageInput<{ n: number }> = { golden: { value: { n: 1 }, note: 'hand-written' }, lifted: { value: { n: 2 }, source: 'batch 1, repeat 1' } }

        it('gives the named source\'s value', () => {
            expect(pickStageInput(both, 'golden')).toEqual({ n: 1 })
            expect(pickStageInput(both, 'lifted')).toEqual({ n: 2 })
        })

        it.each([
            [{ golden: both.golden }, 'lifted', 'no lifted value for this cell'],
            [{ lifted: both.lifted }, 'golden', 'no golden value for this cell'],
        ] as const)('throws when the cell has no value from that source: %j %s', (input, upstream, message) => {
            expect(() => pickStageInput(input, upstream)).toThrow(message)
        })

        it('throws when the value doesn\'t fit the current contract, as a missing one', () => {
            expect(() => pickStageInput(both, 'lifted', ({ n }) => (n > 1 ? 'n is over 1' : undefined))).toThrow('the lifted value doesn\'t fit the current contract: n is over 1')
            expect(pickStageInput(both, 'golden', ({ n }) => (n > 1 ? 'n is over 1' : undefined))).toEqual({ n: 1 })
        })
    })

    describe('pairing a later value with the earlier one it answered', () => {
        type Argument = { step: string; argument: string }
        const golden: Argument = { step: 'tip', argument: 'It falls.' }
        const arguments_: StageInput<Argument> = { golden: { value: golden }, lifted: { value: { step: 'tip', argument: 'It slides.' }, source: 'batch 2, repeat 1' } }
        const rebuttals: StageInput<string> = {
            golden: { value: 'But it holds.' },
            lifted: { value: 'But the scene says so.', source: 'batch 8, repeat 1', consumed: { upstream: 'golden', hash: stageValueHash(golden) } },
        }

        it('hashes a value regardless of its fields\' order', () => {
            expect(stageValueHash({ argument: 'It falls.', step: 'tip' })).toBe(stageValueHash(golden))
            expect(stageValueHash({ step: 'tip', argument: 'It slides.' })).not.toBe(stageValueHash(golden))
        })

        it('gives a lifted value with the value it consumed, from the source it names, whatever the payload\'s upstream', () => {
            expect(pickPaired(arguments_, rebuttals, 'lifted')).toEqual({ earlier: golden, later: 'But the scene says so.' })
        })

        it('gives golden all the way up', () => {
            expect(pickPaired(arguments_, rebuttals, 'golden')).toEqual({ earlier: golden, later: 'But it holds.' })
        })

        it('breaks loudly when the consumed value was edited since', () => {
            const edited: StageInput<Argument> = { ...arguments_, golden: { value: { step: 'tip', argument: 'It falls over.' } } }
            expect(() => pickPaired(edited, rebuttals, 'lifted')).toThrow(/answered a different golden value \(consumed [0-9a-f]{8}, now [0-9a-f]{8}\)/)
        })

        it('refuses a lifted value that records nothing consumed, and a missing source', () => {
            expect(() => pickPaired(arguments_, { lifted: { value: 'But.', source: 'batch 8' } }, 'lifted')).toThrow('records nothing it consumed')
            expect(() => pickPaired(arguments_, { lifted: rebuttals.lifted }, 'golden')).toThrow('no golden value for this cell')
            expect(() => pickPaired({ lifted: arguments_.lifted }, rebuttals, 'lifted')).toThrow('no golden value for this cell')
        })

        it('hashes only what the later stage read, so a field added since doesn\'t break the pair, and an edit to what it read still does', () => {
            type Grown = Argument & { blocking?: string }
            const read = ({ step, argument }: Grown) => ({ step, argument })
            const grown: StageInput<Grown> = { golden: { value: { ...golden, blocking: 'yes' } } }
            expect(() => pickPaired(grown, rebuttals, 'lifted')).toThrow(/answered a different golden value/)
            expect(pickPaired(grown, rebuttals, 'lifted', { read })).toEqual({ earlier: { ...golden, blocking: 'yes' }, later: 'But the scene says so.' })
            const edited: StageInput<Grown> = { golden: { value: { step: 'tip', argument: 'It falls over.', blocking: 'yes' } } }
            expect(() => pickPaired(edited, rebuttals, 'lifted', { read })).toThrow(/answered a different golden value/)
        })

        it('applies each side\'s fit to the current contract', () => {
            expect(() => pickPaired(arguments_, rebuttals, 'lifted', { later: () => 'too old' })).toThrow('the lifted value doesn\'t fit the current contract: too old')
        })
    })
})
