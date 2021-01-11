import { getFirstFeedback } from './feedback.js'

describe('Feedback selectors', () => {
    describe('getFirstFeedback', () => {

        it('should return undefined on empty state', () => {
            expect(getFirstFeedback()).toBe(undefined)
        })

        it('should return undefined on empty array', () => {
            expect(getFirstFeedback({ UI: { feedback: [] }})).toBe(undefined)
        })

        it('should return first element in array', () => {
            expect(getFirstFeedback({ UI: {feedback: ['One', 'Two']}})).toBe('One')
        })

    })
})
