import { ImportItemContent, ImportItemRemove, ImportItemReplace } from './metaData'

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

        it('should correct diff content against same content', () => {
            const testOne = new ImportItemContent('test', 'testKey')
            const testTwo = new ImportItemContent('test', 'testKey')
            expect(testOne.diff(testTwo)).toBeUndefined()
        })

        it('should correctly diff content against different content', () => {
            const testOne = new ImportItemContent('test', 'testKey')
            const testTwo = new ImportItemContent('testTwo', 'testKeyTwo')
            const test = testOne.diff(testTwo)
            expect(test).toBeDefined()
            if (test) {
                expect(test instanceof ImportItemReplace).toBeTruthy()
                if (test instanceof ImportItemReplace) {
                    expect(test._match.assetId).toEqual('test')
                    expect(test._match.fromKey).toEqual('testKey')
                    expect(test._payload.assetId).toEqual('testTwo')
                    expect(test._payload.fromKey).toEqual('testKeyTwo')
                }
            }
        })

        it('should throw error on diffing incoming remove against base content', () => {
            const testOne = new ImportItemContent('test', 'testKey')
            const testTwo = new ImportItemRemove('test', 'testKey')
            expect(() => testOne.diff(testTwo)).toThrow()
        })

        it('should throw error on diffing incoming replace against base content', () => {
            const testOne = new ImportItemContent('test', 'testKey')
            const testTwo = new ImportItemReplace({ assetId: 'test', fromKey: 'testKey' }, { assetId: 'testTwo', fromKey: 'testKeyTwo' })
            expect(() => testOne.diff(testTwo)).toThrow()
        })

        it('should correctly diff identical removes', () => {
            const testOne = new ImportItemRemove('test', 'testKey')
            const testTwo = new ImportItemRemove('test', 'testKey')
            expect(testOne.diff(testTwo)).toBeUndefined()
        })

        it('should throw error on different removes', () => {
            const testOne = new ImportItemRemove('test', 'testKey')
            const testTwo = new ImportItemRemove('testTwo', 'testKeyTwo')
            expect(() => testOne.diff(testTwo)).toThrow()
        })

        it('should throw error on diffing incoming content against base remove', () => {
            const testOne = new ImportItemRemove('test', 'testKey')
            const testTwo = new ImportItemContent('testTwo', 'testKeyTwo')
            expect(() => testOne.diff(testTwo)).toThrow()
        })

        it('should correctly diff identical replaces', () => {
            const testOne = new ImportItemReplace({ assetId: 'test', fromKey: 'testKey' }, { assetId: 'testTwo', fromKey: 'testKeyTwo' })
            const testTwo = new ImportItemReplace({ assetId: 'test', fromKey: 'testKey' }, { assetId: 'testTwo', fromKey: 'testKeyTwo' })
            expect(testOne.diff(testTwo)).toBeUndefined()
        })

        it('should chain diff on different replace payloads', () => {
            const testOne = new ImportItemReplace({ assetId: 'test', fromKey: 'testKey' }, { assetId: 'testTwo', fromKey: 'testKeyTwo' })
            const testTwo = new ImportItemReplace({ assetId: 'test', fromKey: 'testKey' }, { assetId: 'testThree', fromKey: 'testKeyThree' })
            const test = testOne.diff(testTwo)
            expect(test).toBeDefined()
            if (test) {
                expect(test instanceof ImportItemReplace).toBeTruthy()
                if (test instanceof ImportItemReplace) {
                    expect(test._match.assetId).toEqual('testTwo')
                    expect(test._match.fromKey).toEqual('testKeyTwo')
                    expect(test._payload.assetId).toEqual('testThree')
                    expect(test._payload.fromKey).toEqual('testKeyThree')
                }
            }
        })
    })

})