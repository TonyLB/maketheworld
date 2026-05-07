import { handler } from './app'

describe('cognitoEvent handler', () => {
    it('auto-confirms PreSignUp events', async () => {
        const event = {
            triggerSource: 'PreSignUp_SignUp',
            response: {}
        }
        const result = await handler(event)
        expect(result.response.autoConfirmUser).toBe(true)
    })

    it('returns event for non-cognito trigger values', async () => {
        const event = { triggerSource: 'SomethingElse' }
        const result = await handler(event)
        expect(result).toEqual(event)
    })
})
