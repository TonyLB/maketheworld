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
import { useDispatch, useSelector } from 'react-redux'

//
// TODO:  Rewrite activeCharacters selectors to refer to SSMs
//
import { getActiveCharacters, getActiveCharacterMaps } from '../../slices/activeCharacters'
import { ActiveCharacterMap } from '../../slices/activeCharacters/baseClasses'
import { getMessagesByRoom } from '../../slices/messages'
import { getCharactersInPlay } from '../../slices/ephemera'
import { EphemeraCharacterInPlay } from '../../slices/ephemera/baseClasses'
import { MessageRoomBreakdown } from '../../slices/messages/selectors'
import { EphemeraCharacterId, EphemeraMapId } from '@tonylb/mtw-interfaces/dist/baseClasses'
import { ParseCommandModes } from '../../slices/lifeLine/baseClasses'
import { getLineEntry, getLineEntryMode, setCurrentMode, setEntry, moveCurrentMode } from '../../slices/UI/lineEntry'
import { getMyCharacters, getMySettings } from '../../slices/player'

type ActiveCharacterContextType = {
    CharacterId: EphemeraCharacterId;
    scopedId: string;
    messageBreakdown: MessageRoomBreakdown;
    info?: EphemeraCharacterInPlay;
    maps: Record<EphemeraMapId, ActiveCharacterMap>;
    lineEntry: string;
    entryMode: ParseCommandModes | 'Options';
    setLineEntry: (value: string) => void;
    setEntryMode: (value: ParseCommandModes | 'Options') => void;
    moveEntryMode: (up: boolean) => void;
}

const ActiveCharacterContext = React.createContext<ActiveCharacterContextType>({
    CharacterId: 'CHARACTER#NONE',
    scopedId: '',
    maps: {},
    messageBreakdown: {
        Messages: [],
        Groups: []
    },
    lineEntry: '',
    entryMode: 'Command',
    setLineEntry: () => {},
    setEntryMode: () => {},
    moveEntryMode: () => {}
})

type ActiveCharacterProps = {
    CharacterId: EphemeraCharacterId;
    children?: ReactChild | ReactChildren;
}

export const ActiveCharacter: FunctionComponent<ActiveCharacterProps> = ({ CharacterId, children }) => {

    const myCharacters = useSelector(getMyCharacters)
    const { guestId } = useSelector(getMySettings)
    const { scopedId } = CharacterId === guestId ? { scopedId: 'Guest' } : myCharacters.find(({ CharacterId: check }) => (check === CharacterId)) || {}
    const characterState = useSelector(getActiveCharacters)[CharacterId]
    const maps = useSelector(getActiveCharacterMaps(CharacterId))
    const messageBreakdown = useSelector(getMessagesByRoom(CharacterId))
    const info = useSelector(getCharactersInPlay)[CharacterId]
    const { Name: name } = info
    const lineEntry = useSelector(getLineEntry(CharacterId))
    const entryMode = useSelector(getLineEntryMode(CharacterId))
    const dispatch = useDispatch()
    const setLineEntry = (entry: string) => { dispatch(setEntry({ characterId: CharacterId, entry }))}
    const setEntryMode = (mode: ParseCommandModes | 'Options') => { dispatch(setCurrentMode({ characterId: CharacterId, mode, name }))}
    const moveEntryMode = (up: boolean) => { dispatch(moveCurrentMode({ characterId: CharacterId, up, name }))}
    return (
        <ActiveCharacterContext.Provider value={{
            CharacterId,
            scopedId,
            messageBreakdown,
            info,
            maps,
            lineEntry,
            entryMode,
            setLineEntry,
            setEntryMode,
            moveEntryMode,
            ...characterState
        }}>
            {children}
        </ActiveCharacterContext.Provider>
    )
}

export const useActiveCharacter = () => (useContext(ActiveCharacterContext))

export default ActiveCharacter
