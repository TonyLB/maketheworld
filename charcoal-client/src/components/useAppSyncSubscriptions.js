import { useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'

import { getSubscriptions } from '../selectors/subscriptions'
import {
    subscribeCharactersInPlayChanges
} from '../actions/characters.js'
import {
    subscribePermanentHeaderChanges
} from '../actions/neighborhoods'
import {
    subscribePlayerChanges
} from '../actions/player'
import {
    subscribeRoleChanges
} from '../actions/role'
import {
    unsubscribeAll,
    subscribeRealtimePings,
    directMessageSubscription
} from '../actions/subscriptions'

export const useAppSyncSubscriptions = () => {
    const dispatch = useDispatch()
    const subscriptions = useSelector(getSubscriptions)

    useEffect(() => {
        if (!subscriptions.player) {
            dispatch(subscribePlayerChanges())
        }
        if (!subscriptions.charactersInPlay) {
            dispatch(subscribeCharactersInPlayChanges())
        }
        if (!(subscriptions.rooms && subscriptions.nodes)) {
            dispatch(subscribePermanentHeaderChanges())
        }
        if (!subscriptions.directMessages) {
            dispatch(directMessageSubscription())
        }
        if (!subscriptions.role) {
            dispatch(subscribeRoleChanges())
        }
        if (!subscriptions.ping) {
            dispatch(subscribeRealtimePings())
        }
    }, [subscriptions, dispatch])

    useEffect(() => ( () => { dispatch(unsubscribeAll()) } ), [dispatch])

}

export default useAppSyncSubscriptions