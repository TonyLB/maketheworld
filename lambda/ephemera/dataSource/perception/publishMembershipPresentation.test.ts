import {
    buildMembershipArriveSuffix,
    buildMembershipLeaveSuffix,
} from './publishMembershipPresentation'

describe('publishMembershipPresentation', () => {
    describe('copy suffix helpers', () => {
        it('builds exit-aware leave suffix', () => {
            expect(buildMembershipLeaveSuffix('exitAware', 'north')).toBe(' left by north exit.')
        })

        it('builds home, disconnect, and generic leave suffixes', () => {
            expect(buildMembershipLeaveSuffix('home')).toBe(' left to return home.')
            expect(buildMembershipLeaveSuffix('disconnect')).toBe(' has disconnected.')
            expect(buildMembershipLeaveSuffix('genericNavigate')).toBe(' has left.')
        })

        it('builds connect and generic arrive suffixes', () => {
            expect(buildMembershipArriveSuffix('connect')).toBe(' has connected.')
            expect(buildMembershipArriveSuffix('genericNavigate')).toBe(' has arrived.')
        })
    })
})
