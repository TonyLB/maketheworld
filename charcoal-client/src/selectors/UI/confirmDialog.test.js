import { getCurrentConfirmDialogUI } from './confirmDialog'

const testOne = {
    title: 'Test',
    content: 'Are you sure you want to test?',
    resolveButtonTitle: 'Test',
    resolve: () => {}
}

const testTwo = {
    title: 'Another test',
    content: 'Even after what happened last time?',
    resolveButtonTitle: "I know what I'm doing!",
    resolve: () => {}
}

describe('ConfirmDialog selector', () => {
    it('should return null from an empty state', () => {
        expect(getCurrentConfirmDialogUI()).toBe(null)
    })

    it('should do return null from an empty stack', () => {
        expect(getCurrentConfirmDialogUI({ UI: { confirmDialog: [] }})).toBe(null)
    })

    it('should return top of stack', () => {
        expect(getCurrentConfirmDialogUI({ UI: { confirmDialog: [testOne, testTwo ]}})).toEqual(testOne)
    })

})
