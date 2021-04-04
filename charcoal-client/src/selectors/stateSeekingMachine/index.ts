import { StateSeekingMachineModule } from '../../reducers/stateSeekingMachine'

export const getHeartbeat = ({ stateSeekingMachines: { heartbeat } }: { stateSeekingMachines: { heartbeat?: string } }) => (heartbeat)

export const getLastEvaluation = ({ stateSeekingMachines: { lastEvaluation } }: { stateSeekingMachines: { lastEvaluation?: string } }) => (lastEvaluation)

export const getSSMState = (key: string) => ({ stateSeekingMachines }: { stateSeekingMachines: StateSeekingMachineModule }) => {
    return (stateSeekingMachines && stateSeekingMachines.machines?.[key]?.currentState) || null
}