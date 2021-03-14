export type ISSMStateKey = string;

interface ISSMCall {
    (): void;
}

export interface ISSMChoice {
    immediate: ISSMStateKey;
    intended: ISSMStateKey;
    call: ISSMCall;
}

interface ISSMPotentialState {
    key: ISSMStateKey;
    choices: Array<ISSMChoice>;
    externals: Array<ISSMStateKey>;
}

export interface ISSMTemplate {
    initialState: ISSMStateKey;
    states: Record<ISSMStateKey, ISSMPotentialState>;
}

interface IStateSeekingMachine {
    template: ISSMTemplate;
    currentState: ISSMStateKey;
    desiredState: ISSMStateKey;
}

export const STATE_SEEKING_MACHINE_REGISTER = 'STATE_SEEKING_MACHINE_REGISTER'
export const STATE_SEEKING_EXTERNAL_CHANGE = 'STATE_SEEKING_EXTERNAL_CHANGE'

export const registerSSM = (payload: { key: string, template: ISSMTemplate }) => ({
    type: STATE_SEEKING_MACHINE_REGISTER,
    payload
})

export const externalStateChange = (payload: { key: string, newState: ISSMStateKey }) => ({
    type: STATE_SEEKING_EXTERNAL_CHANGE,
    payload
})

export const iterateOneSSM = (focusState: IStateSeekingMachine) => (dispatch: any) => {

}