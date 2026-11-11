import { textHash } from '../textHash'
import { assembleDraft } from './assembleDraft'

describe('assembleDraft', () => {
    it('puts the core in the ask\'s slot, each read without one trailing newline, and hashes each part and the whole', () => {
        expect(assembleDraft('Role: ask.\n\n{{core}}\n\nTask: do it.\n', 'Reading the scene: core.\n')).toEqual({
            instructions: 'Role: ask.\n\nReading the scene: core.\n\nTask: do it.',
            hashes: {
                ask: textHash('Role: ask.\n\n{{core}}\n\nTask: do it.'),
                core: textHash('Reading the scene: core.'),
                instructions: textHash('Role: ask.\n\nReading the scene: core.\n\nTask: do it.'),
            },
        })
    })

    it('keeps a part\'s other trailing newlines, since only one is the file\'s', () => {
        expect(assembleDraft('{{core}}\n\n', 'core')).toMatchObject({ instructions: 'core\n' })
    })

    it.each([
        ['no slot', 'Role: ask.', 0],
        ['two slots', '{{core}}\n\n{{core}}', 2],
    ])('refuses an ask with %s', (_, ask, slots) => {
        expect(assembleDraft(ask, 'core')).toBe(`the ask's part must have exactly one {{core}} line, and has ${slots}`)
    })
})
