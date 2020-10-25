import { useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'

import { getSubscriptions } from '../selectors/subscriptions'
import { getCharacterId } from '../selectors/connection'
import {
    subscribeCharactersInPlayChanges
} from '../actions/characters.js'
import {
    subscribePermanentHeaderChanges
} from '../actions/neighborhoods'
import { subscribeEphemeraChanges } from '../actions/ephemera'
import {
    subscribeMessageChanges
} from '../actions/messages'
import {
    subscribePlayerChanges
} from '../actions/player'
import {
    unsubscribeAll
} from '../actions/subscriptions'

export const useAppSyncSubscriptions = () => {
    const dispatch = useDispatch()
    const subscriptions = useSelector(getSubscriptions)
    const characterId = useSelector(getCharacterId)

    useEffect(() => {
        if (!subscriptions.player) {
            dispatch(subscribePlayerChanges())
        }
    }, [subscriptions.player, dispatch])
    // useEffect(() => {
    //     if (!subscriptions.charactersInPlay) {
    //         dispatch(subscribeCharactersInPlayChanges())
    //     }
    // }, [subscriptions.charactersInPlay, dispatch])
    useEffect(() => {
        if (!subscriptions.ephemera) {
            dispatch(subscribeEphemeraChanges)
        }
    }, [subscriptions.ephemera, dispatch])
    useEffect(() => {
        if (!subscriptions.nodes) {
            dispatch(subscribePermanentHeaderChanges())
        }
    }, [subscriptions.nodes, dispatch])
    useEffect(() => {
        if (characterId && !subscriptions.messages) {
            dispatch(subscribeMessageChanges())
        }
    }, [subscriptions, characterId, dispatch])

    useEffect(() => ( () => { dispatch(unsubscribeAll()) } ), [dispatch])

}

export default useAppSyncSubscriptions