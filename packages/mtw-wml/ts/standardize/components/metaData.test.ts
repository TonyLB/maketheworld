import { Schema, schemaToWML } from "../../schema"
import { deIndentWML } from "../../schema/utils"
import { StandardExport, StandardImport } from './metaData'

describe('Standard metadata', () => {
    describe('StandardImport', () => {
        const testImport = (wml: string): StandardImport => {
            const schema = new Schema()
            const testSource = deIndentWML(wml)
            schema.loadWML(testSource)
            return new StandardImport(schema.schema[0])
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
                    <Bookmark key=(testBookmark) from=(testChanged) />
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
                    <With><Room key=(testRename) from=(testRoom) /></With>
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
                        <Import from=(source)><Room key=(testRename) from=(testRoom) /></Import>
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
            expect(schemaToWML([(base.merge(incoming) as StandardImport).schema])).toEqual(deIndentWML(`
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
                    <With><Room key=(testChange) from=(testFour) /></With>
                </Import>
            `))
            const incoming = testImport(deIndentWML(`
                <Import from=(test)>
                    <Remove><Room key=(testOne) /></Remove>
                    <Replace><Room key=(testTwo) /></Replace>
                    <With><Room key=(testChangeTwo) from=(testTwo) /></With>
                    <Room key=(testChangeThree) from=(testThree) />
                    <Remove><Room key=(testChange) from=(testFour) /></Remove>
                </Import>
            `))
            expect(schemaToWML([(base.merge(incoming) as StandardImport).schema])).toEqual(deIndentWML(`
                    <Import from=(test)>
                        <Replace><Room key=(testThree) /></Replace>
                        <With><Room key=(testChangeThree) from=(testThree) /></With>
                        <Room key=(testChangeTwo) from=(testTwo) />
                        <Remove><Room key=(testFour) /></Remove>
                    </Import>
                `))
        })

        it('should merge external remove edits correctly', () => {
            const base = testImport(deIndentWML(`
                <Import from=(test)>
                    <Room key=(testOne) />
                </Import>
            `))
            const incoming = testImport(deIndentWML(`
                <Remove>
                    <Import from=(test)>
                        <Room key=(testOne) />
                    </Import>
                </Remove>
            `))
            expect(base.merge(incoming)).toBeUndefined()
        })

        it('should merge external replace edits correctly', () => {
            const base = testImport(deIndentWML(`
                <Import from=(test)>
                    <Room key=(testOne) />
                </Import>
            `))
            const testSource = deIndentWML(`
                <Asset key=(testAsset)>
                    <Replace>
                        <Import from=(test)>
                            <Room key=(testOne) />
                        </Import>
                    </Replace>
                    <With>
                        <Import from=(test)>
                            <Room key=(testChanged) from=(testOne) />
                        </Import>
                    </With>
                </Asset>
            `)
            const schema = new Schema()
            schema.loadWML(testSource)
            const incoming = new StandardImport(schema.schema[0].children[0])
            expect(schemaToWML([(base.merge(incoming) as StandardImport).schema])).toEqual(deIndentWML(`
                <Import from=(test)><Room key=(testChanged) from=(testOne) /></Import>
            `))
        })
    })

    describe('StandardExport', () => {
        const testExport = (wml: string): StandardExport => {
            const schema = new Schema()
            const testSource = deIndentWML(wml)
            schema.loadWML(testSource)
            return new StandardExport(schema.schema[0])
        }

        it('should accept an empty export', () => {
            const testSource = deIndentWML(`
                <Export />
            `)
            expect(schemaToWML([testExport(testSource).schema])).toEqual(testSource)
        })

        it('should accept all importable types', () => {
            const testSource = deIndentWML(`
                <Export>
                    <Bookmark key=(testBookmark) as=(testChanged) />
                    <Feature key=(testFeature) />
                    <Knowledge key=(testKnowledge) />
                    <Map key=(testMap) />
                    <Message key=(testMessage) />
                    <Moment key=(testMoment) />
                    <Room key=(testRoom) />
                    <Theme key=(testTheme) />
                    <Variable key=(testVariable) />
                </Export>
            `)
            expect(schemaToWML([testExport(testSource).schema])).toEqual(testSource)
        })

        it('should ignore non-export data', () => {
            const test = testExport(`
                    <Export>
                        <Room key=(testRoom)><Name>Test Name</Name></Room>
                    </Export>
                `)
            expect(schemaToWML([test.schema])).toEqual(`<Export><Room key=(testRoom) /></Export>`)
        })

        it('should accept internal remove tags', () => {
            const testSource = deIndentWML(`
                <Export><Remove><Room key=(testRoom) /></Remove></Export>
            `)
            expect(schemaToWML([testExport(testSource).schema])).toEqual(testSource)
        })

        it('should accept internal replace tags', () => {
            const testSource = deIndentWML(`
                <Export>
                    <Replace><Room key=(testRoom) as=(testOne) /></Replace>
                    <With><Room key=(testRoom) as=(testTwo) /></With>
                </Export>
            `)
            expect(schemaToWML([testExport(testSource).schema])).toEqual(testSource)
        })

        it('should accept external remove tags', () => {
            const testSource = deIndentWML(`
                <Remove><Export><Room key=(testRoom) /></Export></Remove>
            `)
            expect(schemaToWML([testExport(testSource).schema])).toEqual(testSource)
        })

        it('should accept external replace tags', () => {
            const testSource = deIndentWML(`
                <Asset key=(testAsset)>
                    <Replace><Export><Room key=(testRoom) /></Export></Replace>
                    <With><Export><Room key=(testRoom) as=(testRename) /></Export></With>
                </Asset>
            `)
            const schema = new Schema()
            schema.loadWML(testSource)
            expect(schemaToWML([new StandardExport(schema.schema[0].children[0]).schema])).toEqual(deIndentWML(testSource.split('\n').slice(1, -1).join('\n')))
        })

        it('should merge simple imports correctly', () => {
            const base = testExport(deIndentWML(`
                    <Export><Room key=(testOne) /></Export>
                `))
            const incoming = testExport(deIndentWML(`
                <Export>
                    <Room key=(testTwo) />
                </Export>
            `))
            expect(schemaToWML([(base.merge(incoming) as StandardExport).schema])).toEqual(deIndentWML(`
                    <Export>
                        <Room key=(testOne) />
                        <Room key=(testTwo) />
                    </Export>
                `))
        })

        it('should merge internal edits correctly', () => {
            const base = testExport(deIndentWML(`
                <Export>
                    <Room key=(testOne) />
                    <Room key=(testTwo) />
                    <Remove><Room key=(testThree) /></Remove>
                    <Replace><Room key=(testFour) /></Replace>
                    <With><Room key=(testFour) as=(testChange) /></With>
                </Export>
            `))
            const incoming = testExport(deIndentWML(`
                <Export>
                    <Remove><Room key=(testOne) /></Remove>
                    <Replace><Room key=(testTwo) /></Replace>
                    <With><Room key=(testTwo) as=(testChangeTwo) /></With>
                    <Room key=(testThree) as=(testChangeThree) />
                    <Remove><Room key=(testFour) as=(testChange) /></Remove>
                </Export>
            `))
            expect(schemaToWML([(base.merge(incoming) as StandardExport).schema])).toEqual(deIndentWML(`
                    <Export>
                        <Replace><Room key=(testThree) /></Replace>
                        <With><Room key=(testThree) as=(testChangeThree) /></With>
                        <Room key=(testTwo) as=(testChangeTwo) />
                        <Remove><Room key=(testFour) /></Remove>
                    </Export>
                `))
        })

        it('should merge external remove edits correctly', () => {
            const base = testExport(deIndentWML(`
                <Export>
                    <Room key=(testOne) />
                </Export>
            `))
            const incoming = testExport(deIndentWML(`
                <Remove>
                    <Export>
                        <Room key=(testOne) />
                    </Export>
                </Remove>
            `))
            expect(base.merge(incoming)).toBeUndefined()
        })

        it('should merge external replace edits correctly', () => {
            const base = testExport(deIndentWML(`
                <Export>
                    <Room key=(testOne) />
                </Export>
            `))
            const testSource = deIndentWML(`
                <Asset key=(testAsset)>
                    <Replace>
                        <Export>
                            <Room key=(testOne) />
                        </Export>
                    </Replace>
                    <With>
                        <Export>
                            <Room key=(testChanged) as=(testOne) />
                        </Export>
                    </With>
                </Asset>
            `)
            const schema = new Schema()
            schema.loadWML(testSource)
            const incoming = new StandardExport(schema.schema[0].children[0])
            expect(schemaToWML([(base.merge(incoming) as StandardExport).schema])).toEqual(deIndentWML(`
                <Export><Room key=(testChanged) as=(testOne) /></Export>
            `))
        })
    })
})