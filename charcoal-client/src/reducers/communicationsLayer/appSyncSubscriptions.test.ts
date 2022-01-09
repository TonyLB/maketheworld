import { immerable } from 'immer'
import { SUBSCRIPTION_SUCCESS } from '../../actions/communicationsLayer/appSyncSubscriptions'
import appSyncSubscriptions, { AppSyncSubscriptionsModule } from './appSyncSubscriptions'

describe('communicationsLayer/appSyncSubscriptions reducer', () => {
    const testState: AppSyncSubscriptionsModule = {
        [immerable]: true,
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
    describe('in character context', () => {
        it('should accept data on SUBSCRIPTION_SUCCESS', () => {
            expect(appSyncSubscriptions({
                [immerable]: true,
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