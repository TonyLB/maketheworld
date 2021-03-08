import { SUBSCRIPTION_ATTEMPT, SUBSCRIPTION_ERROR, SUBSCRIPTION_SUCCESS } from '../../actions/communicationsLayer/appSyncSubscriptions.js'
import appSyncSubscriptions from './appSyncSubscriptions'

describe('communicationsLayer/appSyncSubscriptions reducer', () => {
    const testState = {
        permanents: {
            subscription: 'ABC',
            status: 'CONNECTED'
        },
        ephemera: {
            status: 'INITIAL'
        },
        player: {
            status: 'INITIAL'
        },
        characters: {
            TESS: {
                subscription: 'DEF',
                status: 'CONNECTED'
            }
        }
    }
    it('should return default', () => {
        expect(appSyncSubscriptions()).toEqual({
            permanents: {
                status: 'INITIAL'
            },
            ephemera: {
                status: 'INITIAL'
            },
            player: {
                status: 'INITIAL'
            },
            characters: {}
        })
    })
    it('should not change state on no-op', () => {
        expect(appSyncSubscriptions(testState, { type: 'NO-OP' })).toEqual(testState)
    })
    it('should update status on SUBSCRIPTION_ATTEMPT', () => {
        expect(appSyncSubscriptions({
            permanents: { status: 'INITIAL' },
            ephemera: { status: 'INITIAL'},
            player: { status: 'CONNECTED', subscription: 'XYZ' },
            characters: {}
        }, { type: SUBSCRIPTION_ATTEMPT, payload: { key: 'permanents' } })).toEqual({
            permanents: {
                status: 'CONNECTING'
            },
            ephemera: {
                status: 'INITIAL'
            },
            player: {
                status: 'CONNECTED',
                subscription: 'XYZ'
            },
            characters: {}
        })
    })
    it('should accept data on SUBSCRIPTION_SUCCESS', () => {
        expect(appSyncSubscriptions({
            permanents: {
                status: 'CONNECTING'
            },
            ephemera: {
                status: 'CONNECTED',
                subscription: 'DEF'
            },
            player: {
                status: 'INITIAL'
            },
            characters: {}
        }, {
            type: SUBSCRIPTION_SUCCESS,
            payload: {
                permanents: 'ABC'
            }
        })).toEqual({
            permanents: {
                status: 'CONNECTED',
                subscription: 'ABC'
            },
            ephemera: {
                status: 'CONNECTED',
                subscription: 'DEF'
            },
            player: {
                status: 'INITIAL'
            },
            characters: {}
        })
    })
    it('should set error status on SUBSCRIPTION_ERROR', () => {
        expect(appSyncSubscriptions({
            permanents: {
                status: 'INITIAL'
            },
            ephemera: {
                status: 'CONNECTING'
            },
            player: {
                status: 'INITIAL'
            },
            characters: {}
        }, {
            type: SUBSCRIPTION_ERROR,
            payload: { key: 'ephemera' }
        })).toEqual({
            permanents: {
                status: 'INITIAL'
            },
            ephemera: {
                status: 'ERROR'
            },
            player: {
                status: 'INITIAL'
            },
            characters: {}
        })
    })
    describe('in character context', () => {
        it('should update status on SUBSCRIPTION_ATTEMPT', () => {
            expect(appSyncSubscriptions({
                permanents: { status: 'INITIAL' },
                ephemera: { status: 'INITIAL'},
                player: { status: 'INITIAL' },
                status: 'INITIAL',
                characters: { TESS: { status: 'INITIAL' }}
            }, { type: SUBSCRIPTION_ATTEMPT, payload: { key: 'characters', characterId: 'TESS' } })).toEqual({
                permanents: { status: 'INITIAL' },
                ephemera: { status: 'INITIAL' },
                player: { status: 'INITIAL' },
                status: 'INITIAL',
                characters: { TESS: { status: 'CONNECTING' }}
            })
        })
        it('should accept data on SUBSCRIPTION_SUCCESS', () => {
            expect(appSyncSubscriptions({
                permanents: {
                    status: 'CONNECTED',
                    subscription: 'ABC'
                },
                ephemera: {
                    status: 'CONNECTED',
                    subscription: 'DEF'
                },
                player: {
                    status: 'INITIAL'
                },
                characters: { TESS: { status: 'CONNECTING' }}
            }, {
                type: SUBSCRIPTION_SUCCESS,
                payload: {
                    characters: { TESS: 'GHI' }
                }
            })).toEqual({
                permanents: {
                    status: 'CONNECTED',
                    subscription: 'ABC'
                },
                ephemera: {
                    status: 'CONNECTED',
                    subscription: 'DEF'
                },
                player: {
                    status: 'INITIAL'
                },
                characters: {
                    TESS: {
                        status: 'CONNECTED',
                        subscription: 'GHI'
                    }
                }
            })
        })
        it('should set error status on SUBSCRIPTION_ERROR', () => {
            expect(appSyncSubscriptions({
                permanents: {
                    status: 'INITIAL'
                },
                ephemera: {
                    status: 'INITIAL'
                },
                player: {
                    status: 'INITIAL'
                },
                characters: { TESS: { status: 'CONNECTING' }}
            }, {
                type: SUBSCRIPTION_ERROR,
                payload: { key: 'characters', characterId: 'TESS' }
            })).toEqual({
                permanents: {
                    status: 'INITIAL'
                },
                ephemera: {
                    status: 'INITIAL'
                },
                player: {
                    status: 'INITIAL'
                },
                characters: { TESS: { status: 'ERROR' }}
            })
        })
    })
})