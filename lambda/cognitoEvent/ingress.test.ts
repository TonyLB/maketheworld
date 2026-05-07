import { routeCognitoIngress } from './ingress'
import messageBus from './messageBus'

describe('routeCognitoIngress', () => {
    beforeEach(() => {
        messageBus.clear()
    })

    it('enqueues api.cognito New Player for PostConfirmation', async () => {
        await routeCognitoIngress({
            triggerSource: 'PostConfirmation_ConfirmSignUp',
            userName: 'PlayerOne'
        })

        expect(messageBus._stream).toHaveLength(1)
        const payload = messageBus._stream[0].payload
        expect(payload.type).toBe('StreamingEvent')
        if (payload.type !== 'StreamingEvent') {
            throw new Error('Expected streaming event payload')
        }
        expect(payload.dataSourceKey).toBe('api.cognito')
        expect(payload.header.type).toBe('New Player')
        await expect(payload.getContent()).resolves.toEqual({
            type: 'New Player',
            player: 'PlayerOne'
        })
    })

    it('does nothing for non-PostConfirmation events', async () => {
        await routeCognitoIngress({
            triggerSource: 'PreSignUp_SignUp',
            userName: 'PlayerOne'
        })
        expect(messageBus._stream).toHaveLength(0)
    })
})
