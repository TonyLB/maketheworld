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
    unsubscribeAll,
    directMessageSubscription
} from '../actions/subscriptions'

export const useAppSyncSubscriptions = () => {
    const dispatch = useDispatch()
    const subscriptions = useSelector(getSubscriptions)

    useEffect(() => {
        if (!subscriptions.player) {
            dispatch(subscribePlayerChanges())
        }
    }, [subscriptions.player, dispatch])
    useEffect(() => {
        if (!subscriptions.charactersInPlay) {
            dispatch(subscribeCharactersInPlayChanges())
        }
    }, [subscriptions.charactersInPlay, dispatch])
    useEffect(() => {
        if (!subscriptions.nodes) {
            dispatch(subscribePermanentHeaderChanges())
        }
    }, [subscriptions.nodes, dispatch])
    useEffect(() => {
        if (!subscriptions.directMessages) {
            dispatch(directMessageSubscription())
        }
    }, [subscriptions, dispatch])

    useEffect(() => ( () => { dispatch(unsubscribeAll()) } ), [dispatch])

}

export default useAppSyncSubscriptions