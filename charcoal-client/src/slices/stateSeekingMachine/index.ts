import { createAction } from '@reduxjs/toolkit'
import { v4 as uuidv4 } from 'uuid'

import dijkstra from './dijkstra'
import { heartbeat } from './ssmHeartbeat'

export const ssmHeartbeat = createAction<string>('ssmHeartbeat')

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
        if (executionPath.length > 0) {
            const currentStep = focusSSM.template.states[focusSSM.currentState]
            const firstStep = focusSSM.template.states[executionPath[0]]
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
            }
            if (firstStep.stateType === 'ATTEMPT') {
                return dispatch(firstStep.action({
                        internalData: focusSSM.internalData || {},
                        publicData: focusSSM.publicData || {}
                    }))
                    .then((response: Record<string, any>) => {
                        dispatch(internalStateChange({ newState: firstStep.resolve, data: response }))
                        dispatch(heartbeat)
                    })
                    .catch((error: Record<string, any>) => {
                        dispatch(internalStateChange({ newState: firstStep.reject, data: { internalData: { error } } }))
                        dispatch(heartbeat)
                    })
            }
            //
            // TODO: Do we need a second recursive call if the next node is *not* an
            //   attempt node, and how would that be handled?
            //
        }
    }
    return Promise.resolve({})
}