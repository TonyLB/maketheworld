import { Schema, schemaToWML } from "../../schema"
import { deIndentWML } from "../../schema/utils"
import { StandardImport } from './metaData'

describe('Standard metadata', () => {
    const testRoundTrip = (wml: string): boolean => {
        const schema = new Schema()
        const testSource = deIndentWML(wml)
        schema.loadWML(testSource)
        const testImport = new StandardImport(schema.schema[0])
        return schemaToWML([testImport.schema]) === deIndentWML(wml)
    }

    it('should accept an empty import', () => {
        const testSource = `
            <Import from=(source) />
        `
        expect(testRoundTrip(testSource)).toEqual(true)
    })

    it('should accept all importable types', () => {
        const testSource = `
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
        `
        expect(testRoundTrip(testSource)).toEqual(true)
    })

})