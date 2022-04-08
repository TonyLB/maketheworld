import dijkstra from './dijkstra'
import { heartbeat } from './ssmHeartbeat'

export const iterateOneSSM = ({
    internalStateChange,
    internalIntentChange,
    getSSMData,
    actions
}: {
    //
    // TODO: Figure out how to type-constrain these function arguments
    //
    internalStateChange: any;
    internalIntentChange: any;
    getSSMData: any;
    actions: Record<string, any>;
}) => (dispatch: any, getState: any) => {
    const focusSSM = getSSMData(getState())
    console.log(`Iterating from ${focusSSM.currentState}`)
    const currentStep = focusSSM.template.states[focusSSM.currentState]
    if (currentStep.stateType === 'REDIRECT') {
        console.log(`Redirecting: ${JSON.stringify(currentStep.newIntent, null, 4)}`)
        dispatch(internalIntentChange({ newIntent: currentStep.newIntent }))
    }
    const desiredStates = currentStep.stateType === 'REDIRECT' ? currentStep.newIntent : focusSSM.desiredStates
    if (focusSSM && !desiredStates.includes(focusSSM.currentState)) {
        const executionPath = dijkstra({
            startKey: focusSSM.currentState,
            endKeys: desiredStates,
            template: focusSSM.template
        })
        if (executionPath.length > 0) {
            if (['REDIRECT', 'HOLD', 'CHOICE'].includes(currentStep.stateType)) {
                if (currentStep.stateType === 'HOLD') {
                    const conditionalResult = currentStep.condition({
                        internalData: focusSSM.internalData,
                        publicData: focusSSM.publicData
                    }, getState)
                    if (!conditionalResult) {
                        return Promise.resolve({})
                    }
                }
                dispatch(internalStateChange({ newState: executionPath[0] }))
                dispatch(heartbeat)
            }
            if (currentStep.stateType === 'ATTEMPT') {
                if (focusSSM.inProgress === focusSSM.currentState) {
                    return Promise.resolve({})
                }
                dispatch(internalStateChange({
                    newState: focusSSM.currentState,
                    inProgress: focusSSM.currentState,
                    data: {}
                }))
                return dispatch(currentStep.action({
                        internalData: focusSSM.internalData || {},
                        publicData: focusSSM.publicData || {},
                        actions
                    }))
                    .then((response: Record<string, any>) => {
                        dispatch(internalStateChange({ newState: currentStep.resolve, inProgress: null, data: response }))
                        dispatch(heartbeat)
                    })
                    .catch((error: Record<string, any>) => {
                        dispatch(internalStateChange({ newState: currentStep.reject, inProgress: null, data: { internalData: { error } } }))
                        dispatch(heartbeat)
                    })
            }
        }
    }
    return Promise.resolve({})
}