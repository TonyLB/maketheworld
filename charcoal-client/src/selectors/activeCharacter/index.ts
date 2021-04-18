//
// REPLICATE TO ACTIVE-CHARACTER SELECTOR
//
// THEN MARK FOR OBLIVION
//

// TODO:  Import @reduxjs/toolkit and refactor these nested selectors using reslect
// createSelector to be better memoized

// import { getCurrentRoomId } from './connection'
import { getMyCharacterById } from '../myCharacters'
import { getActiveCharactersInRoom } from '../charactersInPlay'
import { getPermanentHeaders } from '../permanentHeaders'
import { getCharacters } from '../characters'

export const getMyCharacterInPlay = (CharacterId: string) => ({ charactersInPlay }: { charactersInPlay: any }) => (charactersInPlay?.[CharacterId]) || {}

export const getCurrentRoomId = (CharacterId: string) => (state: any) => getMyCharacterInPlay(CharacterId)(state).RoomId

export const getCharacter = (CharacterId: string) => (state: any) => {
    const characters: Record<string, any> = getCharacters(state)
    return (CharacterId && characters[CharacterId]) || {}
}

export const getCurrentName = (CharacterId: string) => (state: any) => {
    return getCharacter(CharacterId)(state).Name ?? ''
}


export const getCurrentRoom = (CharacterId: string) => (state: any) => {
    const permanentHeaders: Record<string, any> = getPermanentHeaders(state)
    const RoomId = getCurrentRoomId(CharacterId)(state)
    return (RoomId && permanentHeaders[RoomId]) || {}
}

//
// getVisibleExits checks all exits from the room, and their Neighborhood ancestry,
// tags exits with whether they are public-access, or private, and if private checks
// for all necessary grants.  Does not return exits that the player does not have a
// grant to view, or exits to retired spaces.
//
export const getVisibleExits = (CharacterId: string) => (state: any) => {
    const permanentHeaders: Record<string, any> = getPermanentHeaders(state)
    const { Grants = {} } = getMyCharacterById(CharacterId)(state)
    const currentRoom: any = getCurrentRoom(CharacterId)(state)
    const retiredAncestries = Object.values(permanentHeaders)
        .filter(({ Retired }: any) => (Retired))
        .map(({ Ancestry }: any) => (Ancestry))
        .filter((test) => (!(currentRoom && currentRoom.Ancestry) || (!currentRoom.Ancestry.startsWith(test))))
    return currentRoom && currentRoom.Ancestry && currentRoom.Exits &&
        currentRoom.Exits.map(({ RoomId = '', ...rest }) => {
                const Ancestry = permanentHeaders[RoomId].Ancestry || ''
                const ancestorRetired = retiredAncestries.find((test) => (Ancestry.startsWith(test)))
                if (ancestorRetired) {
                    return { RoomId, ...rest, visible: false }
                }
                const ancestryList = Ancestry.split(':')
                const roomAncestryList = currentRoom.Ancestry.split(':')
                const checkNeighborhoods = ancestryList.filter((PermanentId: string, index: number) => (
                    (roomAncestryList.length < index || PermanentId !== roomAncestryList[index]) &&
                    permanentHeaders &&
                    permanentHeaders[PermanentId] &&
                    permanentHeaders[PermanentId].Visibility === 'Private'))
                const returnVal = checkNeighborhoods.reduce((previous: { Visibility: string, visible: boolean }[], PermanentId: string) => (
                    (Grants[PermanentId] || {}).View
                        ? { ...previous, Visibility: 'Private' }
                        : { Visibility: 'Private', visible: false }
                ), { Visibility: 'Public', visible: true })
                return { RoomId, ...rest, ...returnVal }
            })
            .filter(({ visible }: { visible: boolean }) => (visible))
            .map(({ visible, ...rest }: { visible: boolean}) => (rest))
}

//
// getAvailableBehaviors tells what line entries will invoke special behaviors
// directly from the text line.  This is used to populate the autoComplete on
// the LineEntry component, to give people text help.
//
export const getAvailableBehaviors = (CharacterId: string) => (state: any) => {
    const currentRoom: any = getCurrentRoom(CharacterId)(state)
    const exitNames = (getVisibleExits(CharacterId)(state) && currentRoom.Exits.map(({ Name }: { Name: string }) => (Name.toLowerCase()))) || []
    const characterNames: { Name: string }[] = getActiveCharactersInRoom({ RoomId: currentRoom.PermanentId })(state)
    return [
        'l',
        'look',
        'help',
        'home',
        ...(exitNames),
        ...(exitNames.map((name: string) => (`go ${name}`))),
        ...(characterNames.map(({ Name }: { Name: string }) => (`look ${Name.toLowerCase()}`)))
    ]
}

export const getCurrentNeighborhood = (CharacterId: string) => (state: any) => {
    const currentRoom: { ParentId?: string } = getCurrentRoom(CharacterId)(state)
    const permanentHeaders: Record<string, any> = getPermanentHeaders(state)
    if (currentRoom && currentRoom.ParentId) {
        return permanentHeaders[currentRoom.ParentId]
    }
    else {
        return null
    }
}