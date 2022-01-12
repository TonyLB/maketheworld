import { getSSMState, getSSMData } from '../stateSeekingMachine'

export const getLifeLine = (state = {}) => {
    const lifeLineData = getSSMData('LifeLine')(state)
    return {
        ...(lifeLineData || {}),
        status: getSSMState('LifeLine')(state) || 'INITIAL'
    }
}
