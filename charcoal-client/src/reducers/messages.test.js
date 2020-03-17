import messages from './messages.js'
import { RECEIVE_MESSAGE } from '../actions/messages.js'

describe('Messages reducer', () => {
    it('should return an empty array by default', () => {
        expect(messages()).toEqual([])
    })

    it('should add an element to an empty array', () => {
        expect(messages([], {
            type: RECEIVE_MESSAGE,
            payload: 'Test'
        })).toEqual(['Test'])
    })

    it('should append an element to an existing array', () => {
        expect(messages(['Test1', 'Test2'], {
            type: RECEIVE_MESSAGE,
            payload: 'Test3'
        })).toEqual(['Test1', 'Test2', 'Test3'])
    })
})
