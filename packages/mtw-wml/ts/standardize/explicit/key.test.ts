import { StandardExplicitKey, StandardExplicitKeySimple, StandardExplicitKeyRemove, StandardExplicitKeyReplace } from './key'
import { MergeConflictError } from '@tonylb/mtw-base/ts/standardize'

describe('StandardExplicitKey', () => {
    const validLegalKey = 'room1'
    const anotherLegalKey = 'room2'
    const invalidComponentUUID = 'ROOM#test-room'

    describe('construction', () => {
        it('should create a StandardExplicitKeySimple from legalKey string', () => {
            const key = new StandardExplicitKey(validLegalKey)
            expect(key._payload).toBeInstanceOf(StandardExplicitKeySimple)
            expect(key.toJSON()).toBe(validLegalKey)
        })

        it('should create a StandardExplicitKeyRemove from Remove structure', () => {
            const key = new StandardExplicitKey({ tag: 'Remove', match: validLegalKey })
            expect(key._payload).toBeInstanceOf(StandardExplicitKeyRemove)
            expect(key.toJSON()).toEqual({ tag: 'Remove', match: validLegalKey })
        })

        it('should create a StandardExplicitKeyReplace from Replace structure', () => {
            const key = new StandardExplicitKey({ 
                tag: 'Replace', 
                match: validLegalKey, 
                payload: anotherLegalKey 
            })
            expect(key._payload).toBeInstanceOf(StandardExplicitKeyReplace)
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
            expect(key._payload).toBeInstanceOf(StandardExplicitKeySimple)
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
        it('should merge two identical StandardExplicitKeySimple instances', () => {
            const key1 = new StandardExplicitKey(validLegalKey)
            const key2 = new StandardExplicitKey(validLegalKey)
            const merged = key1.merge(key2)
            expect(merged).toBeInstanceOf(StandardExplicitKey)
            expect(merged?._payload).toBeInstanceOf(StandardExplicitKeySimple)
            expect(merged?.toJSON()).toBe(validLegalKey)
        })

        it('should throw error when merging two different StandardExplicitKeySimple instances - conflicting values', () => {
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
            expect(merged?._payload).toBeInstanceOf(StandardExplicitKeyReplace)
            expect(merged?.toJSON()).toEqual({ 
                tag: 'Replace', 
                match: validLegalKey, 
                payload: anotherLegalKey 
            })
        })

    })

    describe('diff operations', () => {
        it('should diff two identical StandardExplicitKeySimple instances', () => {
            const key1 = new StandardExplicitKey(validLegalKey)
            const key2 = new StandardExplicitKey(validLegalKey)
            const diff = key1.diff(key2)
            expect(diff).toBeUndefined()
        })

        it('should diff two different StandardExplicitKeySimple instances', () => {
            const key1 = new StandardExplicitKey(validLegalKey)
            const key2 = new StandardExplicitKey(anotherLegalKey)
            const diff = key1.diff(key2)
            expect(diff).toBeInstanceOf(StandardExplicitKey)
            expect(diff?._payload).toBeInstanceOf(StandardExplicitKeyReplace)
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
            expect(diff?._payload).toBeInstanceOf(StandardExplicitKeyRemove)
            expect(diff?.toJSON()).toEqual({ tag: 'Remove', match: validLegalKey })
        })
    })

    describe('mapContents operations', () => {
        it('should map contents of StandardExplicitKeySimple', () => {
            const key = new StandardExplicitKey(validLegalKey)
            const mapped = key.mapContents(data => 'mappedKey')
            expect(mapped).toBeInstanceOf(StandardExplicitKey)
            expect(mapped._payload).toBeInstanceOf(StandardExplicitKeySimple)
            expect(mapped.toJSON()).toBe('mappedKey')
        })

        it('should map contents of StandardExplicitKeyRemove', () => {
            const key = new StandardExplicitKey({ tag: 'Remove', match: validLegalKey })
            const mapped = key.mapContents(data => 'mappedKey')
            expect(mapped).toBeInstanceOf(StandardExplicitKey)
            expect(mapped._payload).toBeInstanceOf(StandardExplicitKeyRemove)
            expect(mapped.toJSON()).toEqual({ tag: 'Remove', match: 'mappedKey' })
        })

        it('should map contents of StandardExplicitKeyReplace', () => {
            const key = new StandardExplicitKey({ 
                tag: 'Replace', 
                match: validLegalKey, 
                payload: anotherLegalKey 
            })
            const mapped = key.mapContents(data => 'mappedKey')
            expect(mapped).toBeInstanceOf(StandardExplicitKey)
            expect(mapped._payload).toBeInstanceOf(StandardExplicitKeyReplace)
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
            }).toThrow('Invalid key value: must be legalKey, got: not-a-valid-key')
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
        it('should invert StandardExplicitKeySimple to Remove', () => {
            const key = new StandardExplicitKey(validLegalKey)
            const inverted = key.invert()
            expect(inverted).toBeInstanceOf(StandardExplicitKey)
            expect(inverted._payload).toBeInstanceOf(StandardExplicitKeyRemove)
            expect(inverted.toJSON()).toEqual({ tag: 'Remove', match: validLegalKey })
        })

        it('should invert StandardExplicitKeyRemove to Simple', () => {
            const key = new StandardExplicitKey({ tag: 'Remove', match: validLegalKey })
            const inverted = key.invert()
            expect(inverted).toBeInstanceOf(StandardExplicitKey)
            expect(inverted._payload).toBeInstanceOf(StandardExplicitKeySimple)
            expect(inverted.toJSON()).toBe(validLegalKey)
        })

        it('should invert StandardExplicitKeyReplace (swap match and payload)', () => {
            const key = new StandardExplicitKey({ 
                tag: 'Replace', 
                match: validLegalKey, 
                payload: anotherLegalKey 
            })
            const inverted = key.invert()
            expect(inverted).toBeInstanceOf(StandardExplicitKey)
            expect(inverted._payload).toBeInstanceOf(StandardExplicitKeyReplace)
            expect(inverted.toJSON()).toEqual({ 
                tag: 'Replace', 
                match: anotherLegalKey, 
                payload: validLegalKey 
            })
        })
    })
})
