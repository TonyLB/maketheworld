import { v4 as uuidv4 } from 'uuid'
import { getHeartbeat } from '../../selectors/stateSeekingMachine';
import dijkstra from './dijkstra'

export type ISSMStateKey = string;

interface ISSMAction {
    (dispatch: any, getState: any): void | Object;
}

export interface ISSMChoiceState<K> {
    key: K;
    stateType: 'CHOICE';
    choices: Array<K>;
}

export interface ISSMAttemptState<K> {
    key: K;
    stateType: 'ATTEMPT';
    action: ISSMAction;
    resolve: K;
    reject: K;
}

export type ISSMPotentialState<K> = ISSMChoiceState<K> | ISSMAttemptState<K>

export interface ISSMTemplate<K extends string> {
    initialState: K;
    states: Record<K, ISSMPotentialState<K>>;
}

export interface IStateSeekingMachine<K extends string> {
    key: string;
    template: ISSMTemplate<K>;
    currentState: K;
    desiredState: K;
}

export const STATE_SEEKING_MACHINE_REGISTER = 'STATE_SEEKING_MACHINE_REGISTER'
export const STATE_SEEKING_MACHINE_HEARTBEAT = 'STATE_SEEKING_MACHINE_HEARTBEAT'
export const STATE_SEEKING_MACHINE_EVALUATION = 'STATE_SEEKING_MACHINE_EVALUATION'
export const STATE_SEEKING_EXTERNAL_CHANGE = 'STATE_SEEKING_EXTERNAL_CHANGE'
export const STATE_SEEKING_ASSERT_DESIRE = 'STATE_SEEKING_ASSERT_DESIRE'

export const registerSSM = <K extends string>(payload: { key: string, template: ISSMTemplate<K> }) => ({
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

export const externalStateChange = <K extends string>(payload: { key: string; newState: K; heartbeat?: string }) => (dispatch: any, getState: any) => {
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
        type: STATE_SEEKING_EXTERNAL_CHANGE,
        payload: {
            key: payload.key,
            newState: payload.newState
        }
    })
}

export const iterateOneSSM = ({ key, heartbeat }: { key: string; heartbeat: string }) => (dispatch: any, getState: any) => {
    const focusState = getState()?.stateSeekingMachines?.machines?.[key] as IStateSeekingMachine<string>
    if (focusState && focusState.desiredState !== focusState.currentState) {
        const executionPath = dijkstra<string>({
            startKey: focusState.currentState,
            endKey: focusState.desiredState,
            template: focusState.template
        })
        if (executionPath.length > 0) {
            const currentStep = focusState.template.states[focusState.currentState]
            const firstStep = focusState.template.states[executionPath[0]]
            if (currentStep.stateType === 'CHOICE') {
                dispatch(exportCollection.externalStateChange<string>({ key, newState: executionPath[0], heartbeat }))
            }
            if (firstStep.stateType === 'ATTEMPT') {
                return dispatch(firstStep.action)
                    .then(() => {
                        const newHeartbeat = uuidv4()
                        dispatch(exportCollection.externalStateChange<string>({ key, newState: firstStep.resolve, heartbeat: newHeartbeat }))
                    })
                    .catch(() => {
                        const newHeartbeat = uuidv4()
                        dispatch(exportCollection.externalStateChange<string>({ key, newState: firstStep.reject, heartbeat: newHeartbeat }))
                    })
            }
            else {
                return Promise.resolve({})
            }
        }
    }
}

export const iterateAllSSMs = (dispatch: any, getState: any) => {
    const heartbeat = uuidv4()
    const stateSeekingMachines = getState()?.stateSeekingMachines?.machines as Record<string, IStateSeekingMachine<string>>
    const machinesCast = Object.values(stateSeekingMachines) as Array<IStateSeekingMachine<string>>
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
    iterateOneSSM,
    iterateAllSSMs
}

export default exportCollection
