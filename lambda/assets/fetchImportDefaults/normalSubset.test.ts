import Normalizer from '@tonylb/mtw-wml/dist/normalize'
import normalSubset from './normalSubset'

describe('normalSubset', () => {
    const testSource = `<Asset key=(Test)>
        <Room key=(test)>
            <Description>
                One
            </Description>
        </Room>
        <Room key=(test)>
            <Description>
                Three
            </Description>
        </Room>
    </Asset>`
    const normalizer = new Normalizer()
    normalizer.loadWML(testSource)
    const testNormal = normalizer.normal

    it('should return only a wrapper when passed no keys', () => {
        expect(normalSubset({ normal: testNormal, keys: [], stubKeys: [] })).toEqual({ newStubKeys: [], schema: [] })
    })

})