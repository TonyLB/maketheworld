import { parseUpstreamOptions, pickStageInput, type StageInput } from './stageInput'

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
})
