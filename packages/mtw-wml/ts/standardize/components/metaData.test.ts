import { StandardImportItem, ImportItemContent, ImportItemRemove, ImportItemReplace } from './metaData'

describe('Standard metadata', () => {
    describe('ImportItem', () => {
        it('should construct content correctly', () => {
            const test = new ImportItemContent('test', 'testKey')
            expect(test.assetId).toEqual('test')
            expect(test.fromKey).toEqual('testKey')
        })

        it('should construct remove imports correctly', () => {
            const test = new ImportItemRemove('test', 'testKey')
            expect(test.assetId).toEqual('test')
            expect(test.fromKey).toEqual('testKey')
        })

        it('should construct replace imports correctly', () => {
            const test = new ImportItemReplace({ assetId: 'test', fromKey: 'testKey' }, { assetId: 'testTwo', fromKey: 'testKeyTwo' })
            expect(test.assetId).toEqual('test')
            expect(test.fromKey).toEqual('testKey')
        })

        it('should correctly merge identical content', () => {
            const testOne = new ImportItemContent('test', 'testKey')
            const testTwo = new ImportItemContent('test', 'testKey')
            const test = testOne.merge(testTwo)
            expect(test).toBeDefined()
            if (test) {
                expect(test.assetId).toEqual('test')
                expect(test.fromKey).toEqual('testKey')
            }
        })

        it('should throw when merging non-identical content', () => {
            const testOne = new ImportItemContent('test', 'testKey')
            const testTwo = new ImportItemContent('testTwo', 'testKeyTwo')
            expect(() => (testOne.merge(testTwo))).toThrow()
        })

        it('should remove content on merge', () => {
            const testOne = new ImportItemContent('test', 'testKey')
            const testTwo = new ImportItemRemove('test', 'testKey')
            expect(testOne.merge(testTwo)).toBeUndefined()
        })

        it('should throw when merging non-matching remove into content', () => {
            const testOne = new ImportItemContent('test', 'testKey')
            const testTwo = new ImportItemRemove('testTwo', 'testKeyTwo')
            expect(() => (testOne.merge(testTwo))).toThrow()
        })

        it('should replace content on merge', () => {
            const testOne = new ImportItemContent('test', 'testKey')
            const testTwo = new ImportItemReplace({ assetId: 'test', fromKey: 'testKey' }, { assetId: 'testTwo', fromKey: 'testKeyTwo' })
            const test = testOne.merge(testTwo)
            expect(test).toBeDefined()
            if (test) {
                expect(test.assetId).toEqual('testTwo')
                expect(test.fromKey).toEqual('testKeyTwo')
            }
        })

        it('should throw when merging non-matching replace into content', () => {
            const testOne = new ImportItemContent('test', 'testKey')
            const testTwo = new ImportItemReplace({ assetId: 'testTwo', fromKey: 'testKeyTwo' }, { assetId: 'testThree', fromKey: 'testKeyThree' })
            expect(() => (testOne.merge(testTwo))).toThrow()
        })

        it('should create replace when merging content into remove', () => {
            const testOne = new ImportItemRemove('test', 'testKey')
            const testTwo = new ImportItemContent('testTwo', 'testKeyTwo')
            const test = testOne.merge(testTwo)
            expect(test).toBeDefined()
            if (test) {
                expect(test.assetId).toEqual('test')
                expect(test.fromKey).toEqual('testKey')
                expect(test instanceof ImportItemReplace).toBeTruthy()
            }
        })

        it('should throw when merging remove into remove', () => {
            const testOne = new ImportItemRemove('test', 'testKey')
            const testTwo = new ImportItemRemove('test', 'testKey')
            expect(() => (testOne.merge(testTwo))).toThrow()
        })

        it('should throw when merging replace into remove', () => {
            const testOne = new ImportItemRemove('test', 'testKey')
            const testTwo = new ImportItemReplace({ assetId: 'test', fromKey: 'testKey' }, { assetId: 'testTwo', fromKey: 'testKeyTwo' })
            expect(() => (testOne.merge(testTwo))).toThrow()
        })

        it('should accept duplicates when merging content into replace', () => {
            const testOne = new ImportItemReplace({ assetId: 'test', fromKey: 'testKey' }, { assetId: 'testTwo', fromKey: 'testKeyTwo' })
            const testTwo = new ImportItemContent('testTwo', 'testKeyTwo')
            const test = testOne.merge(testTwo)
            expect(test).toBeDefined()
            if (test) {
                expect(test.assetId).toEqual('test')
                expect(test.fromKey).toEqual('testKey')
                expect(test instanceof ImportItemReplace).toBeTruthy()
            }
        })

        it('should modify remove when merging remove into replace', () => {
            const testOne = new ImportItemReplace({ assetId: 'test', fromKey: 'testKey' }, { assetId: 'testTwo', fromKey: 'testKeyTwo' })
            const testTwo = new ImportItemRemove('testTwo', 'testKeyTwo')
            const test = testOne.merge(testTwo)
            expect(test).toBeDefined()
            if (test) {
                expect(test.assetId).toEqual('test')
                expect(test.fromKey).toEqual('testKey')
                expect(test instanceof ImportItemRemove).toBeTruthy()
            }
        })

        it('should chain functions when merging remove into remove', () => {
            const testOne = new ImportItemReplace({ assetId: 'test', fromKey: 'testKey' }, { assetId: 'testTwo', fromKey: 'testKeyTwo' })
            const testTwo = new ImportItemReplace({ assetId: 'testTwo', fromKey: 'testKeyTwo' }, { assetId: 'testThree', fromKey: 'testKeyThree' })
            const test = testOne.merge(testTwo)
            expect(test).toBeDefined()
            if (test) {
                expect(test.assetId).toEqual('test')
                expect(test.fromKey).toEqual('testKey')
                expect(test instanceof ImportItemReplace).toBeTruthy()
                if (test instanceof ImportItemReplace) {
                    expect(test._payload).toEqual({ assetId: 'testThree', fromKey: 'testKeyThree' })
                }
            }
        })

    })

    // describe('StandardExport', () => {
    //     const testExport = (wml: string): StandardExport => {
    //         const schema = new Schema()
    //         const testSource = deIndentWML(wml)
    //         schema.loadWML(testSource)
    //         return new StandardExport(schema.schema[0])
    //     }

    //     it('should accept an empty export', () => {
    //         const testSource = deIndentWML(`
    //             <Export />
    //         `)
    //         expect(schemaToWML([testExport(testSource).schema])).toEqual(testSource)
    //     })

    //     it('should accept all importable types', () => {
    //         const testSource = deIndentWML(`
    //             <Export>
    //                 <Bookmark key=(testBookmark) as=(testChanged) />
    //                 <Feature key=(testFeature) />
    //                 <Knowledge key=(testKnowledge) />
    //                 <Map key=(testMap) />
    //                 <Message key=(testMessage) />
    //                 <Moment key=(testMoment) />
    //                 <Room key=(testRoom) />
    //                 <Theme key=(testTheme) />
    //                 <Variable key=(testVariable) />
    //             </Export>
    //         `)
    //         expect(schemaToWML([testExport(testSource).schema])).toEqual(testSource)
    //     })

    //     it('should ignore non-export data', () => {
    //         const test = testExport(`
    //                 <Export>
    //                     <Room key=(testRoom)><Name>Test Name</Name></Room>
    //                 </Export>
    //             `)
    //         expect(schemaToWML([test.schema])).toEqual(`<Export><Room key=(testRoom) /></Export>`)
    //     })

    //     it('should accept internal remove tags', () => {
    //         const testSource = deIndentWML(`
    //             <Export><Remove><Room key=(testRoom) /></Remove></Export>
    //         `)
    //         expect(schemaToWML([testExport(testSource).schema])).toEqual(testSource)
    //     })

    //     it('should accept internal replace tags', () => {
    //         const testSource = deIndentWML(`
    //             <Export>
    //                 <Replace><Room key=(testRoom) as=(testOne) /></Replace>
    //                 <With><Room key=(testRoom) as=(testTwo) /></With>
    //             </Export>
    //         `)
    //         expect(schemaToWML([testExport(testSource).schema])).toEqual(testSource)
    //     })

    //     it('should accept external remove tags', () => {
    //         const testSource = deIndentWML(`
    //             <Remove><Export><Room key=(testRoom) /></Export></Remove>
    //         `)
    //         expect(schemaToWML([testExport(testSource).schema])).toEqual(testSource)
    //     })

    //     it('should accept external replace tags', () => {
    //         const testSource = deIndentWML(`
    //             <Asset key=(testAsset)>
    //                 <Replace><Export><Room key=(testRoom) /></Export></Replace>
    //                 <With><Export><Room key=(testRoom) as=(testRename) /></Export></With>
    //             </Asset>
    //         `)
    //         const schema = new Schema()
    //         schema.loadWML(testSource)
    //         expect(schemaToWML([new StandardExport(schema.schema[0].children[0]).schema])).toEqual(deIndentWML(testSource.split('\n').slice(1, -1).join('\n')))
    //     })

    //     it('should merge simple imports correctly', () => {
    //         const base = testExport(deIndentWML(`
    //                 <Export><Room key=(testOne) /></Export>
    //             `))
    //         const incoming = testExport(deIndentWML(`
    //             <Export>
    //                 <Room key=(testTwo) />
    //             </Export>
    //         `))
    //         expect(schemaToWML([(base.merge(incoming) as StandardExport).schema])).toEqual(deIndentWML(`
    //                 <Export>
    //                     <Room key=(testOne) />
    //                     <Room key=(testTwo) />
    //                 </Export>
    //             `))
    //     })

    //     it('should merge internal edits correctly', () => {
    //         const base = testExport(deIndentWML(`
    //             <Export>
    //                 <Room key=(testOne) />
    //                 <Room key=(testTwo) />
    //                 <Remove><Room key=(testThree) /></Remove>
    //                 <Replace><Room key=(testFour) /></Replace>
    //                 <With><Room key=(testFour) as=(testChange) /></With>
    //             </Export>
    //         `))
    //         const incoming = testExport(deIndentWML(`
    //             <Export>
    //                 <Remove><Room key=(testOne) /></Remove>
    //                 <Replace><Room key=(testTwo) /></Replace>
    //                 <With><Room key=(testTwo) as=(testChangeTwo) /></With>
    //                 <Room key=(testThree) as=(testChangeThree) />
    //                 <Remove><Room key=(testFour) as=(testChange) /></Remove>
    //             </Export>
    //         `))
    //         expect(schemaToWML([(base.merge(incoming) as StandardExport).schema])).toEqual(deIndentWML(`
    //                 <Export>
    //                     <Replace><Room key=(testThree) /></Replace>
    //                     <With><Room key=(testThree) as=(testChangeThree) /></With>
    //                     <Room key=(testTwo) as=(testChangeTwo) />
    //                     <Remove><Room key=(testFour) /></Remove>
    //                 </Export>
    //             `))
    //     })

    //     it('should merge external remove edits correctly', () => {
    //         const base = testExport(deIndentWML(`
    //             <Export>
    //                 <Room key=(testOne) />
    //             </Export>
    //         `))
    //         const incoming = testExport(deIndentWML(`
    //             <Remove>
    //                 <Export>
    //                     <Room key=(testOne) />
    //                 </Export>
    //             </Remove>
    //         `))
    //         expect(base.merge(incoming)).toBeUndefined()
    //     })

    //     it('should merge external replace edits correctly', () => {
    //         const base = testExport(deIndentWML(`
    //             <Export>
    //                 <Room key=(testOne) />
    //             </Export>
    //         `))
    //         const testSource = deIndentWML(`
    //             <Asset key=(testAsset)>
    //                 <Replace>
    //                     <Export>
    //                         <Room key=(testOne) />
    //                     </Export>
    //                 </Replace>
    //                 <With>
    //                     <Export>
    //                         <Room key=(testChanged) as=(testOne) />
    //                     </Export>
    //                 </With>
    //             </Asset>
    //         `)
    //         const schema = new Schema()
    //         schema.loadWML(testSource)
    //         const incoming = new StandardExport(schema.schema[0].children[0])
    //         expect(schemaToWML([(base.merge(incoming) as StandardExport).schema])).toEqual(deIndentWML(`
    //             <Export><Room key=(testChanged) as=(testOne) /></Export>
    //         `))
    //     })
    // })
})