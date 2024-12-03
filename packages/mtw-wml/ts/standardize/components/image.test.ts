import { Schema, schemaToWML } from "../../schema"
import { deIndentWML } from "../../schema/utils"
import { SerializeNDJSONMixin } from "../baseClasses"
import { StandardImageData } from "./dataTypes/image"
import { StandardImageRefactored as StandardImage } from './image'
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

    // it('should merge base component with fileAssociation', () => {
    //     const base = new StandardImage(deIndentWML(`<Image key=(test) />`)).withFileAssociation('testOne.png')
    //     const incoming = new StandardImage(deIndentWML(`<Image key=(test) />`))
    //     const merge = base.merge(incoming)
    //     if (!merge) {
    //         expect(true).toBe(false)
    //     }
    //     else {
    //         expect(merge.fileAssociation).toEqual('testOne.png')
    //         expect(schemaToWML([merge.schema])).toEqual(deIndentWML(`
    //             <Image key=(test) />
    //         `))
    //     }
    // })

    // it('should merge incoming component with fileAssociation', () => {
    //     const base = new StandardImage(deIndentWML(`<Image key=(test) />`))
    //     const incoming = new StandardImage(deIndentWML(`<Image key=(test) />`)).withFileAssociation('testTwo.png')
    //     const merge = base.merge(incoming)
    //     if (!merge) {
    //         expect(true).toBe(false)
    //     }
    //     else {
    //         expect(merge.fileAssociation).toEqual('testTwo.png')
    //         expect(schemaToWML([merge.schema])).toEqual(deIndentWML(`
    //             <Image key=(test) />
    //         `))
    //     }
    // })

    // it('should choose incoming on conflicting fileAssociations', () => {
    //     const base = new StandardImage(deIndentWML(`<Image key=(test) />`)).withFileAssociation('testOne.png')
    //     const incoming = new StandardImage(deIndentWML(`<Image key=(test) />`)).withFileAssociation('testTwo.png')
    //     const merge = base.merge(incoming)
    //     if (!merge) {
    //         expect(true).toBe(false)
    //     }
    //     else {
    //         expect(merge.fileAssociation).toEqual('testTwo.png')
    //         expect(schemaToWML([merge.schema])).toEqual(deIndentWML(`
    //             <Image key=(test) />
    //         `))
    //     }
    // })
})
