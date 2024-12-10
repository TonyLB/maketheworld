import { ImportItemContent, ImportItemRemove, ImportItemReplace, ExportItemContent, ExportItemRemove, ExportItemReplace } from './metaData'

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

    describe('ExportItem', () => {
        it('should construct content correctly', () => {
            const test = new ExportItemContent('test')
            expect(test.exportAs).toEqual('test')
        })

        it('should construct remove imports correctly', () => {
            const test = new ExportItemRemove('test')
            expect(test.exportAs).toEqual('test')
        })

        it('should construct replace imports correctly', () => {
            const test = new ExportItemReplace('test', 'testTwo')
            expect(test.exportAs).toEqual('test')
        })

        it('should correctly merge identical content', () => {
            const testOne = new ExportItemContent('test')
            const testTwo = new ExportItemContent('test')
            const test = testOne.merge(testTwo)
            expect(test).toBeDefined()
            if (test) {
                expect(test.exportAs).toEqual('test')
            }
        })

        it('should throw when merging non-identical content', () => {
            const testOne = new ExportItemContent('test')
            const testTwo = new ExportItemContent('testTwo')
            expect(() => (testOne.merge(testTwo))).toThrow()
        })

        it('should remove content on merge', () => {
            const testOne = new ExportItemContent('test')
            const testTwo = new ExportItemRemove('test')
            expect(testOne.merge(testTwo)).toBeUndefined()
        })

        it('should throw when merging non-matching remove into content', () => {
            const testOne = new ExportItemContent('test')
            const testTwo = new ExportItemRemove('testTwo')
            expect(() => (testOne.merge(testTwo))).toThrow()
        })

        it('should replace content on merge', () => {
            const testOne = new ExportItemContent('test')
            const testTwo = new ExportItemReplace('test', 'testTwo')
            const test = testOne.merge(testTwo)
            expect(test).toBeDefined()
            if (test) {
                expect(test.exportAs).toEqual('testTwo')
            }
        })

        it('should throw when merging non-matching replace into content', () => {
            const testOne = new ExportItemContent('test')
            const testTwo = new ExportItemReplace('testTwo', 'testThree')
            expect(() => (testOne.merge(testTwo))).toThrow()
        })

        it('should create replace when merging content into remove', () => {
            const testOne = new ExportItemRemove('test')
            const testTwo = new ExportItemContent('testTwo')
            const test = testOne.merge(testTwo)
            expect(test).toBeDefined()
            if (test) {
                expect(test.exportAs).toEqual('test')
                expect(test instanceof ExportItemReplace).toBeTruthy()
                if (test instanceof ExportItemReplace) {
                    expect(test._payload).toEqual('testTwo')
                }
            }
        })

        it('should throw when merging remove into remove', () => {
            const testOne = new ExportItemRemove('test')
            const testTwo = new ExportItemRemove('test')
            expect(() => (testOne.merge(testTwo))).toThrow()
        })

        it('should throw when merging replace into remove', () => {
            const testOne = new ExportItemRemove('test')
            const testTwo = new ExportItemReplace('test', 'testTwo')
            expect(() => (testOne.merge(testTwo))).toThrow()
        })

        it('should accept duplicates when merging content into replace', () => {
            const testOne = new ExportItemReplace('test', 'testTwo')
            const testTwo = new ExportItemContent('testTwo')
            const test = testOne.merge(testTwo)
            expect(test).toBeDefined()
            if (test) {
                expect(test.exportAs).toEqual('test')
                expect(test instanceof ExportItemReplace).toBeTruthy()
                if (test instanceof ExportItemReplace) {
                    expect(test._payload).toEqual('testTwo')
                }
            }
        })

        it('should modify remove when merging remove into replace', () => {
            const testOne = new ExportItemReplace('test', 'testTwo')
            const testTwo = new ExportItemRemove('testTwo')
            const test = testOne.merge(testTwo)
            expect(test).toBeDefined()
            if (test) {
                expect(test.exportAs).toEqual('test')
                expect(test instanceof ExportItemRemove).toBeTruthy()
            }
        })

        it('should chain functions when merging remove into remove', () => {
            const testOne = new ExportItemReplace('test', 'testTwo')
            const testTwo = new ExportItemReplace('testTwo', 'testThree')
            const test = testOne.merge(testTwo)
            expect(test).toBeDefined()
            if (test) {
                expect(test.exportAs).toEqual('test')
                expect(test instanceof ExportItemReplace).toBeTruthy()
                if (test instanceof ExportItemReplace) {
                    expect(test._payload).toEqual('testThree')
                }
            }
        })

    })

})