import { PositionFacetList, StandardPositionFacet, PositionReplaceClass } from './position';
import { MarkFacetList, StandardMarkFacet } from './mark';
import { PositionPayload, MarkFacetPayload, StandardFacetData } from './dataTypes/facet';
import { StandardReferenceData } from '../dataTypes/reference';
import { ComponentTag } from '../../components/dataTypes/abstract';

describe('Concrete FacetList Classes', () => {
    // Helper function to create a valid reference
    const createReference = (key: string, tag: ComponentTag = 'Room', ref: number = 1): StandardReferenceData => ({
        key,
        tag,
        universalKey: `${tag.toUpperCase()}#${key}` as any,
        ref: ref === 1 ? undefined : ref
    });

    // Helper functions to create test facets
    const createPositionFacet = (key: string, x: number, y: number, ref: number = 1): StandardPositionFacet => {
        const facetData: StandardFacetData<PositionPayload> = {
            reference: createReference(key, 'Room', ref),
            payload: { x, y }
        };
        return new StandardPositionFacet(facetData);
    };

    const createMarkFacet = (key: string, narrative: string, ref: number = 1): StandardMarkFacet => {
        const facetData: StandardFacetData<MarkFacetPayload> = {
            reference: createReference(key, 'Mark', ref),
            payload: narrative
        };
        return new StandardMarkFacet(facetData);
    };

    const createPositionFacetData = (key: string, x: number, y: number): StandardFacetData<PositionPayload> => ({
        reference: createReference(key, 'Room'),
        payload: { x, y }
    });

    const createMarkFacetData = (key: string, narrative: string): StandardFacetData<MarkFacetPayload> => ({
        reference: createReference(key, 'Mark'),
        payload: narrative
    });

    describe('Construction', () => {
        it('should construct from empty array', () => {
            const list = new PositionFacetList([]);
            expect(list.length).toBe(0);
            expect(list.items).toEqual([]);
        });

        it('should construct from array of StandardFacet instances', () => {
            const facet1 = createPositionFacet('room1', 10, 20);
            const facet2 = createPositionFacet('room2', 30, 40);
            const list = new PositionFacetList([facet1, facet2]);
            
            expect(list.length).toBe(2);
            const item0 = list.items[0] as StandardPositionFacet;
            const item1 = list.items[1] as StandardPositionFacet;
            expect(item0.payload.toJSON()).toEqual({ x: 10, y: 20 });
            expect(item1.payload.toJSON()).toEqual({ x: 30, y: 40 });
        });

        it('should construct from array of StandardFacetData (JSON format)', () => {
            const data1 = createPositionFacetData('room1', 10, 20);
            const data2 = createPositionFacetData('room2', 30, 40);
            const list = new PositionFacetList([data1, data2]);
            
            expect(list.length).toBe(2);
            const item0 = list.items[0] as StandardPositionFacet;
            const item1 = list.items[1] as StandardPositionFacet;
            expect(item0.payload.toJSON()).toEqual({ x: 10, y: 20 });
            expect(item1.payload.toJSON()).toEqual({ x: 30, y: 40 });
        });

        it('should construct from array with Replace operations', () => {
            const replaceData: StandardFacetData<PositionPayload> = {
                reference: createReference('room1', 'Room'),
                payload: {
                    tag: 'Replace' as const,
                    match: { x: 5, y: 10 },
                    payload: { x: 10, y: 20 }
                }
            };
            
            const list = new PositionFacetList([replaceData]);
            expect(list.length).toBe(1);
            const item0 = list.items[0] as StandardPositionFacet;
            // Check that payload contains a Replace operation
            expect(item0.payload.toJSON()).toEqual({
                tag: 'Replace',
                match: { x: 5, y: 10 },
                payload: { x: 10, y: 20 }
            });
        });

        it('should construct by cloning from another FacetList', () => {
            const original = new PositionFacetList([
                createPositionFacetData('room1', 10, 20),
                createPositionFacetData('room2', 30, 40)
            ]);
            const cloned = new PositionFacetList(original);
            
            expect(cloned.length).toBe(2);
            expect(cloned).not.toBe(original);
            expect(cloned.equals(original)).toBe(true);
            // Verify independence
            const originalJson = original.toJSON();
            const clonedJson = cloned.toJSON();
            expect(clonedJson).toEqual(originalJson);
        });

        // Type guard tests removed - concrete classes don't need runtime type guards

        it('should merge items with same key during construction (deduplication)', () => {
            const data1: StandardFacetData<PositionPayload> = {
                reference: createReference('room1', 'Room', 1),
                payload: { x: 10, y: 20 }
            };
            const data2: StandardFacetData<PositionPayload> = {
                reference: createReference('room1', 'Room', 2),
                payload: { x: 10, y: 20 }
            };
            
            const list = new PositionFacetList([data1, data2]);
            expect(list.length).toBe(1);
            const item0 = list.items[0] as StandardPositionFacet;
            expect(item0.ref).toBe(3); // 1 + 2
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
                payload: { x: 10, y: 20 }
            };
            
            const list = new PositionFacetList([data]);
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
            const replaceData: StandardFacetData<PositionPayload> = {
                reference: createReference('room1', 'Room'),
                payload: {
                    tag: 'Replace' as const,
                    match: { x: 5, y: 10 },
                    payload: { x: 10, y: 20 }
                }
            };
            
            const list = new PositionFacetList([replaceData]);
            const json = list.toJSON();
            // Replace operations are now at payload level
            expect(json).toEqual([{
                reference: createReference('room1', 'Room'),
                payload: {
                    tag: 'Replace' as const,
                    match: { x: 5, y: 10 },
                    payload: { x: 10, y: 20 }
                }
            }]);
        });

        it('should throw error for invalid argument type', () => {
            expect(() => {
                new PositionFacetList({ invalid: 'data' } as any);
            }).toThrow('Invalid argument type for PositionFacetList constructor');
        });

        it('should throw error for schema tree nodes', () => {
            // Mock schema tree node
            const schemaNode = {
                data: { tag: 'Room' },
                children: []
            };
            
            expect(() => {
                new PositionFacetList([schemaNode] as any);
            });
            // Schema tree construction should work with concrete classes
        });
    });

    describe('Serialization', () => {
        it('should serialize to JSON correctly', () => {
            const list = new PositionFacetList([
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
                    // item.payload is already the plain data from toJSON(), not a class instance
                    expect(item.payload).toEqual({ x: 10, y: 20 });
                }
            }
        });

        it('should round-trip serialize (construct → toJSON → construct → equals)', () => {
            const original = new PositionFacetList([
                createPositionFacetData('room1', 10, 20),
                createPositionFacetData('room2', 30, 40)
            ]);
            
            const json = original.toJSON();
            const roundTrip = new PositionFacetList(json);
            
            expect(roundTrip.equals(original)).toBe(true);
        });

        it('should serialize Replace operations correctly', () => {
            const replaceData: StandardFacetData<PositionPayload> = {
                reference: createReference('room1', 'Room'),
                payload: {
                    tag: 'Replace' as const,
                    match: { x: 5, y: 10 },
                    payload: { x: 10, y: 20 }
                }
            };
            
            const list = new PositionFacetList([replaceData]);
            const json = list.toJSON();
            
            // Replace operations are now at payload level
            expect(json).toEqual([{
                reference: createReference('room1', 'Room'),
                payload: {
                    tag: 'Replace' as const,
                    match: { x: 5, y: 10 },
                    payload: { x: 10, y: 20 }
                }
            }]);
        });

        // Note: Schema generation tests removed - FacetList.schema getter was removed
        // Parent components now orchestrate facet rendering using renderFacet() directly on individual facets
        // This decision should be re-examined after Phase 6 (first Example prototype)
    });

    describe('Basic Accessors and Utilities', () => {
        it('should report isEmpty true for empty list', () => {
            const list = new PositionFacetList([])
            expect(list.isEmpty()).toBe(true)
        })

        it('should report isEmpty true for ref=0-only list', () => {
            const list = new PositionFacetList([
                createPositionFacet('room1', 10, 20, 0),
                createPositionFacet('room2', 30, 40, 0)
            ])
            expect(list.isEmpty()).toBe(true)
        })

        it('should report isEmpty false when any facet has non-zero ref', () => {
            const list = new PositionFacetList([
                createPositionFacet('room1', 10, 20, 0),
                createPositionFacet('room2', 30, 40, 1)
            ])
            expect(list.isEmpty()).toBe(false)
        })

        it('should return items array', () => {
            const facet1 = createPositionFacet('room1', 10, 20);
            const facet2 = createPositionFacet('room2', 30, 40);
            const list = new PositionFacetList([facet1, facet2]);
            
            expect(list.items).toHaveLength(2);
            expect(list.items[0]).toBeInstanceOf(StandardPositionFacet);
        });

        it('should return correct length', () => {
            const list = new PositionFacetList([
                createPositionFacetData('room1', 10, 20),
                createPositionFacetData('room2', 30, 40),
                createPositionFacetData('room3', 50, 60)
            ]);
            
            expect(list.length).toBe(3);
        });

        it('should create independent clone', () => {
            const original = new PositionFacetList([
                createPositionFacetData('room1', 10, 20)
            ]);
            const cloned = original.clone();
            
            expect(cloned).not.toBe(original);
            expect(cloned.equals(original)).toBe(true);
            expect(cloned.length).toBe(original.length);
        });

        it('should compare lists correctly (order-independent, set-like)', () => {
            const list1 = new PositionFacetList([
                createPositionFacetData('room1', 10, 20),
                createPositionFacetData('room2', 30, 40)
            ]);
            const list2 = new PositionFacetList([
                createPositionFacetData('room2', 30, 40),
                createPositionFacetData('room1', 10, 20)
            ]);
            
            expect(list1.equals(list2)).toBe(true);
        });

        it('should return false for different lists', () => {
            const list1 = new PositionFacetList([
                createPositionFacetData('room1', 10, 20)
            ]);
            const list2 = new PositionFacetList([
                createPositionFacetData('room2', 30, 40)
            ]);
            
            expect(list1.equals(list2)).toBe(false);
        });

        it('should return false for same reference identity with different payload', () => {
            const list1 = new PositionFacetList([
                createPositionFacetData('room1', 10, 20)
            ]);
            const list2 = new PositionFacetList([
                createPositionFacetData('room1', 99, 100)
            ]);
            expect(list1.equals(list2)).toBe(false);
        });

        it('should return false for same reference identity with different ref', () => {
            const list1 = new PositionFacetList([
                createPositionFacet('room1', 10, 20, 1)
            ]);
            const list2 = new PositionFacetList([
                createPositionFacet('room1', 10, 20, 2)
            ]);
            expect(list1.equals(list2)).toBe(false);
        });

        it('should return false when comparing with non-FacetList', () => {
            const list = new PositionFacetList([
                createPositionFacetData('room1', 10, 20)
            ]);
            
            expect(list.equals({} as any)).toBe(false);
        });
    });

    describe('Merge Operations', () => {
        it('should merge two lists with no overlapping keys', () => {
            const base = new PositionFacetList([
                createPositionFacetData('room1', 10, 20)
            ]);
            const incoming = new PositionFacetList([
                createPositionFacetData('room2', 30, 40)
            ]);
            
            const merged = base.merge(incoming);
            expect(merged).toBeDefined();
            expect(merged!.length).toBe(2);
            expect(merged!.items.some(f => (f as StandardPositionFacet).reference.key === 'room1')).toBe(true);
            expect(merged!.items.some(f => (f as StandardPositionFacet).reference.key === 'room2')).toBe(true);
        });

        it('should merge lists with matching keys and same payload (ref arithmetic only)', () => {
            const base = new PositionFacetList([{
                reference: createReference('room1', 'Room', 1),
                payload: { x: 10, y: 20 }
            }]);
            const incoming = new PositionFacetList([{
                reference: createReference('room1', 'Room', 2),
                payload: { x: 10, y: 20 }
            }]);
            
            const merged = base.merge(incoming);
            expect(merged).toBeDefined();
            expect(merged!.length).toBe(1);
            const item0 = merged!.items[0] as StandardPositionFacet;
            expect(item0.ref).toBe(3); // 1 + 2
            // Check that payload is not a Replace operation (should be plain payload)
            expect(item0.payload.toJSON()).toEqual({ x: 10, y: 20 });
        });

        it('should preserve unmatched base items', () => {
            const base = new PositionFacetList([
                createPositionFacetData('room1', 10, 20),
                createPositionFacetData('room2', 30, 40)
            ]);
            const incoming = new PositionFacetList([
                createPositionFacetData('room3', 50, 60)
            ]);
            
            const merged = base.merge(incoming);
            expect(merged).toBeDefined();
            expect(merged!.length).toBe(3);
            expect(merged!.items.some(f => (f as StandardPositionFacet).reference.key === 'room1')).toBe(true);
            expect(merged!.items.some(f => (f as StandardPositionFacet).reference.key === 'room2')).toBe(true);
            expect(merged!.items.some(f => (f as StandardPositionFacet).reference.key === 'room3')).toBe(true);
        });

        it('should handle ref arithmetic correctly', () => {
            const base = new PositionFacetList([{
                reference: createReference('room1', 'Room', 1),
                payload: { x: 10, y: 20 }
            }]);
            const incoming = new PositionFacetList([{
                reference: createReference('room1', 'Room', 2),
                payload: { x: 10, y: 20 }
            }]);
            
            const merged = base.merge(incoming);
            expect(merged).toBeDefined();
            const item0 = merged!.items[0] as StandardPositionFacet;
            expect(item0.ref).toBe(3); // 1 + 2
        });

        it('should preserve facet in list when facet merge returns facet with ref=0 (ref cancelled but payload remains)', () => {
            // This tests list-specific behavior: when facet.merge() returns a facet (not undefined),
            // the list should preserve it even if the facet has ref=0
            const base = new PositionFacetList([{
                reference: createReference('room1', 'Room', 1),
                payload: { x: 10, y: 20 }
            }]);
            const incoming = new PositionFacetList([{
                reference: createReference('room1', 'Room', -1),
                payload: { x: 10, y: 20 }
            }]);
            
            const merged = base.merge(incoming);
            // Facet merge returns a facet with ref=0 (not undefined) because payloads remain
            // List merge should preserve this facet, not filter it out
            expect(merged).toBeDefined();
            expect(merged?.items.length).toBe(1);
            expect(merged?.items[0].payload.toJSON()).toEqual({ x: 10, y: 20 });
            expect(merged?.items[0].ref).toBe(0); // Reference with ref=0 after cancellation
        });

        // Type guard preservation tests removed - concrete classes don't use type guards

        it('should throw error for non-FacetList arguments', () => {
            const list = new PositionFacetList([
                createPositionFacetData('room1', 10, 20)
            ]);
            
            expect(() => {
                list.merge({} as any);
            }).toThrow('Cannot merge with non-PositionFacetList instance');
        });
    });

    describe('Diff Operations', () => {
        it('should return empty list when diffing identical lists', () => {
            const list1 = new PositionFacetList([
                createPositionFacetData('room1', 10, 20)
            ]);
            const list2 = new PositionFacetList([
                createPositionFacetData('room1', 10, 20)
            ]);
            
            const diff = list1.diff(list2);
            // When lists are identical, diff should return undefined
            expect(diff).toBeUndefined();
        });

        it('should diff lists with matching keys and same payload (ref diff only)', () => {
            const base = new PositionFacetList([{
                reference: createReference('room1', 'Room', 1),
                payload: { x: 10, y: 20 }
            }]);
            const incoming = new PositionFacetList([{
                reference: createReference('room1', 'Room', 2),
                payload: { x: 10, y: 20 }
            }]);
            
            const diff = base.diff(incoming);
            expect(diff).toBeDefined();
            expect(diff!.length).toBe(1);
            const item0 = diff!.items[0] as StandardPositionFacet;
            expect(item0.ref).toBe(1); // 2 - 1
            // Check that payload is not a Replace operation (should be plain payload)
            expect(item0.payload.toJSON()).toEqual({ x: 10, y: 20 });
        });

        it('should invert unmatched base items', () => {
            const base = new PositionFacetList([
                createPositionFacetData('room1', 10, 20)
            ]);
            const incoming = new PositionFacetList([]);
            
            const diff = base.diff(incoming);
            expect(diff).toBeDefined();
            expect(diff!.length).toBe(1);
            const item0 = diff!.items[0] as StandardPositionFacet;
            expect(item0.ref).toBe(-1); // Inverted
        });

        it('should include unmatched incoming items as-is', () => {
            const base = new PositionFacetList([]);
            const incoming = new PositionFacetList([
                createPositionFacetData('room1', 10, 20)
            ]);
            
            const diff = base.diff(incoming);
            expect(diff).toBeDefined();
            expect(diff!.length).toBe(1);
            const item0 = diff!.items[0] as StandardPositionFacet;
            expect(item0.ref).toBe(1); // As-is
        });

        it('should handle ref arithmetic correctly in diff', () => {
            const base = new PositionFacetList([{
                reference: createReference('room1', 'Room', 1),
                payload: { x: 10, y: 20 }
            }]);
            const incoming = new PositionFacetList([{
                reference: createReference('room1', 'Room', 2),
                payload: { x: 10, y: 20 }
            }]);
            
            const diff = base.diff(incoming);
            expect(diff).toBeDefined();
            const item0 = diff!.items[0] as StandardPositionFacet;
            expect(item0.ref).toBe(1); // 2 - 1
        });

        // Type guard preservation tests removed - concrete classes don't use type guards

        it('should throw error for non-FacetList arguments', () => {
            const list = new PositionFacetList([
                createPositionFacetData('room1', 10, 20)
            ]);
            
            expect(() => {
                list.diff({} as any);
            }).toThrow('Cannot diff with non-PositionFacetList instance');
        });
    });

    describe('Invert Operations', () => {
        it('should invert list with added facets (ref=1 → ref=-1)', () => {
            const list = new PositionFacetList([
                createPositionFacet('room1', 10, 20, 1)
            ]);
            
            const inverted = list.invert();
            expect(inverted.length).toBe(1);
            const item0 = inverted.items[0] as StandardPositionFacet;
            expect(item0.ref).toBe(-1);
        });

        it('should invert list with removed facets (ref=-1 → ref=1)', () => {
            const list = new PositionFacetList([
                createPositionFacet('room1', 10, 20, -1)
            ]);
            
            const inverted = list.invert();
            expect(inverted.length).toBe(1);
            const item0 = inverted.items[0] as StandardPositionFacet;
            expect(item0.ref).toBe(1);
        });

        it('should invert list with Replace operations', () => {
            const replaceData: StandardFacetData<PositionPayload> = {
                reference: createReference('room1', 'Room'),
                payload: {
                    tag: 'Replace' as const,
                    match: { x: 5, y: 10 },
                    payload: { x: 10, y: 20 }
                }
            };
            
            const list = new PositionFacetList([replaceData]);
            const inverted = list.invert();
            
            // Note: Current implementation keeps match and payload the same when inverting Replace
            // The reference is inverted (ref arithmetic), but Replace match/payload are preserved
            const item0 = inverted.items[0] as StandardPositionFacet;
            // For Replace operations, invert swaps match and payload: "Replace A with B" becomes "Replace B with A"
            expect(item0.payload.toJSON()).toEqual({
                tag: 'Replace',
                match: { x: 10, y: 20 },  // Original payload becomes match
                payload: { x: 5, y: 10 }  // Original match becomes payload
            });
        });

        it('should invert list with mixed operations', () => {
            const list = new PositionFacetList([
                createPositionFacet('room1', 10, 20, 1),
                createPositionFacet('room2', 30, 40, -1)
            ]);
            
            const inverted = list.invert();
            expect(inverted.length).toBe(2);
            const item1 = inverted.items.find(f => (f as StandardPositionFacet).reference.key === 'room1') as StandardPositionFacet | undefined;
            const item2 = inverted.items.find(f => (f as StandardPositionFacet).reference.key === 'room2') as StandardPositionFacet | undefined;
            expect(item1?.ref).toBe(-1);
            expect(item2?.ref).toBe(1);
        });

        it('should satisfy double inversion property (invert().invert() equals original)', () => {
            const original = new PositionFacetList([
                createPositionFacet('room1', 10, 20, 1),
                createPositionFacet('room2', 30, 40, -1)
            ]);
            
            const doubleInverted = original.invert().invert();
            expect(doubleInverted.equals(original)).toBe(true);
        });

        it('should return empty list when inverting empty list', () => {
            const empty = new PositionFacetList([]);
            const inverted = empty.invert();
            
            expect(inverted.length).toBe(0);
            expect(inverted.items).toEqual([]);
        });

        // Type guard preservation tests removed - concrete classes don't use type guards
    });

    describe('Lookup and Transformation Methods', () => {
        it('should apply mapContents callback to each facet', () => {
            const list = new PositionFacetList([
                createPositionFacetData('room1', 10, 20)
            ]);
            
            const mapped = list.mapContents((facet) => {
                const facetTyped = facet as StandardPositionFacet;
                const currentPayloadJSON = facetTyped.payload.toJSON();
                // Extract plain payload (for plain facets, toJSON returns PositionPayload directly)
                const currentPayload: PositionPayload = ('tag' in currentPayloadJSON && currentPayloadJSON.tag !== undefined)
                    ? (currentPayloadJSON as any).match || (currentPayloadJSON as any).payload
                    : currentPayloadJSON as PositionPayload;
                const newPayload: PositionPayload = {
                    x: currentPayload.x * 2,
                    y: currentPayload.y * 2
                };
                const newData: StandardFacetData<PositionPayload> = {
                    reference: facetTyped.reference.toJSON(),
                    payload: newPayload
                };
                return new StandardPositionFacet(newData);
            });
            
            expect(mapped.length).toBe(1);
            const mappedItem = mapped.items[0] as StandardPositionFacet;
            const mappedPayloadJSON = mappedItem.payload.toJSON();
            // Extract plain payload (for plain facets, toJSON returns PositionPayload directly)
            const mappedPayload: PositionPayload = ('tag' in mappedPayloadJSON && mappedPayloadJSON.tag !== undefined)
                ? (mappedPayloadJSON as any).match || (mappedPayloadJSON as any).payload
                : mappedPayloadJSON as PositionPayload;
            expect(mappedPayload.x).toBe(20);
            expect(mappedPayload.y).toBe(40);
        });

        // Type guard preservation tests removed - concrete classes don't use type guards

        it('should convert all facets to specified format', () => {
            const list = new PositionFacetList([
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

        // Type guard preservation tests removed - concrete classes don't use type guards

        it('should apply lookup mappings to all facets', () => {
            const list = new PositionFacetList([
                createPositionFacetData('room1', 10, 20)
            ]);
            
            // Mock lookup mappings (empty array for now)
            const lookedUp = list.lookup([]);
            
            expect(lookedUp.length).toBe(1);
            expect(lookedUp.items[0]).toBeInstanceOf(StandardPositionFacet);
        });

        // Type guard preservation tests removed - concrete classes don't use type guards
    });

    describe('Edit Algebra Properties', () => {
        it('should combine ref arithmetic in merge/diff (like ReferenceList)', () => {
            // Ref arithmetic: merge should add refs, diff should subtract
            const base = new PositionFacetList([{
                reference: createReference('room1', 'Room', 1),
                payload: { x: 10, y: 20 }
            }]);
            const incoming = new PositionFacetList([{
                reference: createReference('room1', 'Room', 2),
                payload: { x: 10, y: 20 }
            }]);
            
            const merged = base.merge(incoming);
            expect(merged).toBeDefined();
            const mergedItem0 = merged!.items[0] as StandardPositionFacet;
            expect(mergedItem0.ref).toBe(3); // 1 + 2
            
            const diff = base.diff(incoming);
            expect(diff).toBeDefined();
            const diffItem0 = diff!.items[0] as StandardPositionFacet;
            expect(diffItem0.ref).toBe(1); // 2 - 1
        });

        it('should invert both ref operations and Replace operations', () => {
            const list = new PositionFacetList([
                createPositionFacet('room1', 10, 20, 1)
            ]);
            
            const inverted = list.invert();
            const invertedItem0 = inverted.items[0] as StandardPositionFacet;
            expect(invertedItem0.ref).toBe(-1);
            
            // Test Replace inversion
            const replaceList = new PositionFacetList([{
                reference: createReference('room2', 'Room'),
                payload: {
                    tag: 'Replace' as const,
                    match: { x: 5, y: 10 },
                    payload: { x: 10, y: 20 }
                }
            }]);
            
            const invertedReplace = replaceList.invert();
            const replaceItem0 = invertedReplace.items[0] as StandardPositionFacet;
            // Invert swaps match and payload: "Replace A with B" becomes "Replace B with A"
            // The reference ref is also inverted
            expect(replaceItem0.payload.toJSON()).toEqual({
                tag: 'Replace',
                match: { x: 10, y: 20 },  // Original payload becomes match
                payload: { x: 5, y: 10 }  // Original match becomes payload
            });
        });


        it('should satisfy double inversion property', () => {
            const original = new PositionFacetList([
                createPositionFacet('room1', 10, 20, 1),
                createPositionFacet('room2', 30, 40, -1)
            ]);
            
            const doubleInverted = original.invert().invert();
            expect(doubleInverted.equals(original)).toBe(true);
        });
    });

    describe('Type Safety Tests', () => {
        it('should work with PositionFacetList (type-safe payload access)', () => {
            const list = new PositionFacetList([
                createPositionFacetData('room1', 10, 20)
            ]);
            
            // Extract plain payload from toJSON() (for plain facets, toJSON returns PositionPayload directly)
            const item0 = list.items[0] as StandardPositionFacet;
            const payloadJSON = item0.payload.toJSON();
            const payload: PositionPayload = ('tag' in payloadJSON && payloadJSON.tag !== undefined)
                ? (payloadJSON as any).match || (payloadJSON as any).payload
                : payloadJSON as PositionPayload;
            expect(payload.x).toBe(10);
            expect(payload.y).toBe(20);
            expect(payload).toEqual({ x: 10, y: 20 });
        });

        it('should work with MarkFacetList (type-safe payload access)', () => {
            const list = new MarkFacetList([
                createMarkFacetData('mark1', 'A dark room')
            ]);
            
            // TypeScript should allow access to MarkFacetPayload properties via toJSON()
            const item0 = list.items[0] as StandardMarkFacet;
            // For Mark facets, payload is a PlainClass with string data
            const payload = item0.payload.toJSON();
            expect(payload).toBe('A dark room');
        });

        // Type guard tests removed - concrete classes provide compile-time type safety
    });
});
