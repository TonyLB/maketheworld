import { getWebSocket, getSubscriptionStatus } from './index'

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

    describe('getSubscriptionStatus', () => {
        it('should return INITIAL on null state', () => {
            expect(getSubscriptionStatus({})).toEqual('INITIAL')
        })
        it('should return INITIAL when all global subscriptions initial', () => {
            expect(getSubscriptionStatus({ communicationsLayer: { appSyncSubscriptions: {
                ephemera: { status: 'INITIAL' },
                permanents: { status: 'INITIAL' },
                player: { status: 'INITIAL'}
            }}})).toEqual('INITIAL')
        })
        it('should return CONNECTING when any subscription is connecting', () => {
            expect(getSubscriptionStatus({ communicationsLayer: { appSyncSubscriptions: {
                ephemera: { status: 'CONNECTED' },
                permanents: { status: 'CONNECTING' },
                player: { status: 'CONNECTED'}
            }}})).toEqual('CONNECTING')
        })
        it('should return CONNECTED when all subscriptions are connected', () => {
            expect(getSubscriptionStatus({ communicationsLayer: { appSyncSubscriptions: {
                ephemera: { status: 'CONNECTED' },
                permanents: { status: 'CONNECTED' },
                player: { status: 'CONNECTED'}
            }}})).toEqual('CONNECTED')
        })
        it('should return ERROR when any subscription is error', () => {
            expect(getSubscriptionStatus({ communicationsLayer: { appSyncSubscriptions: {
                ephemera: { status: 'CONNECTED' },
                permanents: { status: 'ERROR' },
                player: { status: 'CONNECTED'}
            }}})).toEqual('ERROR')
        })
    })
})