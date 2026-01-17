import { StandardExplicitKey, PlainClass, RemoveClass, ReplaceClass } from './key'
import { MergeConflictError } from '@tonylb/mtw-base/ts/standardize'

describe('StandardExplicitKey', () => {
    const validLegalKey = 'room1'
    const anotherLegalKey = 'room2'
    const invalidComponentUUID = 'ROOM#test-room'

    describe('construction', () => {
        it('should create a PlainClass from legalKey string', () => {
            const key = new StandardExplicitKey(validLegalKey)
            expect(key._payload).toBeInstanceOf(PlainClass)
            expect(key.toJSON()).toBe(validLegalKey)
        })

        it('should create a RemoveClass from Remove structure', () => {
            const key = new StandardExplicitKey({ tag: 'Remove', match: validLegalKey })
            expect(key._payload).toBeInstanceOf(RemoveClass)
            expect(key.toJSON()).toEqual({ tag: 'Remove', match: validLegalKey })
        })

        it('should create a ReplaceClass from Replace structure', () => {
            const key = new StandardExplicitKey({ 
                tag: 'Replace', 
                match: validLegalKey, 
                payload: anotherLegalKey 
            })
            expect(key._payload).toBeInstanceOf(ReplaceClass)
            expect(key.toJSON()).toEqual({ 
                tag: 'Replace', 
                match: validLegalKey, 
                payload: anotherLegalKey 
            })
        })

        it('should reject empty Key tag', () => {
            expect(() => {
                new StandardExplicitKey([])
            }).toThrow('Key tag must contain a legalKey value')
        })

        it('should create from WML schema with Key tag', () => {
            const key = new StandardExplicitKey([
                { data: { tag: 'Key' }, children: [
                    { data: { tag: 'String', value: validLegalKey }, children: [] }
                ]}
            ])
            expect(key._payload).toBeInstanceOf(PlainClass)
            expect(key.toJSON()).toBe(validLegalKey)
        })

        it('should reject ComponentUUID in Key tag', () => {
            expect(() => {
                new StandardExplicitKey([
                    { data: { tag: 'Key' }, children: [
                        { data: { tag: 'String', value: invalidComponentUUID }, children: [] }
                    ]}
                ])
            }).toThrow('Invalid key value: ComponentUUID not allowed')
        })

        it('should reject invalid key format', () => {
            expect(() => {
                new StandardExplicitKey('not-a-valid-key')
            }).toThrow('Key tag content must be a legalKey, got: not-a-valid-key')
        })

        it('should reject ComponentUUID string directly', () => {
            expect(() => {
                new StandardExplicitKey(invalidComponentUUID)
            }).toThrow('Invalid key value: ComponentUUID not allowed')
        })
    })

    describe('merge operations', () => {
        it('should merge two identical PlainClass instances', () => {
            const key1 = new StandardExplicitKey(validLegalKey)
            const key2 = new StandardExplicitKey(validLegalKey)
            const merged = key1.merge(key2)
            expect(merged).toBeInstanceOf(StandardExplicitKey)
            expect(merged?._payload).toBeInstanceOf(PlainClass)
            expect(merged?.toJSON()).toBe(validLegalKey)
        })

        it('should throw error when merging two different PlainClass instances - conflicting values', () => {
            const key1 = new StandardExplicitKey(validLegalKey)
            const key2 = new StandardExplicitKey(anotherLegalKey)
            expect(() => key1.merge(key2)).toThrow(MergeConflictError)
            expect(() => key1.merge(key2)).toThrow('Key values can only be merged if they match exactly')
        })

        it('should merge Remove with Simple (exact match)', () => {
            const key1 = new StandardExplicitKey({ tag: 'Remove', match: validLegalKey })
            const key2 = new StandardExplicitKey(validLegalKey)
            const merged = key1.merge(key2)
            // Remove + Add with exact match should cancel out
            expect(merged).toBeUndefined()
        })

        it('should create Replace when merging Remove with Simple (no exact match)', () => {
            const key1 = new StandardExplicitKey({ tag: 'Remove', match: validLegalKey })
            const key2 = new StandardExplicitKey(anotherLegalKey)
            const merged = key1.merge(key2)
            // Remove + Add with different values creates a Replace operation
            expect(merged).toBeInstanceOf(StandardExplicitKey)
            expect(merged?._payload).toBeInstanceOf(ReplaceClass)
            expect(merged?.toJSON()).toEqual({ 
                tag: 'Replace', 
                match: validLegalKey, 
                payload: anotherLegalKey 
            })
        })

    })

    describe('diff operations', () => {
        it('should diff two identical PlainClass instances', () => {
            const key1 = new StandardExplicitKey(validLegalKey)
            const key2 = new StandardExplicitKey(validLegalKey)
            const diff = key1.diff(key2)
            expect(diff).toBeUndefined()
        })

        it('should diff two different PlainClass instances', () => {
            const key1 = new StandardExplicitKey(validLegalKey)
            const key2 = new StandardExplicitKey(anotherLegalKey)
            const diff = key1.diff(key2)
            expect(diff).toBeInstanceOf(StandardExplicitKey)
            expect(diff?._payload).toBeInstanceOf(ReplaceClass)
            expect(diff?.toJSON()).toEqual({ 
                tag: 'Replace', 
                match: validLegalKey, 
                payload: anotherLegalKey 
            })
        })

        it('should diff Simple with undefined', () => {
            const key1 = new StandardExplicitKey(validLegalKey)
            const diff = key1.diff(undefined)
            expect(diff).toBeInstanceOf(StandardExplicitKey)
            expect(diff?._payload).toBeInstanceOf(RemoveClass)
            expect(diff?.toJSON()).toEqual({ tag: 'Remove', match: validLegalKey })
        })
    })

    describe('mapContents operations', () => {
        it('should map contents of PlainClass', () => {
            const key = new StandardExplicitKey(validLegalKey)
            const mapped = key.mapContents(data => 'mappedKey')
            expect(mapped).toBeInstanceOf(StandardExplicitKey)
            expect(mapped._payload).toBeInstanceOf(PlainClass)
            expect(mapped.toJSON()).toBe('mappedKey')
        })

        it('should map contents of RemoveClass', () => {
            const key = new StandardExplicitKey({ tag: 'Remove', match: validLegalKey })
            const mapped = key.mapContents(data => 'mappedKey')
            expect(mapped).toBeInstanceOf(StandardExplicitKey)
            expect(mapped._payload).toBeInstanceOf(RemoveClass)
            expect(mapped.toJSON()).toEqual({ tag: 'Remove', match: 'mappedKey' })
        })

        it('should map contents of ReplaceClass', () => {
            const key = new StandardExplicitKey({ 
                tag: 'Replace', 
                match: validLegalKey, 
                payload: anotherLegalKey 
            })
            const mapped = key.mapContents(data => 'mappedKey')
            expect(mapped).toBeInstanceOf(StandardExplicitKey)
            expect(mapped._payload).toBeInstanceOf(ReplaceClass)
            expect(mapped.toJSON()).toEqual({ 
                tag: 'Replace', 
                match: 'mappedKey', 
                payload: 'mappedKey' 
            })
        })
    })

    describe('schema generation', () => {
        it('should generate correct schema for Simple', () => {
            const key = new StandardExplicitKey(validLegalKey)
            const schema = key.schema
            expect(schema).toEqual([
                { 
                    data: { tag: 'Key' }, 
                    children: [
                        { data: { tag: 'String', value: validLegalKey }, children: [] }
                    ]
                }
            ])
        })

        it('should generate correct schema for Remove', () => {
            const key = new StandardExplicitKey({ tag: 'Remove', match: validLegalKey })
            const schema = key.schema
            expect(schema).toEqual([
                { 
                    data: { tag: 'Remove' }, 
                    children: [
                        { 
                            data: { tag: 'Key' }, 
                            children: [
                                { data: { tag: 'String', value: validLegalKey }, children: [] }
                            ]
                        }
                    ]
                }
            ])
        })

        it('should generate correct schema for Replace', () => {
            const key = new StandardExplicitKey({ 
                tag: 'Replace', 
                match: validLegalKey, 
                payload: anotherLegalKey 
            })
            const schema = key.schema
            expect(schema).toEqual([
                { 
                    data: { tag: 'Replace' }, 
                    children: [
                        { 
                            data: { tag: 'ReplaceMatch' }, 
                            children: [
                                { 
                                    data: { tag: 'Key' }, 
                                    children: [
                                        { data: { tag: 'String', value: validLegalKey }, children: [] }
                                    ]
                                }
                            ]
                        },
                        { 
                            data: { tag: 'ReplacePayload' }, 
                            children: [
                                { 
                                    data: { tag: 'Key' }, 
                                    children: [
                                        { data: { tag: 'String', value: anotherLegalKey }, children: [] }
                                    ]
                                }
                            ]
                        }
                    ]
                }
            ])
        })

        it('should generate correct nestedSchema', () => {
            const key = new StandardExplicitKey(validLegalKey)
            const nested = key.nestedSchema({ tag: 'Room', key: 'test' })
            expect(nested).toEqual([
                { 
                    data: { tag: 'Room', key: 'test' }, 
                    children: [
                        { 
                            data: { tag: 'Key' }, 
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
        it('should throw error when payloadFactory receives invalid value (not legalKey)', () => {
            expect(() => {
                new StandardExplicitKey([
                    { data: { tag: 'Key' }, children: [
                        { data: { tag: 'String', value: 'not-a-valid-key' }, children: [] }
                    ]}
                ])
            }).toThrow('Key tag content must be a legalKey, got: not-a-valid-key')
        })

        it('should throw error when constructing with invalid string', () => {
            expect(() => {
                new StandardExplicitKey('invalid-value-123')
            }).toThrow('Key tag content must be a legalKey, got: invalid-value-123')
        })

        it('should throw error when constructing with ComponentUUID', () => {
            expect(() => {
                new StandardExplicitKey(invalidComponentUUID)
            }).toThrow('Invalid key value: ComponentUUID not allowed')
        })

        it('should throw error when constructing with empty Key tag', () => {
            expect(() => {
                new StandardExplicitKey([
                    { data: { tag: 'Key' }, children: [] }
                ])
            }).toThrow('Key tag must contain a legalKey value')
        })

    })

    describe('invert operations', () => {
        it('should invert PlainClass to Remove', () => {
            const key = new StandardExplicitKey(validLegalKey)
            const inverted = key.invert()
            expect(inverted).toBeInstanceOf(StandardExplicitKey)
            expect(inverted._payload).toBeInstanceOf(RemoveClass)
            expect(inverted.toJSON()).toEqual({ tag: 'Remove', match: validLegalKey })
        })

        it('should invert RemoveClass to Simple', () => {
            const key = new StandardExplicitKey({ tag: 'Remove', match: validLegalKey })
            const inverted = key.invert()
            expect(inverted).toBeInstanceOf(StandardExplicitKey)
            expect(inverted._payload).toBeInstanceOf(PlainClass)
            expect(inverted.toJSON()).toBe(validLegalKey)
        })

        it('should invert ReplaceClass (swap match and payload)', () => {
            const key = new StandardExplicitKey({ 
                tag: 'Replace', 
                match: validLegalKey, 
                payload: anotherLegalKey 
            })
            const inverted = key.invert()
            expect(inverted).toBeInstanceOf(StandardExplicitKey)
            expect(inverted._payload).toBeInstanceOf(ReplaceClass)
            expect(inverted.toJSON()).toEqual({ 
                tag: 'Replace', 
                match: anotherLegalKey, 
                payload: validLegalKey 
            })
        })
    })
})
