import {
    ACTIVATE_CONFIRM_DIALOG,
    CLOSE_CONFIRM_DIALOG,
} from '../../actions/UI/confirmDialog'
import reducer from './confirmDialog'

const testOne = {
    title: 'Test',
    content: 'Are you sure you want to test?',
    resolveButtonTitle: 'Test',
    resolve: () => {}
}

const testTwo = {
    title: 'Another test',
    content: 'Even after what happened last time?',
    resolveButtonTitle: "I know what I'm doing!",
    resolve: () => {}
}

describe('ConfirmDialog reducer', () => {
    it('should generate an empty state', () => {
        expect(reducer()).toEqual([])
    })

    it('should do nothing on close for an empty stack', () => {
        expect(reducer([], { type: CLOSE_CONFIRM_DIALOG })).toEqual([])
    })

    it('should do nothing on a no-op', () => {
        expect(reducer([testOne], { type: 'NO-OP' })).toEqual([testOne])
    })

    it('should pop the stack on close', () => {
        expect(reducer([testOne, testTwo], { type: CLOSE_CONFIRM_DIALOG })).toEqual([testTwo])
    })

    it('should pop a single-element stack correctly', () => {
        expect(reducer([testTwo], { type: CLOSE_CONFIRM_DIALOG })).toEqual([])
    })

    it('should push an item onto the stack', () => {
        expect(reducer([testOne], {
            type: ACTIVATE_CONFIRM_DIALOG,
            ...testTwo
        })).toEqual([testOne, testTwo])
    })

    it('should push an item onto an empty stack', () => {
        expect(reducer([], {
            type: ACTIVATE_CONFIRM_DIALOG,
            ...testOne
        })).toEqual([testOne])
    })
})
