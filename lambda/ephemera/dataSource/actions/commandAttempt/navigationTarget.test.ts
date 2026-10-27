import type { CommandAttemptData } from '.'
import { navigationTargetOf } from './navigationTarget'

const navigation = (destination: Record<string, unknown>): CommandAttemptData => ({
    kind: 'navigation',
    words: 'go north',
    referents: [],
    actions: [{ kind: 'navigate', id: 'action-1', destination: destination as never, challenges: [] }],
    narrationUnits: [],
})

describe('navigationTargetOf', () => {
    it('names the room the exit grounded to, and the exit', () => {
        expect(navigationTargetOf(navigation({ referentType: 'objectSpan', span: 'north', stableRefKey: 'northExitRef', groundedId: 'ROOM#North', shortName: 'north' })))
            .toEqual({ targetId: 'ROOM#North', exitName: 'north' })
    })

    it('is undefined for an ungrounded exit, a non-room id, or another kind of attempt', () => {
        expect(navigationTargetOf(navigation({ referentType: 'objectSpan', span: 'north', stableRefKey: 'northExitRef' }))).toBeUndefined()
        expect(navigationTargetOf(navigation({ referentType: 'objectSpan', span: 'north', groundedId: 'OBJECT#North' }))).toBeUndefined()
        expect(navigationTargetOf({ ...navigation({ referentType: 'objectSpan', span: 'north', groundedId: 'ROOM#North' }), kind: 'look' })).toBeUndefined()
    })
})
