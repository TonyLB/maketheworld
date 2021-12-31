import { PayloadAction } from '@reduxjs/toolkit'
import { CharacterEditNodes, CharacterEditKeys } from './baseClasses'
import { multipleSSM } from '../stateSeekingMachine/multipleSSM'
import { lifelineCondition, getURL, fetchCharacterWML, parseCharacterWML } from './index.api'

export const {
    slice: characterEditSlice,
    iterateAllSSMs
} = multipleSSM<CharacterEditNodes>({
    name: 'characterEdit',
    initialSSMState: 'INITIAL',
    initialSSMDesired: 'PARSED',
    initialData: {
        internalData: {},
        publicData: {
            defaultValue: {},
            value: {}
        }
    },
    sliceSelector: ({ UI }) => (UI.characterEdit),
    publicReducers: {
        setValue: (state, action: PayloadAction<{ label: CharacterEditKeys; value: string }>) => {
            state.value[action.payload.label] = action.payload.value
        }
    },
    template: {
        initialState: 'INITIAL',
        initialData: {
            internalData: {},
            publicData: {
                defaultValue: {},
                value: {}
            }
        },
        states: {
            INITIAL: {
                key: 'INITIAL',
                stateType: 'HOLD',
                next: 'GETTINGURL',
                condition: lifelineCondition
            },
            GETTINGURL: {
                key: 'GETTINGURL',
                stateType: 'ATTEMPT',
                action: getURL,
                resolve: 'URLGOTTEN',
                reject: 'ERROR'
            },
            URLGOTTEN: {
                key: 'URLGOTTEN',
                stateType: 'CHOICE',
                choices: ['FETCHING']
            },
            FETCHING: {
                key: 'FETCHING',
                stateType: 'ATTEMPT',
                action: fetchCharacterWML,
                resolve: 'FETCHED',
                reject: 'ERROR'
            },
            FETCHED: {
                key: 'FETCHED',
                stateType: 'CHOICE',
                choices: ['PARSING']
            },
            PARSING: {
                key: 'PARSING',
                stateType: 'ATTEMPT',
                action: parseCharacterWML,
                resolve: 'PARSED',
                reject: 'ERROR'
            },
            PARSED: {
                key: 'PARSED',
                stateType: 'CHOICE',
                choices: ['INITIAL']
            },
            ERROR: {
                key: 'ERROR',
                stateType: 'CHOICE',
                choices: []
            }
        }
    }
})

export const { addItem } = characterEditSlice.actions

export default characterEditSlice.reducer
