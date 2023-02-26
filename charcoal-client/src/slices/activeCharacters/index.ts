import { objectMap } from '../../lib/objects'
import { ActiveCharacterNodes } from './baseClasses'
import { multipleSSM, multipleSSMSlice } from '../stateSeekingMachine/multipleSSM'
import {
    lifelineCondition,
    fetchAction,
    registerAction,
    syncAction,
    backoffAction,
    mapSubscribeAction,
    mapUnsubscribeAction,
    unregisterAction
} from './index.api'
import receiveMapEphemera from './receiveMapEphemera'
import { publicSelectors, PublicSelectors } from './selectors'

export const {
    slice: activeCharactersSlice,
    selectors,
    publicActions,
    iterateAllSSMs
} = multipleSSM<ActiveCharacterNodes, PublicSelectors>({
    name: 'activeCharacters',
    initialSSMState: 'INITIAL',
    initialSSMDesired: ['CONNECTED'],
    initialData: {
        internalData: {
            incrementalBackoff: 0.5
        },
        publicData: {
            maps: {}
        }
    },
    sliceSelector: ({ activeCharacters }) => (activeCharacters),
    publicReducers: {
        receiveMapEphemera
    },
    publicSelectors,
    template: {
        initialState: 'INITIAL',
        initialData: {
            internalData: {
                incrementalBackoff: 0.5
            },
            publicData: {
                maps: {}
            }
        },
        states: {
            INITIAL: {
                stateType: 'HOLD',
                next: 'INACTIVE',
                condition: lifelineCondition
            },
            INACTIVE: {
                stateType: 'CHOICE',
                choices: ['FETCHFROMCACHE']
            },
            FETCHFROMCACHE: {
                stateType: 'ATTEMPT',
                action: fetchAction,
                resolve: 'REGISTER',
                reject: 'ERROR'
            },
            REGISTER: {
                stateType: 'ATTEMPT',
                action: registerAction,
                resolve: 'SYNCHRONIZE',
                reject: 'ERROR'
            },
            SYNCHRONIZE: {
                stateType: 'ATTEMPT',
                action: syncAction,
                resolve: 'CONNECTED',
                reject: 'SYNCHRONIZEBACKOFF'
            },
            SYNCHRONIZEBACKOFF: {
                stateType: 'ATTEMPT',
                action: backoffAction,
                resolve: 'SYNCHRONIZE',
                reject: 'ERROR'
            },
            CONNECTED: {
                stateType: 'CHOICE',
                choices: ['UNREGISTER', 'MAPSUBSCRIBE']
            },
            UNREGISTER: {
                stateType: 'ATTEMPT',
                action: unregisterAction,
                resolve: 'INACTIVE',
                reject: 'INACTIVE'
            },
            MAPSUBSCRIBE: {
                stateType: 'ATTEMPT',
                action: mapSubscribeAction,
                resolve: 'MAPSUBSCRIBED',
                reject: 'ERROR'
            },
            MAPSUBSCRIBED: {
                stateType: 'CHOICE',
                choices: ['MAPUNSUBSCRIBE']
            },
            MAPUNSUBSCRIBE: {
                stateType: 'ATTEMPT',
                action: mapUnsubscribeAction,
                resolve: 'CONNECTED',
                reject: 'CONNECTED'
            },
            ERROR: {
                stateType: 'CHOICE',
                choices: []
            }
        }
    }
})

export const { addItem, setIntent } = activeCharactersSlice.actions
// export const { } = publicActions
export const {
    getActiveCharacterMaps
} = selectors

type ActiveCharacterSlice = multipleSSMSlice<ActiveCharacterNodes>

export const getActiveCharacters = ({ activeCharacters }: { activeCharacters: ActiveCharacterSlice }) => {
    return objectMap(
        activeCharacters.byId,
        ({ meta: { currentState }}: { meta: { currentState: keyof ActiveCharacterNodes } }) => ({
            state: currentState,
            isSubscribing: [
                'FETCHFROMCACHE',
                'REGISTER',
            ].includes(currentState),
            isSubscribed: [
                'SYNCHRONIZE',
                'SYNCHRONIZEBACKOFF',
                'CONNECTED'
            ].includes(currentState),
            isConnecting: currentState === 'SYNCHRONIZE',
            isConnected: currentState === 'CONNECTED'
        })
    )
}



export default activeCharactersSlice.reducer
