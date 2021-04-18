import { produce, immerable } from 'immer'
import {
    IStateSeekingMachine,
    ISSMTemplate,
    STATE_SEEKING_MACHINE_REGISTER,
    STATE_SEEKING_MACHINE_HEARTBEAT,
    STATE_SEEKING_EXTERNAL_CHANGE,
    STATE_SEEKING_EXTERNAL_DATA,
    STATE_SEEKING_INTERNAL_CHANGE,
    STATE_SEEKING_ASSERT_DESIRE
} from '../../actions/stateSeekingMachine'

export class StateSeekingMachineModule {
    [immerable]: boolean = true;
    lastEvaluation?: string;
    heartbeat?: string;
    machines: Record<string, IStateSeekingMachine> = {};
}

export const reducer = (
    state: StateSeekingMachineModule = new StateSeekingMachineModule(),
    action: any = {}
): StateSeekingMachineModule => {
    switch (action.type) {
        case STATE_SEEKING_MACHINE_REGISTER:
            const { key, template }: { key: string; template: ISSMTemplate} = action.payload
            if (state.machines[key]) {
                return state
            }
            else {
                //
                // TODO:  Sort out Typescript union so that we don't need to cast as any here.
                //
                return produce(state, draftState => {
                    draftState.machines[key] = {
                        key,
                        template,
                        currentState: template.initialState,
                        desiredState: template.initialState,
                        data: template.initialData
                    } as any
                })
            }
        case STATE_SEEKING_MACHINE_HEARTBEAT:
            return {
                ...state,
                heartbeat: action.payload
            }
        case STATE_SEEKING_EXTERNAL_DATA:
            if (state.machines?.[action.payload.key]) {
                return produce(state, draftState => {
                    draftState.machines[action.payload.key].data = {
                        ...(draftState.machines[action.payload.key].data ?? {}),
                        ...action.payload.data
                    }
                })
            }
            else {
                return state
            }
        case STATE_SEEKING_EXTERNAL_CHANGE:
            if (state.machines?.[action.payload.key] && action.payload?.newState) {
                return produce(state, draftState => {
                    draftState.machines[action.payload.key].currentState = action.payload.newState
                })
            }
            else {
                return state
            }
        case STATE_SEEKING_INTERNAL_CHANGE:
            if (state.machines?.[action.payload.key] && action.payload?.newState) {
                return produce(state, draftState => {
                    draftState.machines[action.payload.key].currentState = action.payload.newState
                    draftState.machines[action.payload.key].data = { ...draftState.machines[action.payload.key].data, ...(action.payload.data || {}) }
                })
            }
            else {
                return state
            }
        case STATE_SEEKING_ASSERT_DESIRE:
            if (state.machines?.[action.payload.key] && action.payload?.newState) {
                return produce(state, draftState => {
                    draftState.machines[action.payload.key].desiredState = action.payload.newState
                })
            }
            else {
                return state
            }
        default: return state
    }
}

export default reducer