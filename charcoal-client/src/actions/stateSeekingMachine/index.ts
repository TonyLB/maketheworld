import { v4 as uuidv4 } from 'uuid'
import { getHeartbeat } from '../../selectors/stateSeekingMachine';
import dijkstra from './dijkstra'
import { LifeLineSSM, LifeLineTemplate } from '../communicationsLayer/lifeLine'
import { PermanentsSubscriptionSSM, PermanentsSubscriptionTemplate } from '../communicationsLayer/appSyncSubscriptions/permanentsSubscription'
import { PlayerSubscriptionSSM, PlayerSubscriptionTemplate } from '../communicationsLayer/appSyncSubscriptions/playerSubscription'
import { EphemeraSubscriptionSSM, EphemeraSubscriptionTemplate } from '../communicationsLayer/appSyncSubscriptions/ephemeraSubscription'
import { CharacterSubscriptionSSM, CharacterSubscriptionTemplate } from '../activeCharacters'

export type ISSMTemplate = LifeLineTemplate | PermanentsSubscriptionTemplate | PlayerSubscriptionTemplate | EphemeraSubscriptionTemplate | CharacterSubscriptionTemplate
export type IStateSeekingMachine = LifeLineSSM | PermanentsSubscriptionSSM | PlayerSubscriptionSSM | EphemeraSubscriptionSSM | CharacterSubscriptionSSM

export const STATE_SEEKING_MACHINE_REGISTER = 'STATE_SEEKING_MACHINE_REGISTER'
export const STATE_SEEKING_MACHINE_HEARTBEAT = 'STATE_SEEKING_MACHINE_HEARTBEAT'
export const STATE_SEEKING_MACHINE_EVALUATION = 'STATE_SEEKING_MACHINE_EVALUATION'
export const STATE_SEEKING_EXTERNAL_CHANGE = 'STATE_SEEKING_EXTERNAL_CHANGE'
export const STATE_SEEKING_EXTERNAL_DATA = 'STATE_SEEKING_EXTERNAL_DATA'
export const STATE_SEEKING_INTERNAL_CHANGE = 'STATE_SEEKING_INTERNAL_CHANGE'
export const STATE_SEEKING_ASSERT_DESIRE = 'STATE_SEEKING_ASSERT_DESIRE'

export const registerSSM = (payload: { key: string, template: ISSMTemplate }) => ({
    type: STATE_SEEKING_MACHINE_REGISTER,
    payload
})

export const assertIntent = <K extends string>(payload: { key: string; newState: K; heartbeat?: string }) => (dispatch: any, getState: any) => {
    const state = getState()
    const currentHeartbeat = getHeartbeat(state)
    const newHeartbeat = payload.heartbeat ?? uuidv4()
    if (newHeartbeat !== currentHeartbeat) {
        dispatch({
            type: STATE_SEEKING_MACHINE_HEARTBEAT,
            payload: newHeartbeat
        })
    }
    dispatch({
        type: STATE_SEEKING_ASSERT_DESIRE,
        payload: {
            key: payload.key,
            newState: payload.newState
        }
    })
}

const ssmStateChange = <K extends string, D extends Record<string, any>>(payload: { type: 'STATE_SEEKING_EXTERNAL_CHANGE' | 'STATE_SEEKING_INTERNAL_CHANGE'; key: string; newState: K; heartbeat?: string; data?: Partial<D> }) => (dispatch: any, getState: any) => {
    const state = getState()
    const currentHeartbeat = getHeartbeat(state)
    const newHeartbeat = payload.heartbeat ?? uuidv4()
    if (newHeartbeat !== currentHeartbeat) {
        dispatch({
            type: STATE_SEEKING_MACHINE_HEARTBEAT,
            payload: newHeartbeat
        })
    }
    dispatch({
        type: payload.type,
        payload: {
            key: payload.key,
            newState: payload.newState,
            data: payload.data
        }
    })
}

export const externalStateChange = <K extends string>(payload: { key: string; newState: K; heartbeat?: string }) => {
    return ssmStateChange<K, any>({ ...payload, type: STATE_SEEKING_EXTERNAL_CHANGE })
}

export const externalDataChange = <D extends Record<string, any>>(payload: { key: string; data: Partial<D>}) => ({
    type: STATE_SEEKING_EXTERNAL_DATA,
    payload
})

const internalStateChange = <K extends string, D extends Record<string, any>>(payload: { key: string; newState: K; heartbeat?: string; data?: Partial<D> }) => {
    return ssmStateChange<K, D>({ ...payload, type: STATE_SEEKING_INTERNAL_CHANGE })
}

export const iterateOneSSM = ({ key, heartbeat }: { key: string; heartbeat: string }) => (dispatch: any, getState: any) => {
    const focusState = getState()?.stateSeekingMachines?.machines?.[key]
    if (focusState && focusState.desiredState !== focusState.currentState) {
        const executionPath = dijkstra({
            startKey: focusState.currentState,
            endKey: focusState.desiredState,
            template: focusState.template
        })
        if (executionPath.length > 0) {
            const currentStep = focusState.template.states[focusState.currentState]
            const firstStep = focusState.template.states[executionPath[0]]
            if (currentStep.stateType === 'CHOICE') {
                dispatch(exportCollection.internalStateChange<string, Record<string, any>>({ key, newState: executionPath[0], heartbeat }))
            }
            if (firstStep.stateType === 'ATTEMPT') {
                return dispatch(firstStep.action(focusState.data))
                    .then((response: Record<string, any>) => {
                        const newHeartbeat = uuidv4()
                        dispatch(exportCollection.internalStateChange<string, Record<string, any>>({ key, newState: firstStep.resolve, heartbeat: newHeartbeat, data: response }))
                    })
                    .catch(() => {
                        const newHeartbeat = uuidv4()
                        dispatch(exportCollection.internalStateChange<string, Record<string, any>>({ key, newState: firstStep.reject, heartbeat: newHeartbeat }))
                    })
            }
        }
    }
    return Promise.resolve({})
}

export const iterateAllSSMs = (dispatch: any, getState: any) => {
    const heartbeat = uuidv4()
    const stateSeekingMachines = getState()?.stateSeekingMachines?.machines
    const machinesCast = Object.values(stateSeekingMachines) as Array<IStateSeekingMachine>
    machinesCast
        .filter((value) => (value))
        .filter(({ currentState, desiredState }) => (desiredState !== currentState))
        .forEach(({ key }) => { 
            dispatch(exportCollection.iterateOneSSM({ key, heartbeat }))
        })
}

const exportCollection = {
    registerSSM,
    externalStateChange,
    internalStateChange,
    iterateOneSSM,
    iterateAllSSMs
}

export default exportCollection
