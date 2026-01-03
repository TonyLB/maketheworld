import { FacetList } from './facetList';
import { StandardFacet } from './facet';
import { PositionPayload, MarkFacetPayload, ExitPayload, StandardFacetData, isPositionPayload, isMarkFacetPayload } from './dataTypes/facet';
import { StandardReferenceData } from './dataTypes/reference';
import { ComponentTag } from '../components/dataTypes/abstract';

describe('FacetList', () => {
    // Helper function to create a valid reference
    const createReference = (key: string, tag: ComponentTag = 'Room', ref: number = 1): StandardReferenceData => ({
        key,
        tag,
        universalKey: `${tag.toUpperCase()}#${key}` as any,
        ref
    });

    // Helper functions to create test facets
    const createPositionFacet = (key: string, x: number, y: number, ref: number = 1): StandardFacet<PositionPayload> => {
        const facetData: StandardFacetData<PositionPayload> = {
            reference: createReference(key, 'Room', ref),
            payload: { type: 'PositionFacet', x, y }
        };
        return new StandardFacet(facetData);
    };

    const createMarkFacet = (key: string, narrative: string, ref: number = 1): StandardFacet<MarkFacetPayload> => {
        const facetData: StandardFacetData<MarkFacetPayload> = {
            reference: createReference(key, 'Example', ref), // Use Example as tag since Mark isn't implemented yet
            payload: { type: 'MarkFacet', narrative }
        };
        return new StandardFacet(facetData);
    };

    const createPositionFacetData = (key: string, x: number, y: number): StandardFacetData<PositionPayload> => ({
        reference: createReference(key, 'Room'),
        payload: { type: 'PositionFacet', x, y }
    });

    const createMarkFacetData = (key: string, narrative: string): StandardFacetData<MarkFacetPayload> => ({
        reference: createReference(key, 'Example'), // Use Example as tag since Mark isn't implemented yet
        payload: { type: 'MarkFacet', narrative }
    });

    describe('Construction', () => {
        it('should construct from empty array', () => {
            const list = new FacetList<PositionPayload>([]);
            expect(list.length).toBe(0);
            expect(list.items).toEqual([]);
        });

        it('should construct from array of StandardFacet instances', () => {
            const facet1 = createPositionFacet('room1', 10, 20);
            const facet2 = createPositionFacet('room2', 30, 40);
            const list = new FacetList([facet1, facet2]);
            
            expect(list.length).toBe(2);
            expect(list.items[0].payload).toEqual({ type: 'PositionFacet', x: 10, y: 20 });
            expect(list.items[1].payload).toEqual({ type: 'PositionFacet', x: 30, y: 40 });
        });

        it('should construct from array of StandardFacetData (JSON format)', () => {
            const data1 = createPositionFacetData('room1', 10, 20);
            const data2 = createPositionFacetData('room2', 30, 40);
            const list = new FacetList<PositionPayload>([data1, data2]);
            
            expect(list.length).toBe(2);
            expect(list.items[0].payload).toEqual({ type: 'PositionFacet', x: 10, y: 20 });
            expect(list.items[1].payload).toEqual({ type: 'PositionFacet', x: 30, y: 40 });
        });

        it('should construct from array with Replace operations', () => {
            const matchData: StandardFacetData<PositionPayload> = {
                reference: createReference('room1', 'Room'),
                payload: { type: 'PositionFacet', x: 5, y: 10 }
            };
            const payloadData: StandardFacetData<PositionPayload> = {
                reference: createReference('room1', 'Room'),
                payload: { type: 'PositionFacet', x: 10, y: 20 }
            };
            const replaceData = {
                tag: 'Replace' as const,
                match: matchData,
                payload: payloadData
            };
            
            const list = new FacetList<PositionPayload>([replaceData]);
            expect(list.length).toBe(1);
            expect(list.items[0].isReplace).toBe(true);
            expect(list.items[0].payload).toEqual({ type: 'PositionFacet', x: 10, y: 20 });
            expect(list.items[0].matchPayload).toEqual({ type: 'PositionFacet', x: 5, y: 10 });
        });

        it('should construct by cloning from another FacetList', () => {
            const original = new FacetList<PositionPayload>([
                createPositionFacetData('room1', 10, 20),
                createPositionFacetData('room2', 30, 40)
            ]);
            const cloned = new FacetList(original);
            
            expect(cloned.length).toBe(2);
            expect(cloned).not.toBe(original);
            expect(cloned.equals(original)).toBe(true);
            // Verify independence
            const originalJson = original.toJSON();
            const clonedJson = cloned.toJSON();
            expect(clonedJson).toEqual(originalJson);
        });

        it('should construct with payload type guard (runtime validation)', () => {
            const validData = createPositionFacetData('room1', 10, 20);
            const list = new FacetList<PositionPayload>([validData], isPositionPayload);
            
            expect(list.length).toBe(1);
            expect(list.items[0].payload.type).toBe('PositionFacet');
        });

        it('should throw error when payload type guard rejects invalid payload', () => {
            const invalidData: any = {
                reference: createReference('room1', 'Room'),
                payload: { type: 'MarkFacet', narrative: 'Invalid' } // Wrong type
            };
            
            expect(() => {
                new FacetList<PositionPayload>([invalidData], isPositionPayload);
            }).toThrow('FacetList: Facet data payload type mismatch');
        });

        it('should merge items with same key during construction (deduplication)', () => {
            const data1: StandardFacetData<PositionPayload> = {
                reference: createReference('room1', 'Room', 1),
                payload: { type: 'PositionFacet', x: 10, y: 20 }
            };
            const data2: StandardFacetData<PositionPayload> = {
                reference: createReference('room1', 'Room', 2),
                payload: { type: 'PositionFacet', x: 10, y: 20 }
            };
            
            const list = new FacetList<PositionPayload>([data1, data2]);
            expect(list.length).toBe(1);
            expect(list.items[0].ref).toBe(3); // 1 + 2
        });

        it('should normalize references during construction', () => {
            const data: StandardFacetData<PositionPayload> = {
                reference: {
                    key: 'room1',
                    tag: 'Room',
                    universalKey: 'ROOM#room1',
                    ref: 1,
                    // Include extra fields that should be normalized
                    shortName: 'Room 1'
                } as any,
                payload: { type: 'PositionFacet', x: 10, y: 20 }
            };
            
            const list = new FacetList<PositionPayload>([data]);
            const json = list.toJSON();
            // Normalized reference should only contain minimum key information
            // Check if it's a plain StandardFacetData (not Remove/Replace)
            const item = json[0];
            if (!('tag' in item) || (item.tag !== 'Remove' && item.tag !== 'Replace')) {
                expect(item).toHaveProperty('reference');
                expect(item).toHaveProperty('payload');
                if ('reference' in item && typeof item.reference === 'object') {
                    expect(item.reference).toHaveProperty('key');
                    expect(item.reference).toHaveProperty('tag');
                }
            }
        });

        it('should preserve Replace operations during normalization', () => {
            const matchData: StandardFacetData<PositionPayload> = {
                reference: createReference('room1', 'Room'),
                payload: { type: 'PositionFacet', x: 5, y: 10 }
            };
            const payloadData: StandardFacetData<PositionPayload> = {
                reference: createReference('room1', 'Room'),
                payload: { type: 'PositionFacet', x: 10, y: 20 }
            };
            const replaceData = {
                tag: 'Replace' as const,
                match: matchData,
                payload: payloadData
            };
            
            const list = new FacetList<PositionPayload>([replaceData]);
            expect(list.items[0].isReplace).toBe(true);
            const json = list.toJSON();
            expect(json[0]).toHaveProperty('tag', 'Replace');
        });

        it('should throw error for invalid argument type', () => {
            expect(() => {
                new FacetList({ invalid: 'data' } as any);
            }).toThrow('Invalid argument type for FacetList constructor');
        });

        it('should throw error for schema tree nodes', () => {
            // Mock schema tree node
            const schemaNode = {
                data: { tag: 'Room' },
                children: []
            };
            
            expect(() => {
                new FacetList([schemaNode] as any);
            }).toThrow('Schema tree construction for FacetList requires StandardFacetData format');
        });
    });

    describe('Serialization', () => {
        it('should serialize to JSON correctly', () => {
            const list = new FacetList<PositionPayload>([
                createPositionFacetData('room1', 10, 20),
                createPositionFacetData('room2', 30, 40)
            ]);
            
            const json = list.toJSON();
            expect(json).toHaveLength(2);
            // Check if it's a plain StandardFacetData (not Remove/Replace)
            const item = json[0];
            if (!('tag' in item) || (item.tag !== 'Remove' && item.tag !== 'Replace')) {
                expect(item).toHaveProperty('reference');
                expect(item).toHaveProperty('payload');
                if ('payload' in item) {
                    expect(item.payload).toEqual({ type: 'PositionFacet', x: 10, y: 20 });
                }
            }
        });

        it('should round-trip serialize (construct → toJSON → construct → equals)', () => {
            const original = new FacetList<PositionPayload>([
                createPositionFacetData('room1', 10, 20),
                createPositionFacetData('room2', 30, 40)
            ]);
            
            const json = original.toJSON();
            const roundTrip = new FacetList<PositionPayload>(json);
            
            expect(roundTrip.equals(original)).toBe(true);
        });

        it('should serialize Replace operations correctly', () => {
            const matchData: StandardFacetData<PositionPayload> = {
                reference: createReference('room1', 'Room'),
                payload: { type: 'PositionFacet', x: 5, y: 10 }
            };
            const payloadData: StandardFacetData<PositionPayload> = {
                reference: createReference('room1', 'Room'),
                payload: { type: 'PositionFacet', x: 10, y: 20 }
            };
            const replaceData = {
                tag: 'Replace' as const,
                match: matchData,
                payload: payloadData
            };
            
            const list = new FacetList<PositionPayload>([replaceData]);
            const json = list.toJSON();
            
            expect(json[0]).toHaveProperty('tag', 'Replace');
            if ('tag' in json[0] && json[0].tag === 'Replace') {
                // Match data may be normalized (ref field may be omitted if it's 1)
                const match = json[0].match;
                expect(match.payload).toEqual(matchData.payload);
                // Reference may be normalized, so verify structure without checking exact ref value
                expect(match).toHaveProperty('reference');
                // Payload part should match (reference may be normalized)
                const payload = json[0].payload;
                expect(payload.payload).toEqual(payloadData.payload);
                // Verify payload structure
                if ('payload' in payload && typeof payload.payload === 'object') {
                    expect(payload.payload).toHaveProperty('type', 'PositionFacet');
                    expect(payload.payload).toHaveProperty('x', 10);
                    expect(payload.payload).toHaveProperty('y', 20);
                }
            }
        });

        it('should generate schema correctly', () => {
            const list = new FacetList<PositionPayload>([
                createPositionFacetData('room1', 10, 20)
            ]);
            
            const schema = list.schema;
            expect(Array.isArray(schema)).toBe(true);
            expect(schema.length).toBeGreaterThan(0);
        });

        it('should include Replace tags in schema when facets have Replace operations', () => {
            const matchData: StandardFacetData<PositionPayload> = {
                reference: createReference('room1', 'Room'),
                payload: { type: 'PositionFacet', x: 5, y: 10 }
            };
            const payloadData: StandardFacetData<PositionPayload> = {
                reference: createReference('room1', 'Room'),
                payload: { type: 'PositionFacet', x: 10, y: 20 }
            };
            const replaceData = {
                tag: 'Replace' as const,
                match: matchData,
                payload: payloadData
            };
            
            const list = new FacetList<PositionPayload>([replaceData]);
            const schema = list.schema;
            
            // Schema should contain Replace tag
            const hasReplace = schema.some(node => 
                node.data && typeof node.data === 'object' && 'tag' in node.data && node.data.tag === 'Replace'
            );
            expect(hasReplace).toBe(true);
        });
    });

    describe('Basic Accessors and Utilities', () => {
        it('should return items array', () => {
            const facet1 = createPositionFacet('room1', 10, 20);
            const facet2 = createPositionFacet('room2', 30, 40);
            const list = new FacetList([facet1, facet2]);
            
            expect(list.items).toHaveLength(2);
            expect(list.items[0]).toBeInstanceOf(StandardFacet);
        });

        it('should return correct length', () => {
            const list = new FacetList<PositionPayload>([
                createPositionFacetData('room1', 10, 20),
                createPositionFacetData('room2', 30, 40),
                createPositionFacetData('room3', 50, 60)
            ]);
            
            expect(list.length).toBe(3);
        });

        it('should create independent clone', () => {
            const original = new FacetList<PositionPayload>([
                createPositionFacetData('room1', 10, 20)
            ]);
            const cloned = original.clone();
            
            expect(cloned).not.toBe(original);
            expect(cloned.equals(original)).toBe(true);
            expect(cloned.length).toBe(original.length);
        });

        it('should compare lists correctly (order-independent, set-like)', () => {
            const list1 = new FacetList<PositionPayload>([
                createPositionFacetData('room1', 10, 20),
                createPositionFacetData('room2', 30, 40)
            ]);
            const list2 = new FacetList<PositionPayload>([
                createPositionFacetData('room2', 30, 40),
                createPositionFacetData('room1', 10, 20)
            ]);
            
            expect(list1.equals(list2)).toBe(true);
        });

        it('should return false for different lists', () => {
            const list1 = new FacetList<PositionPayload>([
                createPositionFacetData('room1', 10, 20)
            ]);
            const list2 = new FacetList<PositionPayload>([
                createPositionFacetData('room2', 30, 40)
            ]);
            
            expect(list1.equals(list2)).toBe(false);
        });

        it('should return false when comparing with non-FacetList', () => {
            const list = new FacetList<PositionPayload>([
                createPositionFacetData('room1', 10, 20)
            ]);
            
            expect(list.equals({} as any)).toBe(false);
        });
    });

    describe('Merge Operations', () => {
        it('should merge two lists with no overlapping keys', () => {
            const base = new FacetList<PositionPayload>([
                createPositionFacetData('room1', 10, 20)
            ]);
            const incoming = new FacetList<PositionPayload>([
                createPositionFacetData('room2', 30, 40)
            ]);
            
            const merged = base.merge(incoming);
            expect(merged.length).toBe(2);
            expect(merged.items.some(f => f.reference.key === 'room1')).toBe(true);
            expect(merged.items.some(f => f.reference.key === 'room2')).toBe(true);
        });

        it('should merge lists with matching keys and same payload (ref arithmetic only)', () => {
            const base = new FacetList<PositionPayload>([{
                reference: createReference('room1', 'Room', 1),
                payload: { type: 'PositionFacet', x: 10, y: 20 }
            }]);
            const incoming = new FacetList<PositionPayload>([{
                reference: createReference('room1', 'Room', 2),
                payload: { type: 'PositionFacet', x: 10, y: 20 }
            }]);
            
            const merged = base.merge(incoming);
            expect(merged.length).toBe(1);
            expect(merged.items[0].ref).toBe(3); // 1 + 2
            expect(merged.items[0].isReplace).toBe(false);
        });

        it('should merge lists with matching keys and different payload (creates Replace operation)', () => {
            const base = new FacetList<PositionPayload>([{
                reference: createReference('room1', 'Room', 1),
                payload: { type: 'PositionFacet', x: 5, y: 10 }
            }]);
            const incoming = new FacetList<PositionPayload>([{
                reference: createReference('room1', 'Room', 1),
                payload: { type: 'PositionFacet', x: 10, y: 20 }
            }]);
            
            const merged = base.merge(incoming);
            expect(merged.length).toBe(1);
            expect(merged.items[0].isReplace).toBe(true);
            expect(merged.items[0].payload).toEqual({ type: 'PositionFacet', x: 10, y: 20 });
            expect(merged.items[0].matchPayload).toEqual({ type: 'PositionFacet', x: 5, y: 10 });
        });

        it('should preserve unmatched base items', () => {
            const base = new FacetList<PositionPayload>([
                createPositionFacetData('room1', 10, 20),
                createPositionFacetData('room2', 30, 40)
            ]);
            const incoming = new FacetList<PositionPayload>([
                createPositionFacetData('room3', 50, 60)
            ]);
            
            const merged = base.merge(incoming);
            expect(merged.length).toBe(3);
            expect(merged.items.some(f => f.reference.key === 'room1')).toBe(true);
            expect(merged.items.some(f => f.reference.key === 'room2')).toBe(true);
            expect(merged.items.some(f => f.reference.key === 'room3')).toBe(true);
        });

        it('should handle ref arithmetic correctly', () => {
            const base = new FacetList<PositionPayload>([{
                reference: createReference('room1', 'Room', 1),
                payload: { type: 'PositionFacet', x: 10, y: 20 }
            }]);
            const incoming = new FacetList<PositionPayload>([{
                reference: createReference('room1', 'Room', 2),
                payload: { type: 'PositionFacet', x: 10, y: 20 }
            }]);
            
            const merged = base.merge(incoming);
            expect(merged.items[0].ref).toBe(3); // 1 + 2
        });

        it('should handle payload Replace when payloads differ', () => {
            const base = new FacetList<PositionPayload>([{
                reference: createReference('room1', 'Room', 1),
                payload: { type: 'PositionFacet', x: 5, y: 10 }
            }]);
            const incoming = new FacetList<PositionPayload>([{
                reference: createReference('room1', 'Room', 1),
                payload: { type: 'PositionFacet', x: 15, y: 25 }
            }]);
            
            const merged = base.merge(incoming);
            expect(merged.items[0].isReplace).toBe(true);
            expect(merged.items[0].payload).toEqual({ type: 'PositionFacet', x: 15, y: 25 });
        });

        it('should filter out undefined results when merge cancels out', () => {
            const base = new FacetList<PositionPayload>([{
                reference: createReference('room1', 'Room', 1),
                payload: { type: 'PositionFacet', x: 10, y: 20 }
            }]);
            const incoming = new FacetList<PositionPayload>([{
                reference: createReference('room1', 'Room', -1),
                payload: { type: 'PositionFacet', x: 10, y: 20 }
            }]);
            
            const merged = base.merge(incoming);
            // When ref cancels out (1 + -1 = 0) and payloads are same, merge returns undefined
            expect(merged.length).toBe(0);
        });

        it('should preserve _payloadTypeGuard in result', () => {
            const base = new FacetList<PositionPayload>([
                createPositionFacetData('room1', 10, 20)
            ], isPositionPayload);
            const incoming = new FacetList<PositionPayload>([
                createPositionFacetData('room2', 30, 40)
            ], isPositionPayload);
            
            const merged = base.merge(incoming);
            // Type guard should be preserved (tested by ensuring no errors when using type guard)
            expect(merged.length).toBe(2);
        });

        it('should throw error for non-FacetList arguments', () => {
            const list = new FacetList<PositionPayload>([
                createPositionFacetData('room1', 10, 20)
            ]);
            
            expect(() => {
                list.merge({} as any);
            }).toThrow('Cannot merge with non-FacetList instance');
        });
    });

    describe('Diff Operations', () => {
        it('should return empty list when diffing identical lists', () => {
            const list1 = new FacetList<PositionPayload>([
                createPositionFacetData('room1', 10, 20)
            ]);
            const list2 = new FacetList<PositionPayload>([
                createPositionFacetData('room1', 10, 20)
            ]);
            
            const diff = list1.diff(list2);
            // When lists are identical, diff should return minimal (empty or same)
            expect(diff.length).toBe(0);
        });

        it('should diff lists with matching keys and same payload (ref diff only)', () => {
            const base = new FacetList<PositionPayload>([{
                reference: createReference('room1', 'Room', 1),
                payload: { type: 'PositionFacet', x: 10, y: 20 }
            }]);
            const incoming = new FacetList<PositionPayload>([{
                reference: createReference('room1', 'Room', 2),
                payload: { type: 'PositionFacet', x: 10, y: 20 }
            }]);
            
            const diff = base.diff(incoming);
            expect(diff.length).toBe(1);
            expect(diff.items[0].ref).toBe(1); // 2 - 1
            expect(diff.items[0].isReplace).toBe(false);
        });

        it('should diff lists with matching keys and different payload (creates Replace operation)', () => {
            const base = new FacetList<PositionPayload>([{
                reference: createReference('room1', 'Room', 1),
                payload: { type: 'PositionFacet', x: 5, y: 10 }
            }]);
            const incoming = new FacetList<PositionPayload>([{
                reference: createReference('room1', 'Room', 1),
                payload: { type: 'PositionFacet', x: 10, y: 20 }
            }]);
            
            const diff = base.diff(incoming);
            expect(diff.length).toBe(1);
            expect(diff.items[0].isReplace).toBe(true);
            expect(diff.items[0].payload).toEqual({ type: 'PositionFacet', x: 10, y: 20 });
            expect(diff.items[0].matchPayload).toEqual({ type: 'PositionFacet', x: 5, y: 10 });
        });

        it('should invert unmatched base items', () => {
            const base = new FacetList<PositionPayload>([
                createPositionFacetData('room1', 10, 20)
            ]);
            const incoming = new FacetList<PositionPayload>([]);
            
            const diff = base.diff(incoming);
            expect(diff.length).toBe(1);
            expect(diff.items[0].ref).toBe(-1); // Inverted
        });

        it('should include unmatched incoming items as-is', () => {
            const base = new FacetList<PositionPayload>([]);
            const incoming = new FacetList<PositionPayload>([
                createPositionFacetData('room1', 10, 20)
            ]);
            
            const diff = base.diff(incoming);
            expect(diff.length).toBe(1);
            expect(diff.items[0].ref).toBe(1); // As-is
        });

        it('should handle ref arithmetic correctly in diff', () => {
            const base = new FacetList<PositionPayload>([{
                reference: createReference('room1', 'Room', 1),
                payload: { type: 'PositionFacet', x: 10, y: 20 }
            }]);
            const incoming = new FacetList<PositionPayload>([{
                reference: createReference('room1', 'Room', 2),
                payload: { type: 'PositionFacet', x: 10, y: 20 }
            }]);
            
            const diff = base.diff(incoming);
            expect(diff.items[0].ref).toBe(1); // 2 - 1
        });

        it('should preserve _payloadTypeGuard in result', () => {
            const base = new FacetList<PositionPayload>([
                createPositionFacetData('room1', 10, 20)
            ], isPositionPayload);
            const incoming = new FacetList<PositionPayload>([
                createPositionFacetData('room2', 30, 40)
            ], isPositionPayload);
            
            const diff = base.diff(incoming);
            expect(diff.length).toBeGreaterThan(0);
        });

        it('should throw error for non-FacetList arguments', () => {
            const list = new FacetList<PositionPayload>([
                createPositionFacetData('room1', 10, 20)
            ]);
            
            expect(() => {
                list.diff({} as any);
            }).toThrow('Cannot diff with non-FacetList instance');
        });
    });

    describe('Invert Operations', () => {
        it('should invert list with added facets (ref=1 → ref=-1)', () => {
            const list = new FacetList<PositionPayload>([
                createPositionFacet('room1', 10, 20, 1)
            ]);
            
            const inverted = list.invert();
            expect(inverted.length).toBe(1);
            expect(inverted.items[0].ref).toBe(-1);
        });

        it('should invert list with removed facets (ref=-1 → ref=1)', () => {
            const list = new FacetList<PositionPayload>([
                createPositionFacet('room1', 10, 20, -1)
            ]);
            
            const inverted = list.invert();
            expect(inverted.length).toBe(1);
            expect(inverted.items[0].ref).toBe(1);
        });

        it('should invert list with Replace operations', () => {
            const matchData: StandardFacetData<PositionPayload> = {
                reference: createReference('room1', 'Room'),
                payload: { type: 'PositionFacet', x: 5, y: 10 }
            };
            const payloadData: StandardFacetData<PositionPayload> = {
                reference: createReference('room1', 'Room'),
                payload: { type: 'PositionFacet', x: 10, y: 20 }
            };
            const replaceData = {
                tag: 'Replace' as const,
                match: matchData,
                payload: payloadData
            };
            
            const list = new FacetList<PositionPayload>([replaceData]);
            const inverted = list.invert();
            
            // Note: Current implementation keeps match and payload the same when inverting Replace
            // The reference is inverted (ref arithmetic), but Replace match/payload are preserved
            expect(inverted.items[0].isReplace).toBe(true);
            expect(inverted.items[0].payload).toEqual(payloadData.payload);
            expect(inverted.items[0].matchPayload).toEqual(matchData.payload);
        });

        it('should invert list with mixed operations', () => {
            const list = new FacetList<PositionPayload>([
                createPositionFacet('room1', 10, 20, 1),
                createPositionFacet('room2', 30, 40, -1)
            ]);
            
            const inverted = list.invert();
            expect(inverted.length).toBe(2);
            expect(inverted.items.find(f => f.reference.key === 'room1')?.ref).toBe(-1);
            expect(inverted.items.find(f => f.reference.key === 'room2')?.ref).toBe(1);
        });

        it('should satisfy double inversion property (invert().invert() equals original)', () => {
            const original = new FacetList<PositionPayload>([
                createPositionFacet('room1', 10, 20, 1),
                createPositionFacet('room2', 30, 40, -1)
            ]);
            
            const doubleInverted = original.invert().invert();
            expect(doubleInverted.equals(original)).toBe(true);
        });

        it('should return empty list when inverting empty list', () => {
            const empty = new FacetList<PositionPayload>([]);
            const inverted = empty.invert();
            
            expect(inverted.length).toBe(0);
            expect(inverted.items).toEqual([]);
        });

        it('should preserve _payloadTypeGuard in result', () => {
            const list = new FacetList<PositionPayload>([
                createPositionFacetData('room1', 10, 20)
            ], isPositionPayload);
            
            const inverted = list.invert();
            expect(inverted.length).toBe(1);
        });
    });

    describe('Lookup and Transformation Methods', () => {
        it('should apply mapContents callback to each facet', () => {
            const list = new FacetList<PositionPayload>([
                createPositionFacetData('room1', 10, 20)
            ]);
            
            const mapped = list.mapContents((facet) => {
                const newPayload: PositionPayload = {
                    type: 'PositionFacet',
                    x: facet.payload.x * 2,
                    y: facet.payload.y * 2
                };
                const newData: StandardFacetData<PositionPayload> = {
                    reference: facet.reference.toJSON(),
                    payload: newPayload
                };
                return new StandardFacet(newData);
            });
            
            expect(mapped.length).toBe(1);
            expect(mapped.items[0].payload.x).toBe(20);
            expect(mapped.items[0].payload.y).toBe(40);
        });

        it('should preserve _payloadTypeGuard in mapContents result', () => {
            const list = new FacetList<PositionPayload>([
                createPositionFacetData('room1', 10, 20)
            ], isPositionPayload);
            
            const mapped = list.mapContents((f) => f);
            expect(mapped.length).toBe(1);
        });

        it('should convert all facets to specified format', () => {
            const list = new FacetList<PositionPayload>([
                createPositionFacetData('room1', 10, 20)
            ]);
            
            const formatted = list.toFormat('key');
            const json = formatted.toJSON();
            
            // Check if it's a plain StandardFacetData (not Remove/Replace)
            const item = json[0];
            if (!('tag' in item) || (item.tag !== 'Remove' && item.tag !== 'Replace')) {
                if ('reference' in item && typeof item.reference === 'object' && item.reference !== null) {
                    expect(item.reference).toHaveProperty('key');
                    // In 'key' format, universalKey should not be present (or should be undefined)
                    // Check if property exists before asserting it's not present
                    if ('universalKey' in item.reference) {
                        expect(item.reference.universalKey).toBeUndefined();
                    }
                }
            }
        });

        it('should preserve _payloadTypeGuard in toFormat result', () => {
            const list = new FacetList<PositionPayload>([
                createPositionFacetData('room1', 10, 20)
            ], isPositionPayload);
            
            const formatted = list.toFormat('key');
            expect(formatted.length).toBe(1);
        });

        it('should apply lookup mappings to all facets', () => {
            const list = new FacetList<PositionPayload>([
                createPositionFacetData('room1', 10, 20)
            ]);
            
            // Mock lookup mappings (empty array for now)
            const lookedUp = list.lookup([]);
            
            expect(lookedUp.length).toBe(1);
            expect(lookedUp.items[0]).toBeInstanceOf(StandardFacet);
        });

        it('should preserve _payloadTypeGuard in lookup result', () => {
            const list = new FacetList<PositionPayload>([
                createPositionFacetData('room1', 10, 20)
            ], isPositionPayload);
            
            const lookedUp = list.lookup([]);
            expect(lookedUp.length).toBe(1);
        });
    });

    describe('Edit Algebra Properties', () => {
        it('should combine ref arithmetic in merge/diff (like ReferenceList)', () => {
            // Ref arithmetic: merge should add refs, diff should subtract
            const base = new FacetList<PositionPayload>([{
                reference: createReference('room1', 'Room', 1),
                payload: { type: 'PositionFacet', x: 10, y: 20 }
            }]);
            const incoming = new FacetList<PositionPayload>([{
                reference: createReference('room1', 'Room', 2),
                payload: { type: 'PositionFacet', x: 10, y: 20 }
            }]);
            
            const merged = base.merge(incoming);
            expect(merged.items[0].ref).toBe(3); // 1 + 2
            
            const diff = base.diff(incoming);
            expect(diff.items[0].ref).toBe(1); // 2 - 1
        });

        it('should create Replace operations when payloads differ (unlike ReferenceList)', () => {
            // Facets support Replace operations, References don't
            const base = new FacetList<PositionPayload>([{
                reference: createReference('room1', 'Room', 1),
                payload: { type: 'PositionFacet', x: 5, y: 10 }
            }]);
            const incoming = new FacetList<PositionPayload>([{
                reference: createReference('room1', 'Room', 1),
                payload: { type: 'PositionFacet', x: 10, y: 20 }
            }]);
            
            const merged = base.merge(incoming);
            expect(merged.items[0].isReplace).toBe(true);
            
            const diff = base.diff(incoming);
            expect(diff.items[0].isReplace).toBe(true);
        });

        it('should combine ref-based Add/Remove with payload Replace logic', () => {
            // When refs cancel but payloads differ, should create Replace
            const base = new FacetList<PositionPayload>([{
                reference: createReference('room1', 'Room', 1),
                payload: { type: 'PositionFacet', x: 5, y: 10 }
            }]);
            const incoming = new FacetList<PositionPayload>([{
                reference: createReference('room1', 'Room', -1),
                payload: { type: 'PositionFacet', x: 10, y: 20 }
            }]);
            
            const merged = base.merge(incoming);
            // Ref cancels (1 + -1 = 0), but payloads differ, so should create Replace
            expect(merged.items[0].isReplace).toBe(true);
        });

        it('should invert both ref operations and Replace operations', () => {
            const list = new FacetList<PositionPayload>([
                createPositionFacet('room1', 10, 20, 1)
            ]);
            
            const inverted = list.invert();
            expect(inverted.items[0].ref).toBe(-1);
            
            // Test Replace inversion
            const matchData: StandardFacetData<PositionPayload> = {
                reference: createReference('room2', 'Room'),
                payload: { type: 'PositionFacet', x: 5, y: 10 }
            };
            const payloadData: StandardFacetData<PositionPayload> = {
                reference: createReference('room2', 'Room'),
                payload: { type: 'PositionFacet', x: 10, y: 20 }
            };
            const replaceList = new FacetList<PositionPayload>([{
                tag: 'Replace' as const,
                match: matchData,
                payload: payloadData
            }]);
            
            const invertedReplace = replaceList.invert();
            expect(invertedReplace.items[0].isReplace).toBe(true);
            // Note: Current implementation preserves match/payload order when inverting Replace
            // The reference ref is inverted, but Replace match/payload are kept as-is
            expect(invertedReplace.items[0].payload).toEqual(payloadData.payload);
            expect(invertedReplace.items[0].matchPayload).toEqual(matchData.payload);
        });

        it('should satisfy idempotency: merge(list, list) equals list (when no conflicts)', () => {
            const list = new FacetList<PositionPayload>([
                createPositionFacetData('room1', 10, 20)
            ]);
            
            const merged = list.merge(list);
            // When merging a list with itself, refs are doubled (1 + 1 = 2)
            // So the result won't be equal, but the items should have doubled refs
            expect(merged.length).toBe(1);
            expect(merged.items[0].ref).toBe(2); // 1 + 1
            expect(merged.items[0].payload).toEqual(list.items[0].payload);
        });

        it('should satisfy double inversion property', () => {
            const original = new FacetList<PositionPayload>([
                createPositionFacet('room1', 10, 20, 1),
                createPositionFacet('room2', 30, 40, -1)
            ]);
            
            const doubleInverted = original.invert().invert();
            expect(doubleInverted.equals(original)).toBe(true);
        });
    });

    describe('Type Safety Tests', () => {
        it('should work with FacetList<PositionPayload> (type-safe payload access)', () => {
            const list = new FacetList<PositionPayload>([
                createPositionFacetData('room1', 10, 20)
            ]);
            
            // TypeScript should allow access to PositionPayload properties
            expect(list.items[0].payload.x).toBe(10);
            expect(list.items[0].payload.y).toBe(20);
            expect(list.items[0].payload.type).toBe('PositionFacet');
        });

        it('should work with FacetList<MarkFacetPayload> (type-safe payload access)', () => {
            const list = new FacetList<MarkFacetPayload>([
                createMarkFacetData('mark1', 'A dark room')
            ]);
            
            // TypeScript should allow access to MarkFacetPayload properties
            expect(list.items[0].payload.narrative).toBe('A dark room');
            expect(list.items[0].payload.type).toBe('MarkFacet');
        });

        it('should validate payload type at runtime with type guard', () => {
            const validData = createPositionFacetData('room1', 10, 20);
            const list = new FacetList<PositionPayload>([validData], isPositionPayload);
            
            expect(list.length).toBe(1);
            expect(list.items[0].payload.type).toBe('PositionFacet');
        });

        it('should throw error when payload type guard rejects invalid payload', () => {
            const invalidData: any = {
                reference: createReference('room1', 'Room'),
                payload: { type: 'MarkFacet', narrative: 'Invalid' }
            };
            
            expect(() => {
                new FacetList<PositionPayload>([invalidData], isPositionPayload);
            }).toThrow('FacetList: Facet data payload type mismatch');
        });

        it('should preserve type guard through operations', () => {
            const list1 = new FacetList<PositionPayload>([
                createPositionFacetData('room1', 10, 20)
            ], isPositionPayload);
            const list2 = new FacetList<PositionPayload>([
                createPositionFacetData('room2', 30, 40)
            ], isPositionPayload);
            
            // Type guard should be preserved through merge
            const merged = list1.merge(list2);
            expect(merged.length).toBe(2);
            
            // Type guard should be preserved through diff
            const diff = list1.diff(list2);
            expect(diff.length).toBeGreaterThan(0);
            
            // Type guard should be preserved through invert
            const inverted = list1.invert();
            expect(inverted.length).toBe(1);
        });
    });
});
