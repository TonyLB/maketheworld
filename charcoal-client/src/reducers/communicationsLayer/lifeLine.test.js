import { ESTABLISH_WEB_SOCKET_SUCCESS, DISCONNECT_WEB_SOCKET } from '../../actions/communicationsLayer/lifeLine/index.ts'
import lifeLine from './lifeLine'

describe('communicationsLayer/webSocket reducer', () => {
    const testState = {
        webSocket: 'ABC',
        pingInterval: 123,
        refreshTimeout: 456
    }
    it('should return default', () => {
        expect(lifeLine()).toEqual({})
    })
    it('should not change state on no-op', () => {
        expect(lifeLine(testState, { type: 'NO-OP' })).toEqual(testState)
    })
    it('should accept data on ESTABLISH_WEB_SOCKET_SUCCESS', () => {
        expect(lifeLine({
            ...testState
        }, {
            type: ESTABLISH_WEB_SOCKET_SUCCESS,
            payload: {
                webSocket: 'DEF',
                pingInterval: 321,
                refreshTimeout: 654
            }
        })).toEqual({
            webSocket: 'DEF',
            pingInterval: 321,
            refreshTimeout: 654        
        })
    })
    it('should disconnect on DISCONNECT_WEB_SOCKET', () => {
        expect(lifeLine(testState, { type: DISCONNECT_WEB_SOCKET })).toEqual({})
    })
})