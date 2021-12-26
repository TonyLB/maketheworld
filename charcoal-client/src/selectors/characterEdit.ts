import { createSelector } from '@reduxjs/toolkit'
import { CharacterEditState } from '../slices/characterEdit'

export const characterEditStates = ({ characterEdit = { byKey: {}} }: { characterEdit: CharacterEditState }) => (characterEdit.byKey)

export const characterEditByKey = (characterKey: string) => createSelector(
    characterEditStates,
    (byKey) => (byKey[characterKey] || { value: {}, defaultValue: {} })
)
