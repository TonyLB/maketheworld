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

import React, { useContext, ReactChild, ReactChildren, FunctionComponent } from 'react'
import { useSelector } from 'react-redux'

//
// TODO:  Rewrite activeCharacters selectors to refer to SSMs
//
import { getActiveCharacters, getActiveCharacterMaps } from '../../slices/activeCharacters'
import { ActiveCharacterMap } from '../../slices/activeCharacters/baseClasses'
import { getMessagesByRoom } from '../../slices/messages'
import { getCharactersInPlay } from '../../slices/ephemera'
import { EphemeraCharacterInPlay } from '../../slices/ephemera/baseClasses'
import { MessageRoomBreakdown } from '../../slices/messages/selectors'

type ActiveCharacterContextType = {
    CharacterId: string;
    messageBreakdown: MessageRoomBreakdown;
    info?: EphemeraCharacterInPlay;
    maps: Record<string, ActiveCharacterMap>
}

const ActiveCharacterContext = React.createContext<ActiveCharacterContextType>({
    CharacterId: '',
    maps: {},
    messageBreakdown: {
        Messages: [],
        Groups: []
    }
})

type ActiveCharacterProps = {
    CharacterId: string;
    children?: ReactChild | ReactChildren;
}

export const ActiveCharacter: FunctionComponent<ActiveCharacterProps> = ({ CharacterId, children }) => {

    const characterState = useSelector(getActiveCharacters)[CharacterId]
    const maps = useSelector(getActiveCharacterMaps(CharacterId))
    const messageBreakdown = useSelector(getMessagesByRoom(`CHARACTER#${CharacterId}`))
    const info = useSelector(getCharactersInPlay)[CharacterId]
    return (
        <ActiveCharacterContext.Provider value={{
            CharacterId,
            messageBreakdown,
            info,
            maps,
            ...characterState
        }}>
            {children}
        </ActiveCharacterContext.Provider>
    )
}

export const useActiveCharacter = () => (useContext(ActiveCharacterContext))

export default ActiveCharacter
