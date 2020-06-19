import { useEffect, useRef } from 'react';

import { useSelector, useDispatch } from 'react-redux'

import { establishWebSocket } from '../actions/webSocket'
import { getCharacterId } from '../selectors/connection'

export const useConnectedCharacter = () => {
    const CharacterId = useSelector(getCharacterId)
    const dispatch = useDispatch()

    useEffect(() => {
        if (CharacterId) {
            dispatch(establishWebSocket(CharacterId))
        }
    }, [CharacterId, dispatch])

}

export default useConnectedCharacter