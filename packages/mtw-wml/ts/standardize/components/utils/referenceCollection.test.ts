import { ReferenceCollection } from "./referenceCollection"
import { StandardReference } from "../reference"
import { StandardKey } from "../../keys/key"

describe('ReferenceCollection', () => {
    describe('constructor', () => {
        it('should create empty collection from empty array', () => {
            const collection = new ReferenceCollection([])
            expect(collection.references).toEqual([])
        })

        it('should create collection with single reference', () => {
            const ref = new StandardReference({ key: 'room1', tag: 'Room' })
            const collection = new ReferenceCollection([ref])
            expect(collection.references.length).toBe(1)
            expect(collection.references[0].key).toBe('room1')
            expect(collection.references[0].tag).toBe('Room')
        })

        it('should deduplicate identical references', () => {
            const ref1 = new StandardReference({ key: 'room1', tag: 'Room' })
            const ref2 = new StandardReference({ key: 'room1', tag: 'Room' })
            const collection = new ReferenceCollection([ref1, ref2])
            expect(collection.references.length).toBe(1)
            expect(collection.references[0].key).toBe('room1')
            expect(collection.references[0].tag).toBe('Room')
        })

        it('should merge references that match by key', () => {
            const ref1 = new StandardReference({ key: 'room1', tag: 'Room' })
            const ref2 = new StandardReference({ key: 'room1', universalKey: 'ROOM#uuid1', tag: 'Room' })
            const collection = new ReferenceCollection([ref1, ref2])
            expect(collection.references.length).toBe(1)
            expect(collection.references[0].key).toBe('room1')
            expect(collection.references[0].universalKey).toBe('ROOM#uuid1')
            expect(collection.references[0].tag).toBe('Room')
        })

        it('should merge references that match by universalKey', () => {
            const ref1 = new StandardReference('ROOM#uuid1', 'Room')
            const ref2 = new StandardReference({ key: 'room1', universalKey: 'ROOM#uuid1', tag: 'Room' })
            const collection = new ReferenceCollection([ref1, ref2])
            expect(collection.references.length).toBe(1)
            expect(collection.references[0].key).toBe('room1')
            expect(collection.references[0].universalKey).toBe('ROOM#uuid1')
            expect(collection.references[0].tag).toBe('Room')
        })

        it('should merge multiple partial references into one complete reference', () => {
            const ref1 = new StandardReference({ key: 'room1', tag: 'Room' })
            const ref2 = new StandardReference('ROOM#uuid1', 'Room')
            const ref3 = new StandardReference({ key: 'room1', universalKey: 'ROOM#uuid1', tag: 'Room' })
            const collection = new ReferenceCollection([ref1, ref2, ref3])
            expect(collection.references.length).toBe(1)
            expect(collection.references[0].key).toBe('room1')
            expect(collection.references[0].universalKey).toBe('ROOM#uuid1')
            expect(collection.references[0].tag).toBe('Room')
        })

        it('should keep distinct references separate', () => {
            const ref1 = new StandardReference({ key: 'room1', tag: 'Room' })
            const ref2 = new StandardReference({ key: 'room2', tag: 'Room' })
            const ref3 = new StandardReference('FEATURE#uuid1', 'Feature')
            const collection = new ReferenceCollection([ref1, ref2, ref3])
            expect(collection.references.length).toBe(3)
        })

        it('should throw error when merging references with different tags', () => {
            const ref1 = new StandardReference({ key: 'room1', tag: 'Room' })
            const ref2 = new StandardReference({ key: 'room1', tag: 'Feature' })
            
            expect(() => new ReferenceCollection([ref1, ref2])).toThrow('Cannot merge references with different tags')
        })

        it('should handle references with only universalKey', () => {
            const ref1 = new StandardReference('ROOM#uuid1', 'Room')
            const ref2 = new StandardReference('ROOM#uuid2', 'Room')
            const collection = new ReferenceCollection([ref1, ref2])
            expect(collection.references.length).toBe(2)
        })

        it('should handle ComponentUUID string form', () => {
            const ref1 = new StandardReference('ROOM#uuid1', 'Room')
            const ref2 = new StandardReference({ key: 'room1', universalKey: 'ROOM#uuid1', tag: 'Room' })
            const collection = new ReferenceCollection([ref1, ref2])
            expect(collection.references.length).toBe(1)
            expect(collection.references[0].key).toBe('room1')
            expect(collection.references[0].universalKey).toBe('ROOM#uuid1')
        })
    })

    describe('references getter', () => {
        it('should return array of references', () => {
            const ref1 = new StandardReference({ key: 'room1', tag: 'Room' })
            const ref2 = new StandardReference({ key: 'room2', tag: 'Room' })
            const collection = new ReferenceCollection([ref1, ref2])
            const references = collection.references
            expect(Array.isArray(references)).toBe(true)
            expect(references.length).toBe(2)
        })
    })

    describe('clone', () => {
        it('should create independent copy', () => {
            const ref1 = new StandardReference({ key: 'room1', tag: 'Room' })
            const original = new ReferenceCollection([ref1])
            const cloned = original.clone()
            
            expect(cloned).not.toBe(original)
            expect(cloned.references.length).toBe(original.references.length)
            expect(cloned.references[0].key).toBe(original.references[0].key)
            expect(cloned.references[0]).not.toBe(original.references[0])
        })

        it('should not affect original when cloned collection is modified', () => {
            const ref1 = new StandardReference({ key: 'room1', tag: 'Room' })
            const original = new ReferenceCollection([ref1])
            const cloned = original.clone()
            
            const ref2 = new StandardReference({ key: 'room2', tag: 'Room' })
            const modified = cloned.withReference(ref2)
            
            expect(original.references.length).toBe(1)
            expect(modified.references.length).toBe(2)
        })
    })

    describe('withReference', () => {
        it('should add new reference to collection', () => {
            const ref1 = new StandardReference({ key: 'room1', tag: 'Room' })
            const collection = new ReferenceCollection([ref1])
            const ref2 = new StandardReference({ key: 'room2', tag: 'Room' })
            const updated = collection.withReference(ref2)
            
            expect(updated.references.length).toBe(2)
            expect(updated.references.map(r => r.key)).toContain('room1')
            expect(updated.references.map(r => r.key)).toContain('room2')
        })

        it('should not modify original collection', () => {
            const ref1 = new StandardReference({ key: 'room1', tag: 'Room' })
            const collection = new ReferenceCollection([ref1])
            const ref2 = new StandardReference({ key: 'room2', tag: 'Room' })
            collection.withReference(ref2)
            
            expect(collection.references.length).toBe(1)
        })

        it('should merge with existing matching reference', () => {
            const ref1 = new StandardReference({ key: 'room1', tag: 'Room' })
            const collection = new ReferenceCollection([ref1])
            const ref2 = new StandardReference({ key: 'room1', universalKey: 'ROOM#uuid1', tag: 'Room' })
            const updated = collection.withReference(ref2)
            
            expect(updated.references.length).toBe(1)
            expect(updated.references[0].key).toBe('room1')
            expect(updated.references[0].universalKey).toBe('ROOM#uuid1')
            expect(updated.references[0].tag).toBe('Room')
        })

        it('should throw error when adding reference with different tag', () => {
            const ref1 = new StandardReference({ key: 'room1', tag: 'Room' })
            const collection = new ReferenceCollection([ref1])
            const ref2 = new StandardReference({ key: 'room1', tag: 'Feature' })
            
            expect(() => collection.withReference(ref2)).toThrow('Cannot merge references with different tags')
        })

        it('should merge multiple matching references when adding new reference', () => {
            const ref1 = new StandardReference({ key: 'room1', tag: 'Room' })
            const ref2 = new StandardReference('ROOM#uuid1', 'Room')
            const collection = new ReferenceCollection([ref1, ref2])
            
            const ref3 = new StandardReference({ key: 'room1', universalKey: 'ROOM#uuid1', tag: 'Room' })
            const updated = collection.withReference(ref3)
            
            expect(updated.references.length).toBe(1)
            expect(updated.references[0].key).toBe('room1')
            expect(updated.references[0].universalKey).toBe('ROOM#uuid1')
            expect(updated.references[0].tag).toBe('Room')
        })
    })

    describe('lookup', () => {
        it('should find matching reference by key', () => {
            const ref1 = new StandardReference({ key: 'room1', universalKey: 'ROOM#uuid1', tag: 'Room' })
            const collection = new ReferenceCollection([ref1])
            const query = new StandardKey({ key: 'room1' })
            const result = collection.lookup(query)
            
            expect(result).toBeDefined()
            expect(result?.key).toBe('room1')
            expect(result?.universalKey).toBe('ROOM#uuid1')
            expect(result?.tag).toBe('Room')
        })

        it('should find matching reference by universalKey', () => {
            const ref1 = new StandardReference({ key: 'room1', universalKey: 'ROOM#uuid1', tag: 'Room' })
            const collection = new ReferenceCollection([ref1])
            const query = new StandardKey({ universalKey: 'ROOM#uuid1' })
            const result = collection.lookup(query)
            
            expect(result).toBeDefined()
            expect(result?.key).toBe('room1')
            expect(result?.universalKey).toBe('ROOM#uuid1')
            expect(result?.tag).toBe('Room')
        })

        it('should find matching reference by both key and universalKey', () => {
            const ref1 = new StandardReference({ key: 'room1', universalKey: 'ROOM#uuid1', tag: 'Room' })
            const collection = new ReferenceCollection([ref1])
            const query = new StandardKey({ key: 'room1', universalKey: 'ROOM#uuid1' })
            const result = collection.lookup(query)
            
            expect(result).toBeDefined()
            expect(result?.key).toBe('room1')
            expect(result?.universalKey).toBe('ROOM#uuid1')
            expect(result?.tag).toBe('Room')
        })

        it('should return undefined when reference not found', () => {
            const ref1 = new StandardReference({ key: 'room1', tag: 'Room' })
            const collection = new ReferenceCollection([ref1])
            const query = new StandardKey({ key: 'room2' })
            const result = collection.lookup(query)
            
            expect(result).toBeUndefined()
        })

        it('should return cloned reference (not same reference)', () => {
            const ref1 = new StandardReference({ key: 'room1', tag: 'Room' })
            const collection = new ReferenceCollection([ref1])
            const query = new StandardKey({ key: 'room1' })
            const result = collection.lookup(query)
            
            expect(result).not.toBe(ref1)
            expect(result).not.toBe(collection.references[0])
        })

        it('should throw error on ambiguous match', () => {
            const ref1 = new StandardReference({ key: 'room1', tag: 'Room' })
            const ref2 = new StandardReference('ROOM#uuid2', 'Room')
            const collection = new ReferenceCollection([ref1, ref2])
            
            const query = new StandardKey({ key: 'room1', universalKey: 'ROOM#uuid2' })
            
            expect(() => collection.lookup(query)).toThrow('Ambiguous reference lookup')
        })

        it('should throw error with descriptive message on ambiguous match', () => {
            const ref1 = new StandardReference({ key: 'room1', tag: 'Room' })
            const ref2 = new StandardReference('ROOM#uuid2', 'Room')
            const collection = new ReferenceCollection([ref1, ref2])
            const query = new StandardKey({ key: 'room1', universalKey: 'ROOM#uuid2' })
            
            try {
                collection.lookup(query)
                fail('Should have thrown error')
            } catch (error: any) {
                expect(error.message).toContain('Ambiguous reference lookup')
                expect(error.message).toContain('room1')
                expect(error.message).toContain('ROOM#uuid2')
            }
        })

        it('should not throw error when merged references match query', () => {
            const ref1 = new StandardReference({ key: 'room1', tag: 'Room' })
            const ref2 = new StandardReference('ROOM#uuid1', 'Room')
            const ref3 = new StandardReference({ key: 'room1', universalKey: 'ROOM#uuid1', tag: 'Room' })
            const collection = new ReferenceCollection([ref1, ref2, ref3])
            
            const query = new StandardKey({ key: 'room1', universalKey: 'ROOM#uuid1' })
            const result = collection.lookup(query)
            
            expect(result).toBeDefined()
            expect(result?.key).toBe('room1')
            expect(result?.universalKey).toBe('ROOM#uuid1')
            expect(result?.tag).toBe('Room')
        })
    })

    describe('integration scenarios', () => {
        it('should handle typical construction and lookup flow', () => {
            const appearances = [
                new StandardReference({ key: 'room1', tag: 'Room' }),
                new StandardReference('ROOM#uuid1', 'Room'),
                new StandardReference({ key: 'room1', universalKey: 'ROOM#uuid1', tag: 'Room' }),
                new StandardReference({ key: 'room2', universalKey: 'ROOM#uuid2', tag: 'Room' }),
                new StandardReference('FEATURE#uuid1', 'Feature')
            ]
            
            const collection = new ReferenceCollection(appearances)
            
            expect(collection.references.length).toBe(3)
            
            const lookup1 = collection.lookup(new StandardKey({ key: 'room1' }))
            expect(lookup1?.universalKey).toBe('ROOM#uuid1')
            expect(lookup1?.tag).toBe('Room')
            
            const lookup2 = collection.lookup(new StandardKey({ universalKey: 'ROOM#uuid2' }))
            expect(lookup2?.key).toBe('room2')
            expect(lookup2?.tag).toBe('Room')
        })

        it('should handle withReference chain', () => {
            const collection = new ReferenceCollection([])
                .withReference(new StandardReference({ key: 'room1', tag: 'Room' }))
                .withReference(new StandardReference({ key: 'room1', universalKey: 'ROOM#uuid1', tag: 'Room' }))
                .withReference(new StandardReference({ key: 'room2', tag: 'Room' }))
            
            expect(collection.references.length).toBe(2)
            const room1 = collection.lookup(new StandardKey({ key: 'room1' }))
            expect(room1?.universalKey).toBe('ROOM#uuid1')
            expect(room1?.tag).toBe('Room')
        })

        it('should preserve tag information throughout operations', () => {
            const ref1 = new StandardReference({ key: 'room1', tag: 'Room' })
            const ref2 = new StandardReference('ROOM#uuid1', 'Room')
            const ref3 = new StandardReference({ key: 'room1', universalKey: 'ROOM#uuid1', tag: 'Room' })
            const collection = new ReferenceCollection([ref1, ref2, ref3])
            
            const result = collection.lookup(new StandardKey({ key: 'room1' }))
            expect(result?.tag).toBe('Room')
            expect(result?.universalKey).toBe('ROOM#uuid1')
        })
    })
})

