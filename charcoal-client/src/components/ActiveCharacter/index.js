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

import React, { useContext, useCallback } from 'react'
import { useDispatch } from 'react-redux'

import { deactivateCharacter } from '../../actions/UI/activeCharacters'

const ActiveCharacterContext = React.createContext("")

export const ActiveCharacter = ({ CharacterId, children }) => {

    const dispatch = useDispatch()
    const deactivate = useCallback(() => {
        dispatch(deactivateCharacter(CharacterId))
    }, [dispatch, deactivateCharacter, CharacterId])
    return (
        <ActiveCharacterContext.Provider value={{
            CharacterId,
            deactivate
        }}>
            {children}
        </ActiveCharacterContext.Provider>
    )
}

export const useActiveCharacter = () => (useContext(ActiveCharacterContext))

export default ActiveCharacter
