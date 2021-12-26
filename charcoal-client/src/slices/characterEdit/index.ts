import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export type CharacterEditKeys = 'assetKey' | 'Name' | 'Pronouns' | 'FirstImpression' | 'OneCoolThing' | 'Outfit'

export interface CharacterEditRecord {
    fetching: boolean;
    fetched: boolean;
    defaultValue: Partial<Record<CharacterEditKeys, string>>,
    value: Partial<Record<CharacterEditKeys, string>>
}

export interface CharacterEditState {
    byKey: Record<string, CharacterEditRecord>
}

const initialState: CharacterEditState = {
    byKey: {}
}

const characterEdit = createSlice({
    name: 'characterEdit',
    initialState,
    reducers: {
        setDefaults(state, action: PayloadAction<{ characterKey: string, defaultValue: Record<CharacterEditKeys, string> }>) {
            const { characterKey, defaultValue } = action.payload
            if (state.byKey[characterKey]) {
                state.byKey[characterKey].defaultValue = defaultValue
            }
            else {
                state.byKey[characterKey] = {
                    fetching: false,
                    fetched: true,
                    value: {},
                    defaultValue
                }
            }
        },
        setValue(state, action: PayloadAction<{ characterKey: string, label: CharacterEditKeys, value: string }>) {
            const { characterKey, label, value } = action.payload
            if (state.byKey[characterKey]) {
                state.byKey[characterKey].value[label] = value
            }
            else {
                state.byKey[characterKey] = {
                    value: {
                        [label]: value
                    },
                    fetching: false,
                    fetched: false,
                    defaultValue: {}
                }
            }
        },
        setFetching(state, action: PayloadAction<{ characterKey: string }>) {
            const { characterKey } = action.payload
            if (state.byKey[characterKey]) {
                state.byKey[characterKey].fetching = true
            }
            else {
                state.byKey[characterKey] = {
                    value: {},
                    fetching: true,
                    fetched: false,
                    defaultValue: {}
                }
            }

        },
        setFetched(state, action: PayloadAction<{ characterKey: string }>) {
            const { characterKey } = action.payload
            if (state.byKey[characterKey]) {
                state.byKey[characterKey].fetched = true
                state.byKey[characterKey].fetching = false
            }
            else {
                state.byKey[characterKey] = {
                    value: {},
                    fetching: false,
                    fetched: true,
                    defaultValue: {}
                }
            }
        }
    }
})

export const { setDefaults, setValue, setFetching, setFetched } = characterEdit.actions
export default characterEdit.reducer
