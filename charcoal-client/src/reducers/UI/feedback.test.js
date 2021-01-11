import feedback from './feedback.js'
import {
    FEEDBACK_PUSH_MESSAGE,
    FEEDBACK_POP_MESSAGE
} from '../../actions/UI/feedback'

const testState = ['One', 'Two', 'Three', 'Four']

describe('Feedback reducer', () => {
    it('should return an empty array by default', () => {
        expect(feedback()).toEqual([])
    })

    it('should return unchanged on a different action type', () => {
        expect(feedback(testState, { type: 'OTHER' })).toEqual(testState)
    })

    it('should add a message on FEEDBACK_PUSH_MESSAGE', () => {
        expect(feedback(testState, { type: FEEDBACK_PUSH_MESSAGE, message: 'Five' })).toEqual([
            'One', 'Two', 'Three', 'Four', 'Five'
        ])
    })

    it('should remove a message on FEEDBACK_POP_MESSAGE', () => {
        expect(feedback(testState, { type: FEEDBACK_POP_MESSAGE })).toEqual([
            'Two', 'Three', 'Four'
        ])
    })

})
