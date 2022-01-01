import { createAction } from '@reduxjs/toolkit'
import { v4 as uuidv4 } from 'uuid'

import dijkstra from './dijkstra'
import { heartbeat } from './ssmHeartbeat'

export const iterateOneSSM = ({
    internalStateChange,
    getSSMData
}: {
    //
    // TODO: Figure out how to type-constrain these function arguments
    //
    internalStateChange: any;
    getSSMData: any;
}) => (dispatch: any, getState: any) => {
    const focusSSM = getSSMData(getState())
    if (focusSSM && focusSSM.desiredState !== focusSSM.currentState) {
        const executionPath = dijkstra({
            startKey: focusSSM.currentState,
            endKey: focusSSM.desiredState,
            template: focusSSM.template
        })
        console.log(`Execution path (${focusSSM.currentState} => ${focusSSM.desiredState}): ${JSON.stringify(executionPath, null, 4)}`)
        if (executionPath.length > 0) {
            const currentStep = focusSSM.template.states[focusSSM.currentState]
            if (['HOLD', 'CHOICE'].includes(currentStep.stateType)) {
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
                const { template, ...rest } = focusSSM
                console.log(`FocusSSM: ${JSON.stringify(rest, null, 4)}`)
                if (focusSSM.inProgress === focusSSM.currentState) {
                    return Promise.resolve({})
                }
                dispatch(internalStateChange({
                    newState: focusSSM.currentState,
                    data: {
                        internalData: { inProgress: focusSSM.inProgress }
                    }
                }))
                return dispatch(currentStep.action({
                        internalData: focusSSM.internalData || {},
                        publicData: focusSSM.publicData || {}
                    }))
                    .then((response: Record<string, any>) => {
                        dispatch(internalStateChange({ newState: currentStep.resolve, data: response }))
                        dispatch(heartbeat)
                    })
                    .catch((error: Record<string, any>) => {
                        dispatch(internalStateChange({ newState: currentStep.reject, data: { internalData: { error } } }))
                        dispatch(heartbeat)
                    })
            }
        }
    }
    return Promise.resolve({})
}