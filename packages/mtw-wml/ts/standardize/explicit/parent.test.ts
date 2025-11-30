import { StandardExplicitParent, StandardExplicitParentSimple, StandardExplicitParentRemove, StandardExplicitParentReplace } from './parent'
import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { MergeConflictError } from '@tonylb/mtw-base/ts/standardize'

describe('StandardExplicitParent', () => {
    const validComponentUUID: ComponentUUID = 'ROOM#test-room'
    const anotherComponentUUID: ComponentUUID = 'FEATURE#test-feature'
    const validLegalKey = 'parentRoom'
    const anotherLegalKey = 'parentFeature'

    describe('construction', () => {
        it('should create a StandardExplicitParentSimple from ComponentUUID', () => {
            const parent = new StandardExplicitParent(validComponentUUID)
            expect(parent._payload).toBeInstanceOf(StandardExplicitParentSimple)
            expect(parent.toJSON()).toBe(validComponentUUID)
        })

        it('should create a StandardExplicitParentSimple from legalKey', () => {
            const parent = new StandardExplicitParent(validLegalKey)
            expect(parent._payload).toBeInstanceOf(StandardExplicitParentSimple)
            expect(parent.toJSON()).toEqual({ key: validLegalKey })
        })

        it('should create a StandardExplicitParentRemove from Remove structure', () => {
            const parent = new StandardExplicitParent({ tag: 'Remove', match: validComponentUUID })
            expect(parent._payload).toBeInstanceOf(StandardExplicitParentRemove)
            expect(parent.toJSON()).toEqual({ tag: 'Remove', match: validComponentUUID })
        })

        it('should create a StandardExplicitParentReplace from Replace structure', () => {
            const parent = new StandardExplicitParent({ 
                tag: 'Replace', 
                match: validComponentUUID, 
                payload: anotherComponentUUID 
            })
            expect(parent._payload).toBeInstanceOf(StandardExplicitParentReplace)
            expect(parent.toJSON()).toEqual({ 
                tag: 'Replace', 
                match: validComponentUUID, 
                payload: anotherComponentUUID 
            })
        })

        it('should handle empty Parent tag (no parent)', () => {
            const parent = new StandardExplicitParent([])
            expect(parent._payload).toBeUndefined()
            expect(parent.toJSON()).toBeUndefined()
            expect(parent.schema).toEqual([{ data: { tag: 'Parent' }, children: [] }])
        })

        it('should create from WML schema with Parent tag (ComponentUUID)', () => {
            const parent = new StandardExplicitParent([
                { data: { tag: 'Parent' }, children: [
                    { data: { tag: 'String', value: validComponentUUID }, children: [] }
                ]}
            ])
            expect(parent._payload).toBeInstanceOf(StandardExplicitParentSimple)
            expect(parent.toJSON()).toBe(validComponentUUID)
        })

        it('should create from WML schema with Parent tag (legalKey)', () => {
            const parent = new StandardExplicitParent([
                { data: { tag: 'Parent' }, children: [
                    { data: { tag: 'String', value: validLegalKey }, children: [] }
                ]}
            ])
            expect(parent._payload).toBeInstanceOf(StandardExplicitParentSimple)
            expect(parent.toJSON()).toEqual({ key: validLegalKey })
        })
    })

    describe('merge operations', () => {
        it('should merge two identical StandardExplicitParentSimple instances', () => {
            const parent1 = new StandardExplicitParent(validComponentUUID)
            const parent2 = new StandardExplicitParent(validComponentUUID)
            const merged = parent1.merge(parent2)
            expect(merged).toBeInstanceOf(StandardExplicitParent)
            expect(merged?._payload).toBeInstanceOf(StandardExplicitParentSimple)
            expect(merged?.toJSON()).toBe(validComponentUUID)
        })

        it('should merge two different StandardExplicitParentSimple instances (replace)', () => {
            const parent1 = new StandardExplicitParent(validComponentUUID)
            const parent2 = new StandardExplicitParent(anotherComponentUUID)
            const merged = parent1.merge(parent2)
            expect(merged).toBeInstanceOf(StandardExplicitParent)
            expect(merged?._payload).toBeInstanceOf(StandardExplicitParentSimple)
            expect(merged?.toJSON()).toBe(anotherComponentUUID)
        })

        it('should merge two identical legalKey instances', () => {
            const parent1 = new StandardExplicitParent(validLegalKey)
            const parent2 = new StandardExplicitParent(validLegalKey)
            const merged = parent1.merge(parent2)
            expect(merged).toBeInstanceOf(StandardExplicitParent)
            expect(merged?._payload).toBeInstanceOf(StandardExplicitParentSimple)
            expect(merged?.toJSON()).toEqual({ key: validLegalKey })
        })

        it('should merge two different legalKey instances (replace)', () => {
            const parent1 = new StandardExplicitParent(validLegalKey)
            const parent2 = new StandardExplicitParent(anotherLegalKey)
            const merged = parent1.merge(parent2)
            expect(merged).toBeInstanceOf(StandardExplicitParent)
            expect(merged?._payload).toBeInstanceOf(StandardExplicitParentSimple)
            expect(merged?.toJSON()).toEqual({ key: anotherLegalKey })
        })

        it('should merge ComponentUUID with legalKey (different values)', () => {
            const parent1 = new StandardExplicitParent(validComponentUUID)
            const parent2 = new StandardExplicitParent(validLegalKey)
            const merged = parent1.merge(parent2)
            expect(merged).toBeInstanceOf(StandardExplicitParent)
            expect(merged?._payload).toBeInstanceOf(StandardExplicitParentSimple)
            expect(merged?.toJSON()).toEqual({ key: validLegalKey })
        })

        it('should merge Remove with Simple (exact match)', () => {
            const parent1 = new StandardExplicitParent({ tag: 'Remove', match: validComponentUUID })
            const parent2 = new StandardExplicitParent(validComponentUUID)
            const merged = parent1.merge(parent2)
            // Remove + Add with exact match should cancel out
            expect(merged).toBeUndefined()
        })

        it('should throw error when merging Remove with Simple (no exact match)', () => {
            const parent1 = new StandardExplicitParent({ tag: 'Remove', match: validComponentUUID })
            const parent2 = new StandardExplicitParent(anotherComponentUUID)
            expect(() => parent1.merge(parent2)).toThrow(MergeConflictError)
            expect(() => parent1.merge(parent2)).toThrow('Parent values can only be removed or replaced if they match exactly')
        })

        it('should merge empty with Simple', () => {
            const parent1 = new StandardExplicitParent([])
            const parent2 = new StandardExplicitParent(validComponentUUID)
            const merged = parent1.merge(parent2)
            expect(merged).toBeInstanceOf(StandardExplicitParent)
            expect(merged?.toJSON()).toBe(validComponentUUID)
        })

        it('should merge Simple with empty', () => {
            const parent1 = new StandardExplicitParent(validComponentUUID)
            const parent2 = new StandardExplicitParent([])
            const merged = parent1.merge(parent2)
            expect(merged).toBeInstanceOf(StandardExplicitParent)
            expect(merged?.toJSON()).toBe(validComponentUUID)
        })

        it('should merge empty with empty', () => {
            const parent1 = new StandardExplicitParent([])
            const parent2 = new StandardExplicitParent([])
            const merged = parent1.merge(parent2)
            expect(merged).toBeUndefined()
        })
    })

    describe('diff operations', () => {
        it('should diff two identical StandardExplicitParentSimple instances', () => {
            const parent1 = new StandardExplicitParent(validComponentUUID)
            const parent2 = new StandardExplicitParent(validComponentUUID)
            const diff = parent1.diff(parent2)
            expect(diff).toBeUndefined()
        })

        it('should diff two different StandardExplicitParentSimple instances', () => {
            const parent1 = new StandardExplicitParent(validComponentUUID)
            const parent2 = new StandardExplicitParent(anotherComponentUUID)
            const diff = parent1.diff(parent2)
            expect(diff).toBeInstanceOf(StandardExplicitParent)
            expect(diff?._payload).toBeInstanceOf(StandardExplicitParentReplace)
            expect(diff?.toJSON()).toEqual({ 
                tag: 'Replace', 
                match: validComponentUUID, 
                payload: anotherComponentUUID 
            })
        })

        it('should diff two identical legalKey instances', () => {
            const parent1 = new StandardExplicitParent(validLegalKey)
            const parent2 = new StandardExplicitParent(validLegalKey)
            const diff = parent1.diff(parent2)
            expect(diff).toBeUndefined()
        })

        it('should diff two different legalKey instances', () => {
            const parent1 = new StandardExplicitParent(validLegalKey)
            const parent2 = new StandardExplicitParent(anotherLegalKey)
            const diff = parent1.diff(parent2)
            expect(diff).toBeInstanceOf(StandardExplicitParent)
            expect(diff?._payload).toBeInstanceOf(StandardExplicitParentReplace)
            expect(diff?.toJSON()).toEqual({ 
                tag: 'Replace', 
                match: { key: validLegalKey }, 
                payload: { key: anotherLegalKey } 
            })
        })

        it('should diff legalKey with empty', () => {
            const parent1 = new StandardExplicitParent(validLegalKey)
            const parent2 = new StandardExplicitParent([])
            const diff = parent1.diff(parent2)
            expect(diff).toBeInstanceOf(StandardExplicitParent)
            expect(diff?._payload).toBeInstanceOf(StandardExplicitParentRemove)
            expect(diff?.toJSON()).toEqual({ tag: 'Remove', match: { key: validLegalKey } })
        })

        it('should diff empty with legalKey', () => {
            const parent1 = new StandardExplicitParent([])
            const parent2 = new StandardExplicitParent(validLegalKey)
            const diff = parent1.diff(parent2)
            expect(diff).toBeInstanceOf(StandardExplicitParent)
            expect(diff?._payload).toBeInstanceOf(StandardExplicitParentSimple)
            expect(diff?.toJSON()).toEqual({ key: validLegalKey })
        })

        it('should diff Simple with empty', () => {
            const parent1 = new StandardExplicitParent(validComponentUUID)
            const parent2 = new StandardExplicitParent([])
            const diff = parent1.diff(parent2)
            expect(diff).toBeInstanceOf(StandardExplicitParent)
            expect(diff?._payload).toBeInstanceOf(StandardExplicitParentRemove)
            expect(diff?.toJSON()).toEqual({ tag: 'Remove', match: validComponentUUID })
        })

        it('should diff empty with Simple', () => {
            const parent1 = new StandardExplicitParent([])
            const parent2 = new StandardExplicitParent(validComponentUUID)
            const diff = parent1.diff(parent2)
            expect(diff).toBeInstanceOf(StandardExplicitParent)
            expect(diff?._payload).toBeInstanceOf(StandardExplicitParentSimple)
            expect(diff?.toJSON()).toBe(validComponentUUID)
        })

        it('should diff empty with undefined', () => {
            const parent1 = new StandardExplicitParent([])
            const diff = parent1.diff(undefined)
            expect(diff).toBeUndefined()
        })

        it('should diff Simple with undefined', () => {
            const parent1 = new StandardExplicitParent(validComponentUUID)
            const diff = parent1.diff(undefined)
            expect(diff).toBeInstanceOf(StandardExplicitParent)
            expect(diff?._payload).toBeInstanceOf(StandardExplicitParentRemove)
            expect(diff?.toJSON()).toEqual({ tag: 'Remove', match: validComponentUUID })
        })

        it('should diff legalKey with undefined', () => {
            const parent1 = new StandardExplicitParent(validLegalKey)
            const diff = parent1.diff(undefined)
            expect(diff).toBeInstanceOf(StandardExplicitParent)
            expect(diff?._payload).toBeInstanceOf(StandardExplicitParentRemove)
            expect(diff?.toJSON()).toEqual({ tag: 'Remove', match: { key: validLegalKey } })
        })
    })

    describe('mapContents operations', () => {
        it('should map contents of StandardExplicitParentSimple (ComponentUUID)', () => {
            const parent = new StandardExplicitParent(validComponentUUID)
            const mapped = parent.mapContents(data => 'FEATURE#mapped-feature' as ComponentUUID)
            expect(mapped).toBeInstanceOf(StandardExplicitParent)
            expect(mapped._payload).toBeInstanceOf(StandardExplicitParentSimple)
            expect(mapped.toJSON()).toBe('FEATURE#mapped-feature')
        })

        it('should map contents of StandardExplicitParentSimple (legalKey)', () => {
            const parent = new StandardExplicitParent(validLegalKey)
            const mapped = parent.mapContents(data => ({ key: 'mappedKey' }))
            expect(mapped).toBeInstanceOf(StandardExplicitParent)
            expect(mapped._payload).toBeInstanceOf(StandardExplicitParentSimple)
            expect(mapped.toJSON()).toEqual({ key: 'mappedKey' })
        })

        it('should map contents of StandardExplicitParentRemove', () => {
            const parent = new StandardExplicitParent({ tag: 'Remove', match: validComponentUUID })
            const mapped = parent.mapContents(data => 'FEATURE#mapped-feature' as ComponentUUID)
            expect(mapped).toBeInstanceOf(StandardExplicitParent)
            expect(mapped._payload).toBeInstanceOf(StandardExplicitParentRemove)
            expect(mapped.toJSON()).toEqual({ tag: 'Remove', match: 'FEATURE#mapped-feature' })
        })

        it('should map contents of StandardExplicitParentRemove (legalKey)', () => {
            const parent = new StandardExplicitParent({ tag: 'Remove', match: validLegalKey })
            const mapped = parent.mapContents(data => ({ key: 'mappedKey' }))
            expect(mapped).toBeInstanceOf(StandardExplicitParent)
            expect(mapped._payload).toBeInstanceOf(StandardExplicitParentRemove)
            expect(mapped.toJSON()).toEqual({ tag: 'Remove', match: { key: 'mappedKey' } })
        })

        it('should map contents of StandardExplicitParentReplace', () => {
            const parent = new StandardExplicitParent({ 
                tag: 'Replace', 
                match: validComponentUUID, 
                payload: anotherComponentUUID 
            })
            const mapped = parent.mapContents(data => 'FEATURE#mapped-feature' as ComponentUUID)
            expect(mapped).toBeInstanceOf(StandardExplicitParent)
            expect(mapped._payload).toBeInstanceOf(StandardExplicitParentReplace)
            expect(mapped.toJSON()).toEqual({ 
                tag: 'Replace', 
                match: 'FEATURE#mapped-feature', 
                payload: 'FEATURE#mapped-feature' 
            })
        })

        it('should map contents of StandardExplicitParentReplace (legalKey)', () => {
            const parent = new StandardExplicitParent({ 
                tag: 'Replace', 
                match: validLegalKey, 
                payload: anotherLegalKey 
            })
            const mapped = parent.mapContents(data => ({ key: 'mappedKey' }))
            expect(mapped).toBeInstanceOf(StandardExplicitParent)
            expect(mapped._payload).toBeInstanceOf(StandardExplicitParentReplace)
            expect(mapped.toJSON()).toEqual({ 
                tag: 'Replace', 
                match: { key: 'mappedKey' }, 
                payload: { key: 'mappedKey' } 
            })
        })

        it('should handle mapContents on empty Parent', () => {
            const parent = new StandardExplicitParent([])
            const mapped = parent.mapContents(data => 'FEATURE#mapped-feature' as ComponentUUID)
            expect(mapped).toBeInstanceOf(StandardExplicitParent)
            expect(mapped._payload).toBeUndefined()
            expect(mapped.toJSON()).toBeUndefined()
        })
    })

    describe('schema generation', () => {
        it('should generate correct schema for Simple (ComponentUUID)', () => {
            const parent = new StandardExplicitParent(validComponentUUID)
            const schema = parent.schema
            expect(schema).toEqual([
                { 
                    data: { tag: 'Parent' }, 
                    children: [
                        { data: { tag: 'String', value: validComponentUUID }, children: [] }
                    ]
                }
            ])
        })

        it('should generate correct schema for Simple (legalKey)', () => {
            const parent = new StandardExplicitParent(validLegalKey)
            const schema = parent.schema
            expect(schema).toEqual([
                { 
                    data: { tag: 'Parent' }, 
                    children: [
                        { data: { tag: 'String', value: validLegalKey }, children: [] }
                    ]
                }
            ])
        })

        it('should generate correct schema for Remove', () => {
            const parent = new StandardExplicitParent({ tag: 'Remove', match: validComponentUUID })
            const schema = parent.schema
            expect(schema).toEqual([
                { 
                    data: { tag: 'Remove' }, 
                    children: [
                        { 
                            data: { tag: 'Parent' }, 
                            children: [
                                { data: { tag: 'String', value: validComponentUUID }, children: [] }
                            ]
                        }
                    ]
                }
            ])
        })

        it('should generate correct schema for Replace', () => {
            const parent = new StandardExplicitParent({ 
                tag: 'Replace', 
                match: validComponentUUID, 
                payload: anotherComponentUUID 
            })
            const schema = parent.schema
            expect(schema).toEqual([
                { 
                    data: { tag: 'Replace' }, 
                    children: [
                        { 
                            data: { tag: 'ReplaceMatch' }, 
                            children: [
                                { 
                                    data: { tag: 'Parent' }, 
                                    children: [
                                        { data: { tag: 'String', value: validComponentUUID }, children: [] }
                                    ]
                                }
                            ]
                        },
                        { 
                            data: { tag: 'ReplacePayload' }, 
                            children: [
                                { 
                                    data: { tag: 'Parent' }, 
                                    children: [
                                        { data: { tag: 'String', value: anotherComponentUUID }, children: [] }
                                    ]
                                }
                            ]
                        }
                    ]
                }
            ])
        })

        it('should generate correct schema for empty Parent', () => {
            const parent = new StandardExplicitParent([])
            const schema = parent.schema
            expect(schema).toEqual([
                { data: { tag: 'Parent' }, children: [] }
            ])
        })

        it('should generate correct nestedSchema (ComponentUUID)', () => {
            const parent = new StandardExplicitParent(validComponentUUID)
            const nested = parent.nestedSchema({ tag: 'Room', key: 'test' })
            expect(nested).toEqual([
                { 
                    data: { tag: 'Room', key: 'test' }, 
                    children: [
                        { 
                            data: { tag: 'Parent' }, 
                            children: [
                                { data: { tag: 'String', value: validComponentUUID }, children: [] }
                            ]
                        }
                    ]
                }
            ])
        })

        it('should generate correct nestedSchema (legalKey)', () => {
            const parent = new StandardExplicitParent(validLegalKey)
            const nested = parent.nestedSchema({ tag: 'Room', key: 'test' })
            expect(nested).toEqual([
                { 
                    data: { tag: 'Room', key: 'test' }, 
                    children: [
                        { 
                            data: { tag: 'Parent' }, 
                            children: [
                                { data: { tag: 'String', value: validLegalKey }, children: [] }
                            ]
                        }
                    ]
                }
            ])
        })
    })

    describe('error cases', () => {
        it('should throw error when payloadFactory receives invalid value (not ComponentUUID or legalKey)', () => {
            expect(() => {
                new StandardExplicitParent([
                    { data: { tag: 'String', value: 'not-a-valid-uuid-or-key' }, children: [] }
                ])
            }).toThrow('Parent tag content must be a ComponentUUID or legalKey')
        })

        it('should throw error when constructing with invalid string', () => {
            expect(() => {
                new StandardExplicitParent('invalid-value-123')
            }).toThrow('Parent tag content must be a ComponentUUID or legalKey')
        })
    })
})

