import { createSelector } from '@reduxjs/toolkit'
import { CharacterEditState } from '../slices/characterEdit'

export const characterEditStates = ({ characterEdit = { byId: {}} }: { characterEdit: CharacterEditState }) => (characterEdit.byId)

export const characterEditById = (characterId: string) => createSelector(
    characterEditStates,
    (byId) => (byId[characterId] || { value: {}, defaultValue: {} })
)
