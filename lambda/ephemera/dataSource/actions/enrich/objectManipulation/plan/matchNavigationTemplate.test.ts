import { tokenize } from '../../../deterministicTemplate/granuleTokens'
import { NavigateAttemptAction } from '../../../commandAttempt/action'
import { isBareExitFill } from './matchNavigationTemplate'
import { COMMAND_GRANULES, planTokens } from './planSkeleton'

/** The navigation readings of a command: each one's segmentation, and the exit span it names. */
const navigationsOf = (command: string) => planTokens(tokenize(COMMAND_GRANULES, command), command)
    .flatMap(({ skeleton, attempts }) => attempts.filter(({ kind }) => kind === 'navigation').map((attempt) => ({
        segmentation: skeleton.map((token) => (token.type === 'objectSpan' ? `[${token.span}]` : token.text)).join(' '),
        destination: (attempt.actions()[0] as NavigateAttemptAction).destination,
    })))

describe('the navigation templates', () => {
    it.each(['go', 'head', 'walk', 'move', 'travel', 'enter'])('reads "%s north" as a movement verb and an exit span', (verb) => {
        expect(navigationsOf(`${verb} north`)).toContainEqual({
            segmentation: `${verb} [north]`,
            destination: { referentType: 'objectSpan', span: 'north', stableRefKey: 'northExitRef' },
        })
    })

    it('reads a bare exit name as the exit span alone', () => {
        expect(navigationsOf('north')).toEqual([{
            segmentation: '[north]',
            destination: { referentType: 'objectSpan', span: 'north', stableRefKey: 'northExitRef' },
        }])
    })

    it('reads a multi-word exit name as one span, merged across any fixed word in it', () => {
        expect(navigationsOf('go through the door').map(({ segmentation }) => segmentation)).toContain('go [through the door]')
        expect(navigationsOf('enter the box')).toContainEqual(expect.objectContaining({ segmentation: 'enter [the box]' }))
    })

    it('reads every command as a bare exit name too, whatever template else reads it', () => {
        expect(navigationsOf('take cup').map(({ segmentation }) => segmentation)).toEqual(['[take cup]'])
    })

    it('keys an exit span apart from an object span on the same words, and never shares a fill with one', () => {
        const fills = planTokens(tokenize(COMMAND_GRANULES, 'take cup'), 'take cup')
        const bare = fills.find(isBareExitFill)
        expect(bare?.skeleton).toEqual([{ type: 'objectSpan', span: 'take cup', stableRefKey: 'takeCupExitRef', catalog: 'exits' }])
        expect(fills.filter((fill) => !isBareExitFill(fill)).every(({ attempts }) => attempts.every(({ kind }) => kind !== 'navigation'))).toBe(true)
    })
})
