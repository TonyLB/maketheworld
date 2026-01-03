import { KeyCollection } from "./keyCollection"
import { StandardKey } from "../../keys/key"

describe('KeyCollection', () => {
    describe('constructor', () => {
        it('should create empty collection from empty array', () => {
            const collection = new KeyCollection([])
            expect(collection.keys).toEqual([])
        })

        it('should create collection with single key', () => {
            const key = new StandardKey({ key: 'room1' })
            const collection = new KeyCollection([key])
            expect(collection.keys.length).toBe(1)
            expect(collection.keys[0].key).toBe('room1')
        })

        it('should deduplicate identical keys', () => {
            const key1 = new StandardKey({ key: 'room1' })
            const key2 = new StandardKey({ key: 'room1' })
            const collection = new KeyCollection([key1, key2])
            expect(collection.keys.length).toBe(1)
            expect(collection.keys[0].key).toBe('room1')
        })

        it('should merge keys that match by key', () => {
            const key1 = new StandardKey({ key: 'room1' })
            const key2 = new StandardKey({ key: 'room1', universalKey: 'ROOM#uuid1' })
            const collection = new KeyCollection([key1, key2])
            expect(collection.keys.length).toBe(1)
            expect(collection.keys[0].key).toBe('room1')
            expect(collection.keys[0].universalKey).toBe('ROOM#uuid1')
        })

        it('should merge keys that match by universalKey', () => {
            const key1 = new StandardKey({ universalKey: 'ROOM#uuid1' })
            const key2 = new StandardKey({ key: 'room1', universalKey: 'ROOM#uuid1' })
            const collection = new KeyCollection([key1, key2])
            expect(collection.keys.length).toBe(1)
            expect(collection.keys[0].key).toBe('room1')
            expect(collection.keys[0].universalKey).toBe('ROOM#uuid1')
        })

        it('should merge multiple partial keys into one complete key', () => {
            // First appearance: just key
            const key1 = new StandardKey({ key: 'room1' })
            // Second appearance: just universalKey (same component)
            const key2 = new StandardKey({ universalKey: 'ROOM#uuid1' })
            // Third appearance: complete key (should merge with both above)
            const key3 = new StandardKey({ key: 'room1', universalKey: 'ROOM#uuid1' })
            const collection = new KeyCollection([key1, key2, key3])
            expect(collection.keys.length).toBe(1)
            expect(collection.keys[0].key).toBe('room1')
            expect(collection.keys[0].universalKey).toBe('ROOM#uuid1')
        })

        it('should keep distinct keys separate', () => {
            const key1 = new StandardKey({ key: 'room1' })
            const key2 = new StandardKey({ key: 'room2' })
            const key3 = new StandardKey({ universalKey: 'FEATURE#uuid1' })
            const collection = new KeyCollection([key1, key2, key3])
            expect(collection.keys.length).toBe(3)
            expect(collection.keys.map(k => k.key || k.universalKey)).toContain('room1')
            expect(collection.keys.map(k => k.key || k.universalKey)).toContain('room2')
            expect(collection.keys.map(k => k.key || k.universalKey)).toContain('FEATURE#uuid1')
        })

        it('should handle keys with only universalKey', () => {
            const key1 = new StandardKey({ universalKey: 'ROOM#uuid1' })
            const key2 = new StandardKey({ universalKey: 'ROOM#uuid2' })
            const collection = new KeyCollection([key1, key2])
            expect(collection.keys.length).toBe(2)
        })
    })

    describe('keys getter', () => {
        it('should return array of keys', () => {
            const key1 = new StandardKey({ key: 'room1' })
            const key2 = new StandardKey({ key: 'room2' })
            const collection = new KeyCollection([key1, key2])
            const keys = collection.keys
            expect(Array.isArray(keys)).toBe(true)
            expect(keys.length).toBe(2)
        })

        it('should return cloned keys (not same references)', () => {
            const key1 = new StandardKey({ key: 'room1' })
            const collection = new KeyCollection([key1])
            const keys = collection.keys
            expect(keys[0]).not.toBe(key1)
            expect(keys[0].key).toBe(key1.key)
        })
    })

    describe('clone', () => {
        it('should create independent copy', () => {
            const key1 = new StandardKey({ key: 'room1' })
            const original = new KeyCollection([key1])
            const cloned = original.clone()
            
            expect(cloned).not.toBe(original)
            expect(cloned.keys.length).toBe(original.keys.length)
            expect(cloned.keys[0].key).toBe(original.keys[0].key)
            expect(cloned.keys[0]).not.toBe(original.keys[0])
        })

        it('should not affect original when cloned collection is modified', () => {
            const key1 = new StandardKey({ key: 'room1' })
            const original = new KeyCollection([key1])
            const cloned = original.clone()
            
            const key2 = new StandardKey({ key: 'room2' })
            const modified = cloned.withKey(key2)
            
            expect(original.keys.length).toBe(1)
            expect(modified.keys.length).toBe(2)
        })
    })

    describe('withKey', () => {
        it('should add new key to collection', () => {
            const key1 = new StandardKey({ key: 'room1' })
            const collection = new KeyCollection([key1])
            const key2 = new StandardKey({ key: 'room2' })
            const updated = collection.withKey(key2)
            
            expect(updated.keys.length).toBe(2)
            expect(updated.keys.map(k => k.key)).toContain('room1')
            expect(updated.keys.map(k => k.key)).toContain('room2')
        })

        it('should not modify original collection', () => {
            const key1 = new StandardKey({ key: 'room1' })
            const collection = new KeyCollection([key1])
            const key2 = new StandardKey({ key: 'room2' })
            collection.withKey(key2)
            
            expect(collection.keys.length).toBe(1)
        })

        it('should merge with existing matching key', () => {
            const key1 = new StandardKey({ key: 'room1' })
            const collection = new KeyCollection([key1])
            const key2 = new StandardKey({ key: 'room1', universalKey: 'ROOM#uuid1' })
            const updated = collection.withKey(key2)
            
            expect(updated.keys.length).toBe(1)
            expect(updated.keys[0].key).toBe('room1')
            expect(updated.keys[0].universalKey).toBe('ROOM#uuid1')
        })

        it('should merge multiple matching keys when adding new key', () => {
            // Start with two partial keys that match the same component
            const key1 = new StandardKey({ key: 'room1' })
            const key2 = new StandardKey({ universalKey: 'ROOM#uuid1' })
            const collection = new KeyCollection([key1, key2])
            
            // Add complete key that matches both
            const key3 = new StandardKey({ key: 'room1', universalKey: 'ROOM#uuid1' })
            const updated = collection.withKey(key3)
            
            expect(updated.keys.length).toBe(1)
            expect(updated.keys[0].key).toBe('room1')
            expect(updated.keys[0].universalKey).toBe('ROOM#uuid1')
        })
    })

    describe('lookup', () => {
        it('should find matching key by key', () => {
            const key1 = new StandardKey({ key: 'room1', universalKey: 'ROOM#uuid1' })
            const collection = new KeyCollection([key1])
            const query = new StandardKey({ key: 'room1' })
            const result = collection.lookup(query)
            
            expect(result).toBeDefined()
            expect(result?.key).toBe('room1')
            expect(result?.universalKey).toBe('ROOM#uuid1')
        })

        it('should find matching key by universalKey', () => {
            const key1 = new StandardKey({ key: 'room1', universalKey: 'ROOM#uuid1' })
            const collection = new KeyCollection([key1])
            const query = new StandardKey({ universalKey: 'ROOM#uuid1' })
            const result = collection.lookup(query)
            
            expect(result).toBeDefined()
            expect(result?.key).toBe('room1')
            expect(result?.universalKey).toBe('ROOM#uuid1')
        })

        it('should find matching key by both key and universalKey', () => {
            const key1 = new StandardKey({ key: 'room1', universalKey: 'ROOM#uuid1' })
            const collection = new KeyCollection([key1])
            const query = new StandardKey({ key: 'room1', universalKey: 'ROOM#uuid1' })
            const result = collection.lookup(query)
            
            expect(result).toBeDefined()
            expect(result?.key).toBe('room1')
            expect(result?.universalKey).toBe('ROOM#uuid1')
        })

        it('should return undefined when key not found', () => {
            const key1 = new StandardKey({ key: 'room1' })
            const collection = new KeyCollection([key1])
            const query = new StandardKey({ key: 'room2' })
            const result = collection.lookup(query)
            
            expect(result).toBeUndefined()
        })

        it('should return cloned key (not same reference)', () => {
            const key1 = new StandardKey({ key: 'room1' })
            const collection = new KeyCollection([key1])
            const query = new StandardKey({ key: 'room1' })
            const result = collection.lookup(query)
            
            expect(result).not.toBe(key1)
            expect(result).not.toBe(collection.keys[0])
        })

        it('should throw error on ambiguous match', () => {
            // Create collection with two different keys that both match a query
            // Key 1: matches by key
            const key1 = new StandardKey({ key: 'room1' })
            // Key 2: matches by universalKey (but different component - this is the ambiguous case)
            const key2 = new StandardKey({ universalKey: 'ROOM#uuid2' })
            const collection = new KeyCollection([key1, key2])
            
            // Query that matches BOTH keys
            const query = new StandardKey({ key: 'room1', universalKey: 'ROOM#uuid2' })
            
            expect(() => collection.lookup(query)).toThrow('Ambiguous key lookup')
        })

        it('should throw error with descriptive message on ambiguous match', () => {
            const key1 = new StandardKey({ key: 'room1' })
            const key2 = new StandardKey({ universalKey: 'ROOM#uuid2' })
            const collection = new KeyCollection([key1, key2])
            const query = new StandardKey({ key: 'room1', universalKey: 'ROOM#uuid2' })
            
            try {
                collection.lookup(query)
                fail('Should have thrown error')
            } catch (error: any) {
                expect(error.message).toContain('Ambiguous key lookup')
                expect(error.message).toContain('room1')
                expect(error.message).toContain('ROOM#uuid2')
            }
        })

        it('should not throw error when merged keys match query', () => {
            // These should merge into one key
            const key1 = new StandardKey({ key: 'room1' })
            const key2 = new StandardKey({ universalKey: 'ROOM#uuid1' })
            const key3 = new StandardKey({ key: 'room1', universalKey: 'ROOM#uuid1' })
            const collection = new KeyCollection([key1, key2, key3])
            
            // After merging, there's only one key, so no ambiguity
            const query = new StandardKey({ key: 'room1', universalKey: 'ROOM#uuid1' })
            const result = collection.lookup(query)
            
            expect(result).toBeDefined()
            expect(result?.key).toBe('room1')
            expect(result?.universalKey).toBe('ROOM#uuid1')
        })
    })

    describe('integration scenarios', () => {
        it('should handle typical construction and lookup flow', () => {
            // Simulate building a collection from component appearances
            const appearances = [
                new StandardKey({ key: 'room1' }),
                new StandardKey({ universalKey: 'ROOM#uuid1' }), // Same component, different appearance
                new StandardKey({ key: 'room1', universalKey: 'ROOM#uuid1' }),
                new StandardKey({ key: 'room2', universalKey: 'ROOM#uuid2' }),
                new StandardKey({ universalKey: 'FEATURE#uuid1' })
            ]
            
            const collection = new KeyCollection(appearances)
            
            // room1 and ROOM#uuid1 should have merged
            expect(collection.keys.length).toBe(3)
            
            // Lookup by key should work
            const lookup1 = collection.lookup(new StandardKey({ key: 'room1' }))
            expect(lookup1?.universalKey).toBe('ROOM#uuid1')
            
            // Lookup by universalKey should work
            const lookup2 = collection.lookup(new StandardKey({ universalKey: 'ROOM#uuid2' }))
            expect(lookup2?.key).toBe('room2')
        })

        it('should handle withKey chain', () => {
            const collection = new KeyCollection([])
                .withKey(new StandardKey({ key: 'room1' }))
                .withKey(new StandardKey({ key: 'room1', universalKey: 'ROOM#uuid1' }))
                .withKey(new StandardKey({ key: 'room2' }))
            
            expect(collection.keys.length).toBe(2)
            const room1 = collection.lookup(new StandardKey({ key: 'room1' }))
            expect(room1?.universalKey).toBe('ROOM#uuid1')
        })
    })
})

