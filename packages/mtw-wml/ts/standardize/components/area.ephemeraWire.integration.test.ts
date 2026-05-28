import { standardComponentFactory } from '../componentFactory'
import { StandardAreaData } from './dataTypes/area'
import StandardArea from './area'

const areaData: StandardAreaData = {
    tag: 'Area',
    key: 'downtown',
    universalKey: 'AREA#downtown',
    shortName: 'Downtown',
    positionGraph: {
        nodes: [
            { tag: 'Room', key: 'cafe' },
            { tag: 'Feature', key: 'fountain' },
        ],
    },
}

describe('StandardArea ephemeraWire integration', () => {
    it('constructs from JSON in ephemeraWire mode via factory', () => {
        const assetResult = standardComponentFactory(areaData, { standardizeMode: 'asset' })
        const wireResult = standardComponentFactory(areaData, { standardizeMode: 'ephemeraWire' })

        expect(assetResult.component).toBeInstanceOf(StandardArea)
        expect(wireResult.component).toBeInstanceOf(StandardArea)
        expect(assetResult.component!.toJSON()).toEqual(wireResult.component!.toJSON())
    })

    it('parses schema children identically in asset and ephemeraWire modes', () => {
        const node = {
            data: { tag: 'Area' as const, key: 'downtown' },
            children: [
                { data: { tag: 'Room' as const, key: 'cafe' }, children: [] },
                { data: { tag: 'Feature' as const, key: 'fountain' }, children: [] },
            ],
        }

        const assetResult = standardComponentFactory(node, { standardizeMode: 'asset' })
        const wireResult = standardComponentFactory(node, { standardizeMode: 'ephemeraWire' })

        expect((assetResult.component as StandardArea).positionGraph.nodes.toJSON()).toEqual(
            (wireResult.component as StandardArea).positionGraph.nodes.toJSON()
        )
    })
})
