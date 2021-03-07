import { ESTABLISH_WEB_SOCKET_ATTEMPT, ESTABLISH_WEB_SOCKET_ERROR, ESTABLISH_WEB_SOCKET_SUCCESS, DISCONNECT_WEB_SOCKET } from '../../actions/communicationsLayer/webSocket.js'
import webSocket from './webSocket'

describe('communicationsLayer/webSocket reducer', () => {
    const testState = {
        webSocket: 'ABC',
        pingInterval: 123,
        refreshTimeout: 456,
        status: 'CONNECTED'
    }
    it('should return default', () => {
        expect(webSocket()).toEqual({})
    })
    it('should not change state on no-op', () => {
        expect(webSocket(testState, { type: 'NO-OP' })).toEqual(testState)
    })
    it('should update status on ESTABLISH_WEB_SOCKET_ATTEMPT', () => {
        expect(webSocket(testState, { type: ESTABLISH_WEB_SOCKET_ATTEMPT })).toEqual({
            ...testState,
            status: 'CONNECTING'
        })
    })
    it('should accept data on ESTABLISH_WEB_SOCKET_SUCCESS', () => {
        expect(webSocket({
            ...testState,
            status: 'CONNECTING'
        }, {
            type: ESTABLISH_WEB_SOCKET_SUCCESS,
            payload: {
                webSocket: 'DEF',
                pingInterval: 321,
                refreshTimeout: 654
            }
        })).toEqual({
            status: 'CONNECTED',
            webSocket: 'DEF',
            pingInterval: 321,
            refreshTimeout: 654
        })
    })
    it('should set error status on ESTABLISH_WEB_SOCKET_ERROR', () => {
        expect(webSocket({
            ...testState,
            status: 'CONNECTING'
        }, {
            type: ESTABLISH_WEB_SOCKET_ERROR
        })).toEqual({
            ...testState,
            status: 'ERROR'
        })
    })
    it('should disconnect on DISCONNECT_WEB_SOCKET', () => {
        expect(webSocket(testState, { type: DISCONNECT_WEB_SOCKET })).toEqual({ status: 'DISCONNECTED' })
    })
})