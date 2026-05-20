import { Schema, schemaToWML } from "../../schema"
import { deIndentWML } from "../../schema/utils"
import { StandardImageData } from "./dataTypes/image"
import StandardImage from './image'
import { mergeTest } from './utils/testing'

describe('StandardImage class', () => {

    it('should construct StandardImage from WML', () => {
        const testSource = deIndentWML(`
            <Image key=(test) />
        `)
        const testImage = new StandardImage(testSource)
        expect(testImage.key).toEqual('test')
        expect(schemaToWML([testImage.schema])).toEqual(testSource)
    })

    it('should construct StandardImage from schema', () => {
        const schema = new Schema()
        const testSource = deIndentWML(`
            <Image key=(test) />
        `)
        schema.loadWML(testSource)
        const testImage = new StandardImage(schema.schema[0])
        expect(testImage.key).toEqual('test')
        expect(schemaToWML([testImage.schema])).toEqual(testSource)
    })

    it('should construct StandardImage from StandardImageData', () => {
        const testImageData: StandardImageData = {
            key: 'test',
            tag: 'Image'
        }
        const testComputed = new StandardImage(testImageData)
        expect(testComputed.toJSON()).toEqual(testImageData)
    })

    it('should construct StandardImage from WML with ShortName', () => {
        const testSource = deIndentWML(`
            <Image key=(test)>
                <ShortName>Test Image</ShortName>
            </Image>
        `)
        const testImage = new StandardImage(testSource)
        expect(testImage.key).toEqual('test')
        expect(testImage.shortName?.toJSON()).toEqual('Test Image')
        expect(schemaToWML([testImage.schema])).toEqual(deIndentWML(`
            <Image key=(test)><ShortName>Test Image</ShortName></Image>
        `))
    })

    it('should construct StandardImage from StandardImageData with shortName', () => {
        const testImageData: StandardImageData = {
            key: 'test',
            tag: 'Image',
            shortName: 'Test Image',
        }
        const testImage = new StandardImage(testImageData)
        expect(testImage.key).toEqual('test')
        expect(testImage.shortName?.toJSON()).toEqual('Test Image')
        expect(testImage.toJSON()).toEqual(testImageData)
    })

    // it('should construct StandardImage from NDJSON', () => {
    //     const testImageData: StandardImageData & SerializeNDJSONMixin = {
    //         key: 'test',
    //         tag: 'Image',
    //         fileName: 'test.png'
    //     }
    //     const testComputed = new StandardImage(testImageData)
    //     expect(testComputed.toJSON()).toEqual(testImageData)
    // })

    it('should merge correctly', () => {
        expect(mergeTest(
            '<Image key=(test) />',
            StandardImage,
            '<Image key=(test) />',
        )).toEqual(deIndentWML('<Image key=(test) />'))
    })

    it('should merge shortName correctly', () => {
        expect(mergeTest(
            `<Image key=(test)>
                <ShortName>Original</ShortName>
            </Image>`,
            StandardImage,
            `<Image key=(test)>
                <Replace><ShortName>Original</ShortName></Replace>
                <With><ShortName>Updated</ShortName></With>
            </Image>`
        )).toEqual(deIndentWML(`
            <Image key=(test)><ShortName>Updated</ShortName></Image>
        `))
    })

    it('should diff shortName correctly', () => {
        const testImage = new StandardImage(`
            <Image key=(test)>
                <ShortName>Original</ShortName>
            </Image>
        `)
        const testImage2 = new StandardImage(`
            <Image key=(test)>
                <ShortName>Updated</ShortName>
            </Image>
        `)
        const diff = testImage.diff(testImage2)
        expect(diff).toBeDefined()
        expect(schemaToWML([diff!.schema])).toEqual(deIndentWML(`
            <Image key=(test)>
                <Replace><ShortName>Original</ShortName></Replace>
                <With><ShortName>Updated</ShortName></With>
            </Image>
        `))
    })

    it('should no-op on diff', () => {
        const testImage = new StandardImage({
            key: 'test',
            tag: 'Image'
        })
        expect(testImage.diff(testImage)).toBeUndefined()
    })

    it('should throw on unconsumed child tags', () => {
        const testSource = deIndentWML(`
            <Image key=(test)>
                <ShortName>Test</ShortName>
                <Map key=(illegalMap) />
            </Image>
        `)
        expect(() => new StandardImage(testSource)).toThrow(/Unconsumed child tags/)
        expect(() => new StandardImage(testSource)).toThrow(/Map/)
    })
})
