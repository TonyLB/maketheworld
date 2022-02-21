import { jest, describe, it, expect } from '@jest/globals'

import recalculateComputes from "./recalculateComputes.js"

describe('recalculateComputes', () => {

    const stateFactory = ({
        power = true, switchedOn = true, wobbly = false, lightsOn = true, lightsOnSrc = 'power && switchedOn', lightsOff = false
    } = {}) => ({
        power: { value: power },
        switchedOn: { value: switchedOn },
        wobbly: { value: wobbly },
        lightsOn: {
            computed: true,
            src: lightsOnSrc,
            value: lightsOn
        },
        lightsOff: {
            computed: true,
            src: '!lightsOn',
            value: lightsOff
        }
    })

    const testDependencies = {
        power: {
            computed: ['lightsOn']
        },
        switchedOn: {
            computed: ['lightsOn']
        },
        lightsOn: {
            computed: ['lightsOff']
        }
    }

    it('should return unchanged on empty recalculated string', () => {
        expect(recalculateComputes(
            stateFactory(),
            testDependencies,
            []
        )).toEqual({
            state: stateFactory(),
            recalculated: []
        })
    })

    it('should return unchanged when everything has already been recalculated', () => {
        expect(recalculateComputes(
            stateFactory({ power: false }),
            testDependencies,
            ['power', 'switchedOn', 'wobbly', 'lightsOn', 'lightsOff']
        )).toEqual({
            state: stateFactory({ power: false }),
            recalculated: ['power', 'switchedOn', 'wobbly', 'lightsOn', 'lightsOff']
        })
    })

    it('should calculate a cascade', () => {
        expect(recalculateComputes(
            stateFactory({
                switchedOn: false
            }),
            testDependencies,
            ['switchedOn']
        )).toEqual({
            state: stateFactory({ switchedOn: false, lightsOn: false, lightsOff: true }),
            recalculated: ['switchedOn', 'lightsOn', 'lightsOff']
        })
    })

    it('should ignore a change in variable with no dependencies', () => {
        expect(recalculateComputes(
            stateFactory({
                wobbly: true
            }),
            testDependencies,
            ['wobbly']
        )).toEqual({
            state: stateFactory({ wobbly: true }),
            recalculated: ['wobbly']
        })
    })

    it('should break a cascade when calculated value matches previous', () => {
        expect(recalculateComputes(
            stateFactory({
                switchedOn: false,
                lightsOnSrc: 'power || switchedOn'
            }),
            testDependencies,
            ['switchedOn']
        )).toEqual({
            state: stateFactory({
                switchedOn: false,
                lightsOnSrc: 'power || switchedOn'
            }),
            recalculated: ['switchedOn']
        })
    })

    it('should properly order a complex cascade', () => {
        expect(recalculateComputes(
            {
                power: { value: true },
                switchedOn: { value: false },
                lightsOn: { computed: true, src: 'power && switchedOn', value: true },
                lightsOff: { computed: true, src: '!lightsOff', value: false },
                emergencyLights: { computed: true, src: 'lightsOff && power', value: false }
            },
            {
                power: { computed: ['lightsOn', 'emergencyLights'] },
                switchedOn: { computed: ['lightsOn'] },
                lightsOn: { computed: ['lightsOff'] },
                lightsOff: { computed: ['emergencyLights'] }
            },
            ['switchedOn']
        )).toEqual({
            state: {
                power: { value: true },
                switchedOn: { value: false },
                lightsOn: { computed: true, src: 'power && switchedOn', value: false },
                lightsOff: { computed: true, src: '!lightsOff', value: true },
                emergencyLights: { computed: true, src: 'lightsOff && power', value: true }
            },
            recalculated: ['switchedOn', 'lightsOn', 'lightsOff', 'emergencyLights']
        })
    })
})