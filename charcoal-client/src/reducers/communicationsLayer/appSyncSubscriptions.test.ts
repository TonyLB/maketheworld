import { immerable } from 'immer'
import { SUBSCRIPTION_SUCCESS } from '../../actions/communicationsLayer/appSyncSubscriptions'
import appSyncSubscriptions, { AppSyncSubscriptionsModule } from './appSyncSubscriptions'

describe('communicationsLayer/appSyncSubscriptions reducer', () => {
    const testState: AppSyncSubscriptionsModule = {
        [immerable]: true,
        fetchLastPermanentsSync: 0,
        permanents: {
            subscription: 'ABC'
        },
        ephemera: {
            subscription: null
        },
        player: {
            subscription: null
        },
        characters: {
            TESS: {
                subscription: 'DEF'
            }
        }
    }
    it('should return default', () => {
        expect(appSyncSubscriptions()).toEqual({
            [immerable]: true,
            fetchLastPermanentsSync: 0,
            permanents: {
                subscription: null
            },
            ephemera: {
                subscription: null
            },
            player: {
                subscription: null
            },
            characters: {}
        })
    })
    it('should not change state on no-op', () => {
        expect(appSyncSubscriptions(testState, { type: 'NO-OP' })).toEqual(testState)
    })
    it('should accept data on SUBSCRIPTION_SUCCESS', () => {
        expect(appSyncSubscriptions({
            [immerable]: true,
            fetchLastPermanentsSync: 0,
            permanents: {
                subscription: null
            },
            ephemera: {
                subscription: 'DEF'
            },
            player: {
                subscription: null
            },
            characters: {}
        }, {
            type: SUBSCRIPTION_SUCCESS,
            payload: {
                permanents: 'ABC'
            }
        })).toEqual({
            [immerable]: true,
            fetchLastPermanentsSync: 0,
            permanents: {
                subscription: 'ABC'
            },
            ephemera: {
                subscription: 'DEF'
            },
            player: {
                subscription: null
            },
            characters: {}
        })
    })
    it('should update sync moment on SET_PERMANENTS_LAST_SYNC', () => {
        expect(appSyncSubscriptions(testState, { type: 'SET_PERMANENTS_LAST_SYNC', payload: 123 })).toEqual({
            ...testState,
            fetchLastPermanentsSync: 123
        })
    })
    describe('in character context', () => {
        it('should accept data on SUBSCRIPTION_SUCCESS', () => {
            expect(appSyncSubscriptions({
                [immerable]: true,
                fetchLastPermanentsSync: 0,
                permanents: { subscription: 'ABC' },
                ephemera: { subscription: 'DEF' },
                player: { subscription: null },
                characters: { TESS: { subscription: null }}
            }, {
                type: SUBSCRIPTION_SUCCESS,
                payload: {
                    characters: { TESS: 'GHI' }
                }
            })).toEqual({
                [immerable]: true,
                fetchLastPermanentsSync: 0,
                permanents: { subscription: 'ABC' },
                ephemera: { subscription: 'DEF' },
                player: { subscription: null },
                characters: {
                    TESS: {
                        subscription: 'GHI'
                    }
                }
            })
        })
    })
})