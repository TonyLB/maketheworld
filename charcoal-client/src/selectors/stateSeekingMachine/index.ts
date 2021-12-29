import { StateSeekingMachineModule } from '../../reducers/stateSeekingMachine'

export const getHeartbeat = ({ stateSeekingMachines: { heartbeat } }: { stateSeekingMachines: { heartbeat?: string } }) => (heartbeat)

export const getLastEvaluation = ({ stateSeekingMachines: { lastEvaluation } }: { stateSeekingMachines: { lastEvaluation?: string } }) => (lastEvaluation)

export const getSSMStates = ({ stateSeekingMachines} : { stateSeekingMachines: StateSeekingMachineModule }): Record<string, string> => {
    return ((stateSeekingMachines && stateSeekingMachines.machines && Object.entries(stateSeekingMachines.machines)) || [])
        .map(([key, { currentState }]: [string, { currentState: string }]) => ({ [key]: currentState }))
        .reduce((previous, entry) => ({ ...previous, ...entry }), {})
}

export const getSSMState = (key: string) => ({ stateSeekingMachines }: { stateSeekingMachines: StateSeekingMachineModule }) => {
    if (stateSeekingMachines && stateSeekingMachines.machines?.[key]) {
        return stateSeekingMachines && stateSeekingMachines.machines?.[key]?.currentState
    }
    return null
}

//
// TODO: Create a TS constraint structure such that getSSMData always gives a return value constrained to the
// specific type of SSM that is defined by its key, then remove explicit casting wherever it is used
//
export const getSSMData = (key: string) => ({ stateSeekingMachines }: { stateSeekingMachines: StateSeekingMachineModule }) => {
    return (stateSeekingMachines && stateSeekingMachines.machines?.[key]?.data) || undefined
}