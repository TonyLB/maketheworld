import standardSubset from './standardSubset'
import { Standardizer } from '@tonylb/mtw-wml/ts/standardize'
import { Schema } from '@tonylb/mtw-wml/ts/schema'

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
    </Asset>`
    const schema = new Schema()
    schema.loadWML(testSource)
    const standardizer = new Standardizer(schema.schema)
    const testStandard = standardizer.stripped

    it('should return only a wrapper when passed no keys', () => {
        expect(standardSubset({ standard: testStandard, keys: [], stubKeys: [] })).toEqual({ newStubKeys: [], standard: { key: 'Test', tag: 'Asset', byId: {}, metaData: [] } })
    })

    it('should return stubs for features linked in description', () => {
        expect(standardSubset({ standard: testStandard, keys: ['testTwo'], stubKeys: [] })).toEqual({
            newStubKeys: [],
            standard: {
                key: 'Test',
                tag: 'Asset',
                metaData: [],
                byId: {
                    testTwo: {
                        key: 'testTwo',
                        tag: 'Room',
                        shortName: { data: { tag: 'ShortName' }, children: [] },
                        name: { data: { tag: 'Name' }, children: [] },
                        summary: { data: { tag: 'Summary' }, children: [] },
                        description: {
                            data: { tag: 'Description' },
                            children: [{
                                data: { tag: 'Link', text: 'test', to: 'testFeature' },
                                children: [{ data: { tag: 'String', value: 'test' }, children: [] }]
                            }]
                        },
                        exits: []
                    },
                    testFeature: {
                        key: 'testFeature',
                        tag: 'Feature',
                        name: { data: { tag: 'Name' }, children: [] },
                        description: { data: { tag: 'Description' }, children: [] }
                    }
                }
            }
        })
    })

})