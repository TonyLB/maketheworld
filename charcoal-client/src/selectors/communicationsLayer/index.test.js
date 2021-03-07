import { ExpansionPanelActions } from '@material-ui/core'
import { getWebSocket } from './index'

describe('communicationsLayer selectors', () => {
    describe('getWebSocket', () => {
        it('should return a default on null state', () => {
            expect(getWebSocket({})).toEqual({ status: 'DISCONNECTED' })
        })

        it('should return a default when webSocket not defined in communicationsLayer', () => {
            expect(getWebSocket({ communicationsLayer: {} })).toEqual({ status: 'DISCONNECTED' })
        })

        it('should return webSocket info when defined', () => {
            expect(getWebSocket({
                communicationsLayer: {
                    webSocket: {
                        status: 'CONNECTED',
                        webSocket: 'ABC',
                        pingInterval: 123,
                        refreshTimeout: 456
                    }
                }
            })).toEqual({
                status: 'CONNECTED',
                webSocket: 'ABC',
                pingInterval: 123,
                refreshTimeout: 456
            })
        })
    })
})