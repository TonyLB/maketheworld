import { PayloadAction } from '@reduxjs/toolkit'
import { ThunkAction } from 'redux-thunk'
import { AnyAction } from 'redux'
import { CharacterEditNodes, CharacterEditKeys } from './baseClasses'
import { multipleSSM } from '../../stateSeekingMachine/multipleSSM'
import {
    lifelineCondition,
    getURL,
    getPostURL,
    fetchCharacterWML,
    parseCharacterWML,
    postCharacterWML
} from './index.api'
import { heartbeat } from '../../stateSeekingMachine/ssmHeartbeat'
import { RootState } from '../../../store'

export const {
    slice: characterEditSlice,
    selectors,
    publicActions,
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
    publicSelectors: {
        getCharacterEditByKey: (state) => state,
        getCharacterEditValues: ({ defaultValue, value }): Record<CharacterEditKeys, string> => ({
            ...(['assetKey', 'Name', 'Pronouns', 'FirstImpression', 'OneCoolThing', 'Outfit']
                .reduce((previous, label) => ({ ...previous, [label]: '' }), {})
            ) as Record<CharacterEditKeys, string>,
            ...defaultValue,
            ...value
        }),
        getCharacterEditDirty: ({ value }) => (Object.keys(value).length > 0)
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
                stateType: 'HOLD',
                next: 'GETURL',
                condition: lifelineCondition
            },
            GETURL: {
                stateType: 'ATTEMPT',
                action: getURL,
                resolve: 'FETCH',
                reject: 'ERROR'
            },
            FETCH: {
                stateType: 'ATTEMPT',
                action: fetchCharacterWML,
                resolve: 'PARSE',
                reject: 'ERROR'
            },
            PARSE: {
                stateType: 'ATTEMPT',
                action: parseCharacterWML,
                resolve: 'PARSED',
                reject: 'ERROR'
            },
            PARSED: {
                stateType: 'CHOICE',
                choices: ['INITIAL']
            },
            INITIATESAVE: {
                stateType: 'ATTEMPT',
                action: getPostURL,
                resolve: 'POSTSAVE',
                reject: 'ERROR'
            },
            POSTSAVE: {
                stateType: 'ATTEMPT',
                action: postCharacterWML,
                resolve: 'GETURL',
                reject: 'ERROR'
            },
            ERROR: {
                stateType: 'CHOICE',
                choices: []
            }
        }
    }
})

export const { addItem } = characterEditSlice.actions
export const { setValue } = publicActions
export const {
    getCharacterEditByKey,
    getCharacterEditDirty,
    getCharacterEditValues,
    getStatus,
    getIntent
} = selectors

export const saveCharacter = (key: string): ThunkAction<void, RootState, unknown, AnyAction> => (dispatch, getState) => {
    const state = getState()
    const characterEdit = getCharacterEditByKey(key)(state)
    const status = getStatus(key)(state)
    const intent = getIntent(key)(state)
    if (characterEdit && status === 'PARSED' && intent === 'PARSED') {
        dispatch(characterEditSlice.actions.internalStateChange({
            key,
            newState: 'INITIATESAVE',
            data: {}
        }))
        dispatch(heartbeat)
    }
}

export default characterEditSlice.reducer
