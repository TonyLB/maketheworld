import { Schema, schemaToWML } from "../../schema"
import { deIndentWML } from "../../schema/utils"
import { SerializeNDJSONMixin } from "../baseClasses"
import { StandardImageData } from "./dataTypes/image"
import { StandardImage } from './image'
import { mergeTest } from './utils/testing'

describe('StandardImage class', () => {

    it('should construct StandardImage from WML', () => {
        const testSource = deIndentWML(`
            <Image key=(test) />
        `)
        const testAction = new StandardImage(testSource)
        expect(testAction.key).toEqual('test')
        expect(schemaToWML([testAction.schema])).toEqual(testSource)
    })

    it('should construct StandardImage from schema', () => {
        const schema = new Schema()
        const testSource = deIndentWML(`
            <Image key=(test) />
        `)
        schema.loadWML(testSource)
        const testAction = new StandardImage(schema.schema[0])
        expect(testAction.key).toEqual('test')
        expect(schemaToWML([testAction.schema])).toEqual(testSource)
    })

    it('should construct StandardImage from StandardImageData', () => {
        const testComputedData: StandardImageData = {
            key: 'test',
            tag: 'Image'
        }
        const testComputed = new StandardImage(testComputedData)
        expect(testComputed.toJSON()).toEqual(testComputedData)
    })

    it('should construct StandardImage from NDJSON', () => {
        const testComputedData: StandardImageData & SerializeNDJSONMixin = {
            key: 'test',
            tag: 'Image',
            fileName: 'test.png'
        }
        const testComputed = new StandardImage(testComputedData)
        expect(testComputed.toNDJSON({})).toEqual(testComputedData)
    })

    it('should merge correctly', () => {
        expect(mergeTest(
            '<Image key=(test) />',
            StandardImage,
            '<Image key=(test) />',
        )).toEqual(deIndentWML('<Image key=(test) />'))
    })

    it('should merge base component with fileAssociation', () => {
        const base = new StandardImage(deIndentWML(`<Image key=(test) />`)).withFileAssociation('testOne.png')
        const incoming = new StandardImage(deIndentWML(`<Image key=(test) />`))
        const merge = base.merge(incoming)
        if (!merge) {
            expect(true).toBe(false)
        }
        else {
            expect(merge.fileAssociation).toEqual('testOne.png')
            expect(schemaToWML([merge.schema])).toEqual(deIndentWML(`
                <Image key=(test) />
            `))
        }
    })

    it('should merge incoming component with fileAssociation', () => {
        const base = new StandardImage(deIndentWML(`<Image key=(test) />`))
        const incoming = new StandardImage(deIndentWML(`<Image key=(test) />`)).withFileAssociation('testTwo.png')
        const merge = base.merge(incoming)
        if (!merge) {
            expect(true).toBe(false)
        }
        else {
            expect(merge.fileAssociation).toEqual('testTwo.png')
            expect(schemaToWML([merge.schema])).toEqual(deIndentWML(`
                <Image key=(test) />
            `))
        }
    })

    it('should choose incoming on conflicting fileAssociations', () => {
        const base = new StandardImage(deIndentWML(`<Image key=(test) />`)).withFileAssociation('testOne.png')
        const incoming = new StandardImage(deIndentWML(`<Image key=(test) />`)).withFileAssociation('testTwo.png')
        const merge = base.merge(incoming)
        if (!merge) {
            expect(true).toBe(false)
        }
        else {
            expect(merge.fileAssociation).toEqual('testTwo.png')
            expect(schemaToWML([merge.schema])).toEqual(deIndentWML(`
                <Image key=(test) />
            `))
        }
    })
})
