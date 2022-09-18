import { jest, describe, expect, it } from '@jest/globals'

jest.mock('uuid')
import { v4 as uuidv4 } from 'uuid'
import ScopeMap from './scopeMap.js'

describe('ScopeMap class', () => {
    describe('serialize', () => {
        it('should return empty on uninitialized class', () => {
            const testScope = new ScopeMap()
            expect(testScope.serialize()).toEqual({})
        })

        it('should return map initialized', () => {
            const testScope = new ScopeMap({
                VORTEX: 'ROOM#VORTEX',
                Welcome: 'ROOM#123456'
            })
            expect(testScope.serialize()).toEqual({
                VORTEX: 'ROOM#VORTEX',
                Welcome: 'ROOM#123456'
            })
        })
    })

})