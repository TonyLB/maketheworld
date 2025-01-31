import * as MapDThreeTreeModule from './MapDThreeTree'
vi.mock('./MapDThreeTree')
import { MapDThree } from '.'

import { assertInstance, StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { Schema } from '@tonylb/mtw-wml/ts/schema'
import StandardMap from '@tonylb/mtw-wml/ts/standardize/components/map'

describe('MapDThree', () => {

    beforeEach(() => {
        vi.clearAllMocks()
        vi.resetAllMocks()
    })

    it('should initialize stack on construction', () => {
        const mapTreeSpy = vi.spyOn(MapDThreeTreeModule, 'MapDThreeTree')

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

        new MapDThree({
            tree: testTree,
            standardForm: testStandard.toJSON(),
            mapId: 'testMap',
            updateStandard: () => {}
        })
        expect(mapTreeSpy).toHaveBeenCalledTimes(1)
        expect(mapTreeSpy.mock.calls[0][0].tree).toMatchSnapshot()

    })
})