import { isEphemeraClientMessageThinkingResult } from '@tonylb/mtw-interfaces/ts/ephemera'

import delayPromise from '../../lib/delayPromise'
import { getStatus, socketDispatchPromise } from '../lifeLine'
import { ThinkingResultsAction, ThinkingResultsCondition } from './baseClasses'

export const lifelineCondition: ThinkingResultsCondition = (_, getState) => {
    const status = getStatus(getState())
    return status === 'CONNECTED'
}

export const fetchThinkingResultAction: ThinkingResultsAction = ({ internalData: { id } }) => async (dispatch) => {
    if (!id) {
        throw new Error('Missing workItemId')
    }

    const response = await dispatch(socketDispatchPromise({
        message: 'fetchThinkingResult',
        workItemId: id
    }))

    if (isEphemeraClientMessageThinkingResult(response)) {
        return {
            publicData: {
                result: response.result,
                fetchError: undefined
            },
            internalData: {
                incrementalBackoff: 0.5
            }
        }
    }

    throw new Error('Unexpected response from fetchThinkingResult')
}

export const backoffAction: ThinkingResultsAction = ({ internalData: { incrementalBackoff = 0.5 } }) => async () => {
    if (incrementalBackoff >= 30) {
        throw new Error()
    }
    await delayPromise(incrementalBackoff * 1000)
    return { internalData: { incrementalBackoff: Math.min(incrementalBackoff * 2, 30) } }
}
