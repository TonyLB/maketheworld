import type { CommandAttemptData } from '.'
import { lookedAtObjectIdOf } from './lookedAtObjectId'

const narrate = (refKey: string) => ({
    kind: 'narrate' as const,
    id: 'narrate-1',
    referents: [{ referentType: 'objectSpan' as const, span: 'cup', stableRefKey: refKey }],
    challenges: [],
})

describe('lookedAtObjectIdOf', () => {
    it('names the object a plain look narrates', () => {
        const attempt: CommandAttemptData = {
            words: 'look cup',
            referents: [{ refKey: 'cupRef', id: 'OBJECT#Cup', shortName: 'cup' }],
            actions: [narrate('cupRef')],
            narrationUnits: [],
        }

        expect(lookedAtObjectIdOf(attempt)).toBe('OBJECT#Cup')
    })

    it('names the narrated object of a qualified look, not the qualifier\'s host listed first', () => {
        const attempt: CommandAttemptData = {
            words: 'look at the cup on the table',
            referents: [
                { refKey: 'tableRef', id: 'OBJECT#Table', shortName: 'table' },
                { refKey: 'cupRef', id: 'OBJECT#Cup', shortName: 'cup' },
            ],
            actions: [
                {
                    kind: 'position',
                    id: 'assert-1',
                    desiredResult: {
                        kind: 'assertion',
                        predicate: 'containedBy',
                        subject: { referentType: 'objectSpan', span: 'cup', stableRefKey: 'cupRef' },
                        object: { referentType: 'objectSpan', span: 'table', stableRefKey: 'tableRef' },
                        negate: false,
                    },
                    challenges: [],
                } as CommandAttemptData['actions'][number],
                narrate('cupRef'),
            ],
            narrationUnits: [],
        }

        expect(lookedAtObjectIdOf(attempt)).toBe('OBJECT#Cup')
    })

    it('is undefined for a world change: its primary action does not narrate', () => {
        const attempt: CommandAttemptData = {
            words: 'take cup',
            referents: [{ refKey: 'cupRef', id: 'OBJECT#Cup', shortName: 'cup' }],
            actions: [{ kind: 'position', id: 'take-1', challenges: [] }],
            narrationUnits: [],
        }

        expect(lookedAtObjectIdOf(attempt)).toBeUndefined()
    })
})
