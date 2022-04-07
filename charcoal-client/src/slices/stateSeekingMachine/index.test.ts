import { describe, beforeEach, expect, it } from '@jest/globals'

import {
    ISSMAttemptNode,
    ISSMChoiceNode,
    ISSMHoldNode,
    ISSMRedirectNode,
    TemplateFromNodes
} from './baseClasses'

jest.mock('./ssmHeartbeat')
import { heartbeat } from './ssmHeartbeat'

import { iterateOneSSM } from './'

type testSSMData = {
    value: string;
}
type testSSMNodes = {
    INITIAL: ISSMChoiceNode;
    HOLD: ISSMHoldNode<testSSMData, {}>;
    CHOICE: ISSMChoiceNode;
    ATTEMPT: ISSMAttemptNode<testSSMData, {}>;
    LANDING: ISSMChoiceNode;
    ALTERNATE: ISSMChoiceNode;
    ERROR: ISSMChoiceNode;
    REDIRECT: ISSMRedirectNode;
    REATTEMPT: ISSMAttemptNode<testSSMData, { value: string }>;
    REATTEMPTALTERNATE: ISSMAttemptNode<testSSMData, { value: string }>;
}

type TestTemplate = TemplateFromNodes<testSSMNodes>

describe('iterateOneSSM', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })

    const dispatch = jest.fn()
    const getState = jest.fn()
    const internalStateChange = jest.fn() as jest.MockedFunction<{ (arg: { newState: string, inProgress?: string }): ({ newState: string, inProgress?: string }) }>
    const internalIntentChange = jest.fn() as jest.MockedFunction<{ (arg: { newIntent: string[] }): ({ newIntent: string[] }) }>
    const getSSMData = jest.fn()
    const condition = jest.fn()
    const attempt = jest.fn()

    const baseGraph: TestTemplate = {
        initialState: 'INITIAL',
        initialData: { internalData: { value: '' }, publicData: {} },
        states: {
            INITIAL: {
                stateType: 'CHOICE',
                choices: ['HOLD']
            },
            HOLD: {
                stateType: 'HOLD',
                condition,
                next: 'CHOICE'
            },
            CHOICE: {
                stateType: 'CHOICE',
                choices: ['ATTEMPT', 'ALTERNATE']
            },
            ATTEMPT: {
                stateType: 'ATTEMPT',
                action: attempt,
                resolve: 'LANDING',
                reject: 'ERROR'
            },
            LANDING: {
                stateType: 'CHOICE',
                choices: ['REDIRECT']
            },
            ALTERNATE: {
                stateType: 'CHOICE',
                choices: ['REDIRECT']
            },
            ERROR: {
                stateType: 'CHOICE',
                choices: ['CHOICE']
            },
            REDIRECT: {
                stateType: 'REDIRECT',
                newIntent: ['LANDING', 'ERROR'],
                choices: ['REATTEMPT', 'REATTEMPTALTERNATE']
            },
            REATTEMPT: {
                stateType: 'ATTEMPT',
                action: attempt,
                resolve: 'LANDING',
                reject: 'ERROR'
            },
            REATTEMPTALTERNATE: {
                stateType: 'ATTEMPT',
                action: attempt,
                resolve: 'ALTERNATE',
                reject: 'ERROR'
            }
        }
    }

    it('should hold on a false hold condition', async () => {
        getSSMData.mockReturnValue({
            currentState: 'HOLD',
            desiredStates: ['LANDING'],
            internalData: {},
            publicData: {},
            template: baseGraph
        })
        condition.mockReturnValue(false)
        await iterateOneSSM({
            getSSMData,
            internalIntentChange,
            internalStateChange,
            actions: {}
        })(dispatch, getState)
        expect(dispatch).toHaveBeenCalledTimes(0)
    })

    it('should advance on a true hold condition', async () => {
        getSSMData.mockReturnValue({
            currentState: 'HOLD',
            desiredStates: ['LANDING'],
            internalData: {},
            publicData: {},
            template: baseGraph
        })
        condition.mockReturnValue(true)
        internalStateChange.mockImplementation(({ newState }) => ({ newState }))
        await iterateOneSSM({
            getSSMData,
            internalIntentChange,
            internalStateChange,
            actions: {}
        })(dispatch, getState)
        expect(dispatch).toHaveBeenCalledTimes(2)
        expect(dispatch).toHaveBeenCalledWith({ newState: 'CHOICE' })
        expect(dispatch).toHaveBeenCalledWith(heartbeat)
    })


    it('should choose the right path on a choice node part 1', async () => {
        getSSMData.mockReturnValue({
            currentState: 'CHOICE',
            desiredStates: ['LANDING'],
            internalData: {},
            publicData: {},
            template: baseGraph
        })
        internalStateChange.mockImplementation(({ newState }) => ({ newState }))
        await iterateOneSSM({
            getSSMData,
            internalIntentChange,
            internalStateChange,
            actions: {}
        })(dispatch, getState)
        expect(dispatch).toHaveBeenCalledTimes(2)
        expect(dispatch).toHaveBeenCalledWith({ newState: 'ATTEMPT' })
        expect(dispatch).toHaveBeenCalledWith(heartbeat)
    })

    it('should choose the right path on a choice node part 2', async () => {
        getSSMData.mockReturnValue({
            currentState: 'CHOICE',
            desiredStates: ['ALTERNATE', 'ERROR'],
            internalData: {},
            publicData: {},
            template: baseGraph
        })
        internalStateChange.mockImplementation(({ newState }) => ({ newState }))
        await iterateOneSSM({
            getSSMData,
            internalIntentChange,
            internalStateChange,
            actions: {}
        })(dispatch, getState)
        expect(dispatch).toHaveBeenCalledTimes(2)
        expect(dispatch).toHaveBeenCalledWith({ newState: 'ALTERNATE' })
        expect(dispatch).toHaveBeenCalledWith(heartbeat)
    })

    it('should advance on a successful attempt node execution', async () => {
        getSSMData.mockReturnValue({
            currentState: 'ATTEMPT',
            desiredStates: ['LANDING'],
            internalData: {},
            publicData: {},
            template: baseGraph
        })
        internalStateChange.mockImplementation(({ newState, inProgress }) => ({ newState, inProgress }))
        attempt.mockResolvedValue({})
        dispatch.mockResolvedValue({})
        await iterateOneSSM({
            getSSMData,
            internalIntentChange,
            internalStateChange,
            actions: {}
        })(dispatch, getState)
        expect(dispatch).toHaveBeenCalledTimes(4)
        expect(dispatch).toHaveBeenCalledWith({ newState: 'ATTEMPT', inProgress: 'ATTEMPT' })
        expect(dispatch).toHaveBeenCalledWith({ newState: 'LANDING', inProgress: null })
        expect(dispatch).toHaveBeenCalledWith(heartbeat)
    })

    it('should advance on a failed attempt node execution', async () => {
        getSSMData.mockReturnValue({
            currentState: 'ATTEMPT',
            desiredStates: ['LANDING'],
            internalData: {},
            publicData: {},
            template: baseGraph
        })
        internalStateChange.mockImplementation(({ newState, inProgress }) => ({ newState, inProgress }))
        attempt.mockResolvedValue({})
        dispatch.mockReturnValueOnce({}).mockRejectedValueOnce({}).mockReturnValue({})
        await iterateOneSSM({
            getSSMData,
            internalIntentChange,
            internalStateChange,
            actions: {}
        })(dispatch, getState)
        expect(dispatch).toHaveBeenCalledTimes(4)
        expect(dispatch).toHaveBeenCalledWith({ newState: 'ATTEMPT', inProgress: 'ATTEMPT' })
        expect(dispatch).toHaveBeenCalledWith({ newState: 'ERROR', inProgress: null })
        expect(dispatch).toHaveBeenCalledWith(heartbeat)
    })

    it('should update intent on a redirect node', async () => {
        getSSMData.mockReturnValue({
            currentState: 'REDIRECT',
            desiredStates: ['REDIRECT'],
            internalData: {},
            publicData: {},
            template: baseGraph
        })
        internalStateChange.mockImplementation(({ newState }) => ({ newState }))
        internalIntentChange.mockImplementation(({ newIntent }) => ({ newIntent }))
        await iterateOneSSM({
            getSSMData,
            internalIntentChange,
            internalStateChange,
            actions: {}
        })(dispatch, getState)
        expect(dispatch).toHaveBeenCalledTimes(3)
        expect(dispatch).toHaveBeenCalledWith({ newIntent: ['LANDING', 'ERROR']})
        expect(dispatch).toHaveBeenCalledWith({ newState: 'REATTEMPT' })
        expect(dispatch).toHaveBeenCalledWith(heartbeat)
    })

})