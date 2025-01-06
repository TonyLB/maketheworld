jest.mock('./MapDThreeTree.ts')
import MapDThreeTreeRaw from './MapDThreeTree'
import { MapDThree } from '.'

import { mockClass } from '../../../../lib/jestHelpers'
import { assertInstance, StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { Schema } from '@tonylb/mtw-wml/ts/schema'
import StandardMap from '@tonylb/mtw-wml/ts/standardize/components/map'
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
        const testStandard = new StandardForm(testSchema.schema[0])
    
        const testComponent = testStandard.byId.testMap
        
        const testTree = assertInstance(testComponent, StandardMap)?.positions ?? []

        const testMapDThree = new MapDThree({
            tree: testTree,
            standardForm: testStandard.toJSON(),
            mapId: 'testMap',
            updateStandard: () => {}
        })
        expect(MapDThreeTree).toHaveBeenCalledTimes(1)
        expect(MapDThreeTree.mock.calls[0][0].tree).toMatchSnapshot()

    })
})