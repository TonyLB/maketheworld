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
//
// NOTES:
//
//   ActiveCharacter shuold be used universally, as a gate-keeper of the
//   player taking action through their character.  Therefore, data
//   that are *only relevant* in the context of taking action (e.g. Grants)
//   should be fetched only at this point from the store, and should be
//   included into the ActiveCharacter context rather than being passed
//   in any other circumstances.  This will both aid in code elegance and
//   improve performance.
//
//   TO-DO:  That.
//

import React, { useContext } from 'react'

const ActiveCharacterContext = React.createContext("")

export const ActiveCharacter = ({ CharacterId, children }) => (
    <ActiveCharacterContext.Provider value={{ CharacterId }}>
        {children}
    </ActiveCharacterContext.Provider>
)

export const useActiveCharacter = () => (useContext(ActiveCharacterContext))

export default ActiveCharacter
