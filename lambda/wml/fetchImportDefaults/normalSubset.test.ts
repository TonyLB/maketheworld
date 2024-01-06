import Normalizer from '@tonylb/mtw-wml/dist/normalize'
import normalSubset from './normalSubset'

describe('normalSubset', () => {
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
    const normalizer = new Normalizer()
    normalizer.loadWML(testSource)
    const testNormal = normalizer.normal

    it('should return only a wrapper when passed no keys', () => {
        expect(normalSubset({ normal: testNormal, keys: [], stubKeys: [] })).toEqual({ newStubKeys: [], schema: [] })
    })

    it('should return stubs for features linked in description', () => {
        expect(normalSubset({ normal: testNormal, keys: ['testTwo'], stubKeys: [] })).toEqual({ newStubKeys: [], schema: [
            {
                data: { tag: 'Room', key: 'testTwo' },
                children: [{
                    data: { tag: 'Description' },
                    children: [{
                        data: { tag: 'Link', text: 'test', to: 'testFeature' },
                        children: [{ data: { tag: 'String', value: 'test' }, children: [] }] }]
                    }]
            },
            { data: { tag: 'Feature', key: 'testFeature' }, children: [] }
        ] })
    })

})