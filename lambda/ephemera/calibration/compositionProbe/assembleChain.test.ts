import { textHash } from '../textHash'
import { assembleChain } from './assembleChain'

const FILES: Record<string, string> = { 'play.txt': 'The play ask.\n', 'outcomes.txt': 'The outcomes ask.\n\n{{core}}\n', 'core.txt': 'The core.\n' }
const read = (path: string): string => FILES[path]
const PIECES = ['--piece', 'playByPlay', 'play.txt', '-', '--piece', 'consequences', 'outcomes.txt', 'core.txt']

describe('assembleChain', () => {
    it('gives the payload and each draft\'s hashes, with three repeats by default', () => {
        expect(assembleChain(['out.json', ...PIECES, '--mocks', 'judge'], read)).toEqual({
            out: 'out.json',
            payload: {
                type: 'CompositionProbe',
                pieces: { playByPlay: { instructions: 'The play ask.' }, consequences: { instructions: 'The outcomes ask.\n\nThe core.' } },
                mocks: ['judge'],
                repeats: 3,
                model: 'NovaMicro',
            },
            drafts: [
                { piece: 'playByPlay', ask: 'play.txt', core: '-', draft: { instructions: 'The play ask.', hashes: { ask: textHash('The play ask.'), core: 'none', instructions: textHash('The play ask.') } } },
                { piece: 'consequences', ask: 'outcomes.txt', core: 'core.txt', draft: expect.objectContaining({ instructions: 'The outcomes ask.\n\nThe core.' }) },
            ],
        })
    })

    it('takes the cases, repeats, model and each piece\'s options', () => {
        expect(assembleChain(['out.json', ...PIECES, '--mocks', 'judge', '--cases', 'OC-6,OC-20', '--repeats', '1', '--model', 'Nova2Lite', '--options', 'consequences', '{"scene":"explicit"}'], read)).toMatchObject({
            payload: { cases: ['OC-6', 'OC-20'], repeats: 1, model: 'Nova2Lite', pieces: { consequences: { options: { scene: 'explicit' } } } },
        })
    })

    it.each<[string, string[], RegExp]>([
        ['no output path', PIECES, /^usage:/],
        ['an unknown flag', ['out.json', '--pieces', 'x'], /^--pieces isn't a flag/],
        ['a flag short of values', ['out.json', '--piece', 'playByPlay', 'play.txt', '--mocks', 'judge'], /^--piece takes 3 values/],
        ['a piece given twice', ['out.json', ...PIECES, ...PIECES], /^--piece playByPlay is given twice/],
        ['options that are not JSON', ['out.json', ...PIECES, '--options', 'playByPlay', '{'], /^--options is not JSON/],
        ['options for a piece not given', ['out.json', ...PIECES, '--options', 'trial', '{}'], /^--options names trial/],
        ['a draft that doesn\'t assemble', ['out.json', '--piece', 'consequences', 'outcomes.txt', '-', '--mocks', 'judge'], /^outcomes.txt: with no core/],
        ['a payload the handler would refuse', ['out.json', ...PIECES, '--mocks', 'judge', '--repeats', '4'], /over the cap of 48/],
        ['repeats that are not a number', ['out.json', ...PIECES, '--mocks', 'judge', '--repeats', 'few'], /^repeats must be/],
    ])('refuses %s', (_, args, error) => {
        expect(assembleChain(args, read)).toMatch(error)
    })
})
