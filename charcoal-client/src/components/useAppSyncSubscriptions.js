import { useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'

import { getSubscriptions } from '../selectors/subscriptions'
import {
    subscribeMyCharacterChanges,
    subscribeCharactersInPlayChanges,
} from '../actions/characters.js'
import {
    subscribePermanentHeaderChanges
} from '../actions/neighborhoods'
import {
    subscribePlayerChanges
} from '../actions/player'
import {
    unsubscribeAll,
    subscribeRealtimePings
} from '../actions/subscriptions'

export const useAppSyncSubscriptions = () => {
    const dispatch = useDispatch()
    const subscriptions = useSelector(getSubscriptions)

    useEffect(() => {
        if (!subscriptions.myCharacters) {
            dispatch(subscribeMyCharacterChanges())
        }
        if (!subscriptions.player) {
            dispatch(subscribePlayerChanges())
        }
        if (!subscriptions.charactersInPlay) {
            dispatch(subscribeCharactersInPlayChanges())
        }
        if (!(subscriptions.rooms && subscriptions.neighborhoods)) {
            dispatch(subscribePermanentHeaderChanges())
        }
        if (!subscriptions.ping) {
            dispatch(subscribeRealtimePings())
        }
    }, [subscriptions, dispatch])

    useEffect(() => ( () => { dispatch(unsubscribeAll()) } ), [dispatch])

}

export default useAppSyncSubscriptions