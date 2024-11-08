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
                <Bookmark key=(testBookmark) />
                <Feature key=(testFeature) />
                <Knowledge key=(testKnowledge) />
                <Map key=(testMap) />
                <Message key=(testMessage) />
                <Moment key=(testMoment) />
                <Room key=(testRoom) />
                <Theme key=(testTheme) />
                <Variable key=(testVariable) />
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

    it('should accept external remove tags', () => {
        const testSource = deIndentWML(`
            <Remove><Import from=(source)><Room key=(testRoom) /></Import></Remove>
        `)
        expect(schemaToWML([testImport(testSource).schema])).toEqual(testSource)
    })

    it('should accept external replace tags', () => {
        const testSource = deIndentWML(`
            <Asset key=(testAsset)>
                <Replace>
                    <Import from=(source)><Room key=(testRoom) /></Import>
                </Replace>
                <With>
                    <Import from=(source)><Room key=(testRoom) as=(testRename) /></Import>
                </With>
            </Asset>
        `)
        const schema = new Schema()
        schema.loadWML(testSource)
        expect(schemaToWML([new StandardImport(schema.schema[0].children[0]).schema])).toEqual(deIndentWML(testSource.split('\n').slice(1, -1).join('\n')))
    })

    it('should merge simple imports correctly', () => {
        const base = testImport(deIndentWML(`
                <Import from=(test)>
                    <Room key=(testOne) />
                </Import>
            `))
        const incoming = testImport(deIndentWML(`
            <Import from=(test)>
                <Room key=(testTwo) />
            </Import>
        `))
        expect(schemaToWML([base.merge(incoming).schema])).toEqual(deIndentWML(`
                <Import from=(test)>
                    <Room key=(testOne) />
                    <Room key=(testTwo) />
                </Import>
            `))
    })

    it('should merge internal edits correctly', () => {
        const base = testImport(deIndentWML(`
            <Import from=(test)>
                <Room key=(testOne) />
                <Room key=(testTwo) />
                <Remove><Room key=(testThree) /></Remove>
                <Replace><Room key=(testFour) /></Replace>
                <With><Room key=(testFour) as=(testChange) /></With>
            </Import>
        `))
        const incoming = testImport(deIndentWML(`
            <Import from=(test)>
                <Remove><Room key=(testOne) /></Remove>
                <Replace><Room key=(testTwo) /></Replace>
                <With><Room key=(testTwo) as=(testChangeTwo) /></With>
                <Room key=(testThree) as=(testChangeThree) />
                <Remove><Room key=(testFour) as=(testChange) /></Remove>
            </Import>
        `))
        expect(schemaToWML([base.merge(incoming).schema])).toEqual(deIndentWML(`
                <Import from=(test)>
                    <Replace><Room key=(testThree) /></Replace>
                    <With><Room key=(testThree) as=(testChangeThree) /></With>
                    <Room key=(testTwo) as=(testChangeTwo) />
                    <Remove><Room key=(testFour) /></Remove>
                </Import>
            `))
    })

})