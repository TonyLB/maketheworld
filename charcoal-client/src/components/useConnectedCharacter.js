import { useEffect, useRef } from 'react';

import { useSelector } from 'react-redux'

import { API, graphqlOperation } from 'aws-amplify'
import { disconnectCharacterInPlay } from '../graphql/mutations'

import { getCharacterId } from '../selectors/connection'

export const useConnectedCharacter = () => {
    const CharacterId = useSelector(getCharacterId)
    const ref = useRef({ previousUnload: null })

    useEffect(() => {
        let unloadComplete = false
        const onUnload = () => {
            if (!unloadComplete) {
                unloadComplete = true
                API.graphql(graphqlOperation(disconnectCharacterInPlay, { CharacterId }))
            }
        }
        if (ref.current.previousUnload) {
            window.removeEventListener("beforeunload", ref.current.previousUnload)
            window.removeEventListener("unload", ref.current.previousUnload)
        }
        ref.current = {
            previousUnload: CharacterId && onUnload
        }
        if (CharacterId) {
            window.addEventListener("beforeunload", onUnload)
            window.addEventListener("unload", onUnload)
            return () => { window.removeEventListener("beforeunload", onUnload) }
        }
    }, [CharacterId, ref])

}

export default useConnectedCharacter