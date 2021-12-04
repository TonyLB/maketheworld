//
// REPLICATE TO ACTIVE-CHARACTER SELECTOR
//
// THEN MARK FOR OBLIVION
//

// TODO:  Import @reduxjs/toolkit and refactor these nested selectors using reslect
// createSelector to be better memoized

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
