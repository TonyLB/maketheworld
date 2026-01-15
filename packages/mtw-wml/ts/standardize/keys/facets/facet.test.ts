import { StandardReference } from '../reference';
import { PositionPayload, MarkFacetPayload, ExitPayload, StandardFacetData } from './dataTypes/facet';
import { StandardReferenceData } from '../dataTypes/reference';
import { StandardPositionFacet, PositionFacetReplaceClass } from './position';
import { StandardMarkFacet } from './mark';
import { StandardExitFacet } from './exit';

describe('StandardFacet (concrete classes)', () => {
    const validReference: StandardReferenceData = {
        key: 'room1',
        tag: 'Room',
        universalKey: 'ROOM#room1'
    };

    const positionPayload: PositionPayload = {
        x: 10,
        y: 20
    };

    const markPayload: MarkFacetPayload = 'A dark room';

    const exitPayload: ExitPayload = 'A wooden door';

    describe('Construction', () => {
        it('should construct from StandardFacetData with PositionPayload', () => {
            const facetData: StandardFacetData<PositionPayload> = {
                reference: validReference,
                payload: positionPayload
            };
            const facet = new StandardPositionFacet(facetData);
            // Payload is now a class instance, use toJSON() for comparison
            expect(facet.payload.toJSON()).toEqual({ x: 10, y: 20 });
            expect(facet.reference.key).toBe('room1');
            expect(facet.payload instanceof PositionFacetReplaceClass).toBe(false);
        });

        it('should construct from StandardFacetData with MarkFacetPayload', () => {
            const facetData: StandardFacetData<MarkFacetPayload> = {
                reference: validReference,
                payload: markPayload
            };
            const facet = new StandardMarkFacet(facetData);
            // Payload is now a class instance, use toJSON() for comparison
            expect(facet.payload.toJSON()).toBe('A dark room');
            // For Mark facets, payload is a PlainClass - no direct property access
            expect(facet.payload.toJSON()).toBe('A dark room');
        });

        it('should construct from StandardFacetData with ExitPayload', () => {
            const facetData: StandardFacetData<ExitPayload> = {
                reference: validReference,
                payload: exitPayload
            };
            const facet = new StandardExitFacet(facetData);
            // Payload is now a class instance, use toJSON() for comparison
            expect(facet.payload.toJSON()).toBe('A wooden door');
            // For ExitPayload (string), description is the payload itself
            expect(facet.payload.toJSON()).toBe('A wooden door');
        });

        it('should construct from StandardFacetData with ComponentUUID string reference', () => {
            const facetData: StandardFacetData<PositionPayload> = {
                reference: 'ROOM#room1',
                payload: positionPayload
            };
            const facet = new StandardPositionFacet(facetData);
            expect(facet.universalKey).toBe('ROOM#room1');
            // Payload is now a class instance, use toJSON() for comparison
            expect(facet.payload.toJSON()).toEqual({ x: 10, y: 20 });
        });

        it('should clone from another StandardFacet', () => {
            const facetData: StandardFacetData<PositionPayload> = {
                reference: validReference,
                payload: positionPayload
            };
            const original = new StandardPositionFacet(facetData);
            const cloned = new StandardPositionFacet(original);
            // Payload is now a class instance, use toJSON() for comparison
            expect(cloned.payload.toJSON()).toEqual(original.payload.toJSON());
            expect(cloned.reference.key).toBe(original.reference.key);
            expect(cloned).not.toBe(original);
        });

        it('should construct from Replace JSON structure', () => {
            const replaceData: StandardFacetData<PositionPayload> = {
                reference: validReference,
                payload: {
                    tag: 'Replace' as const,
                    match: { x: 5, y: 10 },
                    payload: positionPayload
                }
            };
            const facet = new StandardPositionFacet(replaceData);
            expect(facet.payload instanceof PositionFacetReplaceClass).toBe(true);
            // Payload is now a class instance, use toJSON() for comparison
            // For Replace operations, payload is a ReplaceClass
            const replaceInstance = facet.payload as any;
            expect(replaceInstance.payload?.toJSON()).toEqual({ x: 10, y: 20 });
            expect(replaceInstance.match?.toJSON()).toEqual({ x: 5, y: 10 });
        });

        it('should throw error for invalid argument', () => {
            expect(() => {
                new StandardPositionFacet({ invalid: 'data' } as any);
            }).toThrow('Invalid argument to PositionFacet constructor');
        });
    });

    describe('Serialization', () => {
        it('should serialize plain facet to JSON', () => {
            const facetData: StandardFacetData<PositionPayload> = {
                reference: validReference,
                payload: positionPayload
            };
            const facet = new StandardPositionFacet(facetData);
            const json = facet.toJSON();
            expect(json).toEqual(facetData);
            expect('tag' in json).toBe(false);
        });

        it('should serialize Replace facet to JSON', () => {
            const replaceData: StandardFacetData<PositionPayload> = {
                reference: validReference,
                payload: {
                    tag: 'Replace' as const,
                    match: { x: 5, y: 10 },
                    payload: positionPayload
                }
            };
            const facet = new StandardPositionFacet(replaceData);
            const json = facet.toJSON();
            // Replace operations are at payload level
            expect(json).toEqual({
                reference: validReference,
                payload: {
                    tag: 'Replace' as const,
                    match: { x: 5, y: 10 },
                    payload: positionPayload
                }
            });
        });

        it('should round-trip serialize plain facet', () => {
            const facetData: StandardFacetData<PositionPayload> = {
                reference: validReference,
                payload: positionPayload
            };
            const facet = new StandardPositionFacet(facetData);
            const json = facet.toJSON();
            const roundTrip = new StandardPositionFacet(json as StandardFacetData<PositionPayload>);
            // Payload is now a class instance, use toJSON() for comparison
            expect(roundTrip.payload.toJSON()).toEqual(facet.payload.toJSON());
            expect(roundTrip.reference.key).toBe(facet.reference.key);
        });
    });

    describe('Equality and matching', () => {
        it('should return true for equal facets', () => {
            const facetData: StandardFacetData<PositionPayload> = {
                reference: validReference,
                payload: positionPayload
            };
            const facet1 = new StandardPositionFacet(facetData);
            const facet2 = new StandardPositionFacet(facetData);
            expect(facet1.equals(facet2)).toBe(true);
        });

        it('should return false for facets with different payloads', () => {
            const facetData1: StandardFacetData<PositionPayload> = {
                reference: validReference,
                payload: positionPayload
            };
            const facetData2: StandardFacetData<PositionPayload> = {
                reference: validReference,
                payload: { x: 15, y: 25 }
            };
            const facet1 = new StandardPositionFacet(facetData1);
            const facet2 = new StandardPositionFacet(facetData2);
            expect(facet1.equals(facet2)).toBe(false);
        });

        it('should return true for sameKey with same target component', () => {
            const facetData1: StandardFacetData<PositionPayload> = {
                reference: validReference,
                payload: positionPayload
            };
            const facetData2: StandardFacetData<PositionPayload> = {
                reference: { ...validReference, ref: 2 },
                payload: { x: 15, y: 25 }
            };
            const facet1 = new StandardPositionFacet(facetData1);
            const facet2 = new StandardPositionFacet(facetData2);
            expect(facet1.sameKey(facet2)).toBe(true);
        });

        it('should return false for sameKey with different target components', () => {
            const facetData1: StandardFacetData<PositionPayload> = {
                reference: validReference,
                payload: positionPayload
            };
            const facetData2: StandardFacetData<PositionPayload> = {
                reference: { key: 'room2', tag: 'Room', universalKey: 'ROOM#room2', ref: 1 },
                payload: positionPayload
            };
            const facet1 = new StandardPositionFacet(facetData1);
            const facet2 = new StandardPositionFacet(facetData2);
            expect(facet1.sameKey(facet2)).toBe(false);
        });
    });

    describe('Reference access', () => {
        it('should provide access to composed reference', () => {
            const facetData: StandardFacetData<PositionPayload> = {
                reference: validReference,
                payload: positionPayload
            };
            const facet = new StandardPositionFacet(facetData);
            expect(facet.reference).toBeInstanceOf(StandardReference);
            expect(facet.standardKey.key).toBe('room1');
            expect(facet.ref).toBe(1);
            expect(facet.tag).toBe('Room');
            expect(facet.key).toBe('room1');
            expect(facet.universalKey).toBe('ROOM#room1');
        });
    });

    describe('Merge operations', () => {
        it('should merge facets with same key and same payload (ref arithmetic only)', () => {
            const facetData1: StandardFacetData<PositionPayload> = {
                reference: validReference,
                payload: positionPayload
            };
            const facetData2: StandardFacetData<PositionPayload> = {
                reference: { ...validReference, ref: 2 },
                payload: positionPayload
            };
            const facet1 = new StandardPositionFacet(facetData1);
            const facet2 = new StandardPositionFacet(facetData2);
            const merged = facet1.merge(facet2);
            expect(merged).toBeDefined();
            expect(merged!.ref).toBe(3); // 1 + 2
            // Payload is now a class instance, use toJSON() for comparison
            expect(merged!.payload.toJSON()).toEqual({ x: 10, y: 20 });
            expect(merged!.payload instanceof PositionFacetReplaceClass).toBe(false);
        });

        it('should throw error when merging facets with different keys', () => {
            const facetData1: StandardFacetData<PositionPayload> = {
                reference: validReference,
                payload: positionPayload
            };
            const facetData2: StandardFacetData<PositionPayload> = {
                reference: { key: 'room2', tag: 'Room', universalKey: 'ROOM#room2', ref: 1 },
                payload: positionPayload
            };
            const facet1 = new StandardPositionFacet(facetData1);
            const facet2 = new StandardPositionFacet(facetData2);
            expect(() => {
                facet1.merge(facet2);
            }).toThrow('Cannot change which component a facet points to');
        });

        // Merge cancellation behavior (ref cancels out but payload remains) is tested in facetFactory.test.ts
        // since it's generic behavior from facetClassFactory, not specific to StandardPositionFacet
    });

    describe('Diff operations', () => {
        it('should return undefined when facets are identical', () => {
            const facetData: StandardFacetData<PositionPayload> = {
                reference: validReference,
                payload: positionPayload
            };
            const facet1 = new StandardPositionFacet(facetData);
            const facet2 = new StandardPositionFacet(facetData);
            const diff = facet1.diff(facet2);
            expect(diff).toBeUndefined();
        });

        it('should return reference diff when only ref differs', () => {
            const facetData1: StandardFacetData<PositionPayload> = {
                reference: validReference,
                payload: positionPayload
            };
            const facetData2: StandardFacetData<PositionPayload> = {
                reference: { ...validReference, ref: 2 },
                payload: positionPayload
            };
            const facet1 = new StandardPositionFacet(facetData1);
            const facet2 = new StandardPositionFacet(facetData2);
            const diff = facet1.diff(facet2);
            expect(diff).toBeDefined();
            expect(diff!.ref).toBe(1); // 2 - 1
            // Payload is now a class instance, use toJSON() for comparison
            expect(diff!.payload.toJSON()).toEqual(positionPayload);
            expect(diff!.payload instanceof PositionFacetReplaceClass).toBe(false);
        });

        it('should throw error when diffing facets with different keys', () => {
            const facetData1: StandardFacetData<PositionPayload> = {
                reference: validReference,
                payload: positionPayload
            };
            const facetData2: StandardFacetData<PositionPayload> = {
                reference: { key: 'room2', tag: 'Room', universalKey: 'ROOM#room2', ref: 1 },
                payload: positionPayload
            };
            const facet1 = new StandardPositionFacet(facetData1);
            const facet2 = new StandardPositionFacet(facetData2);
            expect(() => {
                facet1.diff(facet2);
            }).toThrow('Cannot change which component a facet points to');
        });

        it('should invert when diffing from facet to nothing', () => {
            const facetData: StandardFacetData<PositionPayload> = {
                reference: validReference,
                payload: positionPayload
            };
            const facet = new StandardPositionFacet(facetData);
            const diff = facet.diff(undefined);
            expect(diff).toBeDefined();
            expect(diff!.ref).toBe(-1); // Inverted
            // Payload is now a class instance, use toJSON() for comparison
            expect(diff!.payload.toJSON()).toEqual(positionPayload);
        });
    });

    describe('Facet rendering (renderFacet)', () => {
        // Note: renderFacet() tests require payload classes to be implemented (Tasks 3-5)
        // For now, these tests are skipped until payload classes are available
        it.skip('should render facet without referenceRender', () => {
            // TODO: Implement when payload classes are available
            // Test that renderFacet() delegates to payload class renderFacet()
            // Test that it returns newNode or aggregatedNode correctly
        });

        it.skip('should render facet with referenceRender', () => {
            // TODO: Implement when payload classes are available
            // Test that renderFacet() uses referenceRender when provided
            // Test that it enhances referenceRender correctly
        });

        it.skip('should handle Replace operations in renderFacet', () => {
            // TODO: Implement when payload classes are available
            // Test that Replace operations wrap match and payload results
            // Test that Replace structure is correctly formatted
        });
    });

    describe('Format conversion', () => {
        it('should convert to format', () => {
            const facetData: StandardFacetData<PositionPayload> = {
                reference: validReference,
                payload: positionPayload
            };
            const facet = new StandardPositionFacet(facetData);
            const formatted = facet.toFormat('key');
            expect(formatted).toBeInstanceOf(StandardPositionFacet);
            // Payload is now a class instance, use toJSON() for comparison
            expect(formatted.payload.toJSON()).toEqual(positionPayload);
        });

        it('should lookup keys via mappings', () => {
            const facetData: StandardFacetData<PositionPayload> = {
                reference: validReference,
                payload: positionPayload
            };
            const facet = new StandardPositionFacet(facetData);
            const lookedUp = facet.lookup([]);
            expect(lookedUp).toBeInstanceOf(StandardPositionFacet);
            // Payload is now a class instance, use toJSON() for comparison
            expect(lookedUp.payload.toJSON()).toEqual(positionPayload);
        });
    });

    describe('Clone', () => {
        it('should create independent clone', () => {
            const facetData: StandardFacetData<PositionPayload> = {
                reference: validReference,
                payload: positionPayload
            };
            const facet = new StandardPositionFacet(facetData);
            const cloned = facet.clone();
            expect(cloned).not.toBe(facet);
            // Payload is now a class instance, use toJSON() for comparison
            expect(cloned.payload.toJSON()).toEqual(facet.payload.toJSON());
            expect(cloned.reference.key).toBe(facet.reference.key);
        });
    });
});
