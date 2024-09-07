import { jest, beforeEach, describe, it, expect } from '@jest/globals'

jest.mock('./MapDThreeTree.ts')
import MapDThreeTreeRaw from './MapDThreeTree'
import { MapDThree } from '.'

import { mockClass } from '../../../../lib/jestHelpers'
import { assertTypeguard, Standardizer } from '@tonylb/mtw-wml/dist/standardize'
import { isStandardMap } from '@tonylb/mtw-wml/dist/standardize/baseClasses'
import { Schema } from '@tonylb/mtw-wml/dist/schema'
import { maybeGenericIDFromTree, stripIDFromTree } from '@tonylb/mtw-wml/dist/tree/genericIDTree'
const MapDThreeTree = mockClass(MapDThreeTreeRaw)

describe('MapDThree', () => {

    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })

    it('should initialize stack on construction', () => {
        const testSchema = new Schema()
        testSchema.loadWML(`
            <Asset key=(testOne)>
                <Map key=(testMap)>
                    <Room key=(GHI)><Position x="300" y="300" /></Room>
                    <If {true} selected>
                        <Room key=(DEF)><Position x="300" y="200" /></Room>
                        <Room key=(ABC)><Position x="200" y="200" /></Room>
                    </If>
                </Map>
            </Asset>
        `)
        const testStandard = new Standardizer(testSchema.schema)
    
        const testComponent = testStandard.standardForm.byId.testMap
        
        const testTree = assertTypeguard(testComponent, isStandardMap)?.positions ?? []

        const testMapDThree = new MapDThree({
            tree: maybeGenericIDFromTree(testTree),
            standardForm: testStandard.standardForm,
            mapId: 'testMap',
            updateStandard: () => {}
        })
        expect(MapDThreeTree).toHaveBeenCalledTimes(1)
        expect(stripIDFromTree(MapDThreeTree.mock.calls[0][0].tree as any)).toMatchSnapshot()

    })
})