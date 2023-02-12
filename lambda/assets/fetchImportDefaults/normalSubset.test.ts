import Normalizer from '@tonylb/mtw-wml/dist/normalize'
import { schemaFromParse, schemaToWML } from '@tonylb/mtw-wml/dist/schema'
import parse from '@tonylb/mtw-wml/dist/parser'
import tokenizer from '@tonylb/mtw-wml/dist/parser/tokenizer'
import SourceStream from '@tonylb/mtw-wml/dist/parser/tokenizer/sourceStream'
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
    const testAsset = schemaFromParse(parse(tokenizer(new SourceStream(testSource))))
    normalizer.put(testAsset[0], { contextStack: [], index: 0, replace: false })
    const testNormal = normalizer.normal

    it('should return only a wrapper when passed no keys', () => {
        const normalizer = new Normalizer()
        normalizer._normalForm = normalSubset(testNormal, [])
        expect(schemaToWML(normalizer.schema)).toEqual(`<Asset key=(Test) />`)
    })

})