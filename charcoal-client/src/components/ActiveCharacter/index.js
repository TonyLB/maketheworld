//
// ActiveCharacter is a context provider (with associated useActiveCharacter
// context subscriber hook) to create component nests that all operate in the
// context of having a chosen character that the player is using.
//
// This provider can be used in (e.g.) the in-play messaging panel, to
// give that panel the context of which character it is displaying messages
// and accepting input on behalf of.
//
// Arguments:
//
//   - CharacterId: The UUID string of the character.
//
// Context provided:
//
//   - CharacterId
//   - deactivate:  A function to deactivate the character
//
// NOTES:
//
//   ActiveCharacter should be used consistently as the gate-keeper of the
//   player taking action through their character.  Therefore, data
//   that are *only relevant* in the context of taking action (e.g. Grants)
//   should be fetched only at this point from the store, and should be
//   included into the ActiveCharacter context rather than being passed
//   in any other circumstances.  This will both aid in code elegance and
//   improve performance.
//
//   Likewise, any dispatching and communications overhead that is needed
//   to maintain a character's connection with the live database should
//   be handled in this component rather than elsewhere.
//
//   TO-DO:  That.
//

import React, { useContext, useCallback, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import { deactivateCharacter, registerCharacterSSM } from '../../actions/activeCharacters'
//
// TODO:  Rewrite activeCharacters selectors to refer to SSMs
//
import { getActiveCharacters, getActiveCharacterInPlayMessages } from '../../selectors/activeCharacters'
import { getCharacters } from '../../selectors/characters'

const ActiveCharacterContext = React.createContext({
    CharacterId: '',
    deactivate: () => {}
})

export const ActiveCharacter = ({ CharacterId, children }) => {

    const dispatch = useDispatch()
    const characterState = useSelector(getActiveCharacters)[CharacterId]
    const inPlayMessages = useSelector(getActiveCharacterInPlayMessages(CharacterId))
    const info = useSelector(getCharacters)[CharacterId]
    //
    // TODO:  Rewrite commands available in ActiveCharacterContext to correspond to what
    // the SSM actually provides
    //
    const deactivate = useCallback(() => {
        dispatch(deactivateCharacter(CharacterId))
    }, [dispatch, CharacterId])
    return (
        <ActiveCharacterContext.Provider value={{
            CharacterId,
            deactivate,
            inPlayMessages,
            info,
            ...characterState
        }}>
            {children}
        </ActiveCharacterContext.Provider>
    )
}

export const useActiveCharacter = () => (useContext(ActiveCharacterContext))

export default ActiveCharacter
