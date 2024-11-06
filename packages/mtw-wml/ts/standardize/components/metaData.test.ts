import { Schema, schemaToWML } from "../../schema"
import { deIndentWML } from "../../schema/utils"
import { StandardImport } from './metaData'

describe('Standard metadata', () => {
    const testImport = (wml: string): StandardImport => {
        const schema = new Schema()
        const testSource = deIndentWML(wml)
        schema.loadWML(testSource)
        return new StandardImport(schema.schema[0])
    }
    const testRoundTrip = (wml: string, expected?: string): boolean => {
        return schemaToWML([testImport(wml).schema]) === deIndentWML(wml)
    }

    it('should accept an empty import', () => {
        const testSource = deIndentWML(`
            <Import from=(source) />
        `)
        expect(schemaToWML([testImport(testSource).schema])).toEqual(testSource)
    })

    it('should accept all importable types', () => {
        const testSource = deIndentWML(`
            <Import from=(source)>
                <Room key=(testRoom) />
                <Feature key=(testFeature) />
                <Knowledge key=(testKnowledge) />
                <Bookmark key=(testBookmark) />
                <Map key=(testMap) />
                <Message key=(testMessage) />
                <Moment key=(testMoment) />
                <Variable key=(testVariable) />
                <Theme key=(testTheme) />
            </Import>
        `)
        expect(schemaToWML([testImport(testSource).schema])).toEqual(testSource)
    })

    it('should ignore non-import data', () => {
        const test = testImport(`
                <Import from=(source)>
                    <Room key=(testRoom)><Name>Test Name</Name></Room>
                </Import>
            `)
        expect(schemaToWML([test.schema])).toEqual(`<Import from=(source)><Room key=(testRoom) /></Import>`)
    })

    it('should accept internal remove tags', () => {
        const testSource = deIndentWML(`
            <Import from=(source)><Remove><Room key=(testRoom) /></Remove></Import>
        `)
        expect(schemaToWML([testImport(testSource).schema])).toEqual(testSource)
    })

    it('should accept internal replace tags', () => {
        const testSource = deIndentWML(`
            <Import from=(source)>
                <Replace><Room key=(testRoom) /></Replace>
                <With><Room key=(testRoom) as=(testRename) /></With>
            </Import>
        `)
        expect(schemaToWML([testImport(testSource).schema])).toEqual(testSource)
    })

})