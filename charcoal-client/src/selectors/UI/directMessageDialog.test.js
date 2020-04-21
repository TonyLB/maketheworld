import { getDirectMessageTargetUI } from './directMessageDialog'

describe('DirectMessageDialog selector', () => {
    it('should return null from an empty state', () => {
        expect(getDirectMessageTargetUI()).toEqual('')
    })

    it('should return a value', () => {
        expect(getDirectMessageTargetUI({ UI: { directMessageDialog: 'Test'}})).toEqual('Test')
    })

})
