import name from './name.js'
import { SET_NAME } from '../actions/name.js'

describe('Name reducer', () => {
    it('should return an empty string by default', () => {
        expect(name()).toEqual('')
    })

    it('should replace an empty string', () => {
        expect(name('', {
            type: SET_NAME,
            payload: 'Test'
        })).toEqual('Test')
    })

    it('should replace an existing name', () => {
        expect(name('Test', {
            type: SET_NAME,
            payload: 'Test2'
        })).toEqual('Test2')
    })
})
