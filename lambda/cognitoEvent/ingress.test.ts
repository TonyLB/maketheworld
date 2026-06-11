import { routeCognitoIngress } from './ingress'
import messageBus from './messageBus'

describe('routeCognitoIngress', () => {
    beforeEach(() => {
        messageBus.clear()
    })

    afterEach(async () => {
        await messageBus.flushAndSettle()
        messageBus.clear()
    })

    it('publishes api.cognito New Player for PostConfirmation', async () => {
        const publishSpy = jest.spyOn(messageBus, 'publish')

        await routeCognitoIngress({
            triggerSource: 'PostConfirmation_ConfirmSignUp',
            userName: 'PlayerOne'
        })
        await messageBus.flushAndSettle()

        expect(publishSpy.mock.calls[0][0]).toMatchObject({
            type: 'StreamingEvent',
            dataSourceKey: 'api.cognito',
            header: { type: 'New Player' },
        })
        const payload = publishSpy.mock.calls[0][0]
        if (payload.type !== 'StreamingEvent') {
            throw new Error('Expected streaming event payload')
        }
        await expect(payload.getContent()).resolves.toEqual({
            type: 'New Player',
            player: 'PlayerOne'
        })

        publishSpy.mockRestore()
    })

    it('does nothing for non-PostConfirmation events', async () => {
        const publishSpy = jest.spyOn(messageBus, 'publish')

        await routeCognitoIngress({
            triggerSource: 'PreSignUp_SignUp',
            userName: 'PlayerOne'
        })
        await messageBus.flushAndSettle()

        expect(publishSpy).not.toHaveBeenCalled()
        publishSpy.mockRestore()
    })
})
