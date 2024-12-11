import standardSubset from './standardSubset'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'

describe('standardSubset', () => {
    const testSource = `<Asset key=(Test)>
        <Room key=(testOne)>
            <Description>
                One
            </Description>
        </Room>
        <Room key=(testOne)>
            <Description>
                Three
            </Description>
        </Room>
        <Room key=(testTwo)>
            <Description>
                <Link to=(testFeature)>test</Link>
            </Description>
        </Room>
        <Feature key=(testFeature) />
        <Map key=(testMap)>
            <Room key=(testOne)><Position x="0" y="0" /></Room>
        </Map>
    </Asset>`
    const testStandard = new StandardForm(testSource)

    it('should return only a wrapper when passed no keys', () => {
        const subset = standardSubset({ standard: testStandard, keys: [], stubKeys: [] })
        expect(subset.newStubKeys).toEqual([])
        expect(subset.standard.toJSON()).toEqual({ key: 'Test', byId: {}, metaData: [] })
    })

    it('should return stubs for features linked in description', () => {
        const subset = standardSubset({ standard: testStandard, keys: ['testTwo'], stubKeys: [] })
        expect(subset.newStubKeys).toEqual([])
        expect(subset.standard.toJSON()).toEqual({
            key: 'Test',
            metaData: [],
            byId: {
                testTwo: {
                    key: 'testTwo',
                    tag: 'Room',
                    description: {
                        data: { tag: 'Description' },
                        children: [{
                            data: { tag: 'Link', text: 'test', to: 'testFeature' },
                            children: [{ data: { tag: 'String', value: 'test' }, children: [] }]
                        }]
                    },
                    exits: [],
                    themes: []
                },
                testFeature: {
                    key: 'testFeature',
                    tag: 'Feature'
                }
            }
        })
    })

    it('should return stubs for rooms linked in map', () => {
        const subset = standardSubset({ standard: testStandard, keys: ['testMap'], stubKeys: [] })
        expect(subset.newStubKeys).toEqual([])
        expect(subset.standard.toJSON()).toEqual({
            key: 'Test',
            metaData: [],
            byId: {
                testMap: {
                    key: 'testMap',
                    tag: 'Map',
                    positions: [{ data: { tag: 'Room', key: 'testOne' }, children: [{ data: { tag: 'Position', x: 0, y: 0  }, children: [] }]}],
                    images: [],
                    themes: []
                },
                testOne: {
                    key: 'testOne',
                    tag: 'Room',
                    exits: [],
                    themes: []
                }
            }
        })
    })

})