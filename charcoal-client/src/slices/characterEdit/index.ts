import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export type CharacterEditKeys = 'Name' | 'Pronouns' | 'FirstImpression' | 'OneCoolThing' | 'Outfit'

export interface CharacterEditState {
    byId: Record<string, {
        defaultValue: Partial<Record<CharacterEditKeys, string>>,
        value: Partial<Record<CharacterEditKeys, string>>
    }>
}

const initialState: CharacterEditState = {
    byId: {}
}

const characterEdit = createSlice({
    name: 'characterEdit',
    initialState,
    reducers: {
        setDefaults(state, action: PayloadAction<{ characterId: string, defaultValue: Record<CharacterEditKeys, string> }>) {
            const { characterId, defaultValue } = action.payload
            if (state.byId[characterId]) {
                state.byId[characterId].defaultValue = defaultValue
            }
            else {
                state.byId[characterId] = {
                    value: {},
                    defaultValue
                }
            }
        },
        setValue(state, action: PayloadAction<{ characterId: string, label: CharacterEditKeys, value: string }>) {
            const { characterId, label, value } = action.payload
            if (state.byId[characterId]) {
                state.byId[characterId].value[label] = value
            }
            else {
                state.byId[characterId] = {
                    value: {
                        [label]: value
                    },
                    defaultValue: {}
                }
            }
        }
    }
})

export const { setDefaults, setValue } = characterEdit.actions
export default characterEdit.reducer
