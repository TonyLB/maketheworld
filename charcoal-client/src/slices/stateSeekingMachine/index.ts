import { createAction } from '@reduxjs/toolkit'
import { v4 as uuidv4 } from 'uuid'
import { consolidateToLevel } from '../../components/DraggableTree/flatToNested'

import dijkstra from './dijkstra'
import { heartbeat } from './ssmHeartbeat'

export const iterateOneSSM = ({
    internalStateChange,
    getSSMData,
    actions
}: {
    //
    // TODO: Figure out how to type-constrain these function arguments
    //
    internalStateChange: any;
    getSSMData: any;
    actions: Record<string, any>;
}) => (dispatch: any, getState: any) => {
    const focusSSM = getSSMData(getState())
    if (focusSSM && focusSSM.desiredState !== focusSSM.currentState) {
        const executionPath = dijkstra({
            startKey: focusSSM.currentState,
            endKey: focusSSM.desiredState,
            template: focusSSM.template
        })
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