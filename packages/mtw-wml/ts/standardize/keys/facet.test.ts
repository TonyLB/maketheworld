import { StandardFacet } from './facet';
import { StandardReference } from './reference';
import { PositionPayload, MarkFacetPayload, ExitPayload, StandardFacetData } from './dataTypes/facet';
import { StandardReferenceData } from './dataTypes/reference';

describe('StandardFacet', () => {
    const validReference: StandardReferenceData = {
        key: 'room1',
        tag: 'Room',
        universalKey: 'ROOM#room1'
    };

    const positionPayload: PositionPayload = {
        type: 'PositionFacet',
        x: 10,
        y: 20
    };

    const markPayload: MarkFacetPayload = {
        type: 'MarkFacet',
        narrative: 'A dark room'
    };

    const exitPayload: ExitPayload = {
        type: 'ExitFacet',
        description: 'A wooden door'
    };

    describe('Construction', () => {
        it('should construct from StandardFacetData with PositionPayload', () => {
            const facetData: StandardFacetData<PositionPayload> = {
                reference: validReference,
                payload: positionPayload
            };
            const facet = new StandardFacet(facetData);
            expect(facet.payload).toEqual(positionPayload);
            expect(facet.reference.key).toBe('room1');
            expect(facet.isReplace).toBe(false);
        });

        it('should construct from StandardFacetData with MarkFacetPayload', () => {
            const facetData: StandardFacetData<MarkFacetPayload> = {
                reference: validReference,
                payload: markPayload
            };
            const facet = new StandardFacet(facetData);
            expect(facet.payload).toEqual(markPayload);
            expect(facet.payload.narrative).toBe('A dark room');
        });

        it('should construct from StandardFacetData with ExitPayload', () => {
            const facetData: StandardFacetData<ExitPayload> = {
                reference: validReference,
                payload: exitPayload
            };
            const facet = new StandardFacet(facetData);
            expect(facet.payload).toEqual(exitPayload);
            expect(facet.payload.description).toBe('A wooden door');
        });

        it('should construct from StandardFacetData with ComponentUUID string reference', () => {
            const facetData: StandardFacetData<PositionPayload> = {
                reference: 'ROOM#room1',
                payload: positionPayload
            };
            const facet = new StandardFacet(facetData);
            expect(facet.universalKey).toBe('ROOM#room1');
            expect(facet.payload).toEqual(positionPayload);
        });

        it('should clone from another StandardFacet', () => {
            const facetData: StandardFacetData<PositionPayload> = {
                reference: validReference,
                payload: positionPayload
            };
            const original = new StandardFacet(facetData);
            const cloned = new StandardFacet(original);
            expect(cloned.payload).toEqual(original.payload);
            expect(cloned.reference.key).toBe(original.reference.key);
            expect(cloned).not.toBe(original);
        });

        it('should construct from Replace JSON structure', () => {
            const matchData: StandardFacetData<PositionPayload> = {
                reference: validReference,
                payload: { type: 'PositionFacet', x: 5, y: 10 }
            };
            const payloadData: StandardFacetData<PositionPayload> = {
                reference: validReference,
                payload: positionPayload
            };
            const replaceData = {
                tag: 'Replace' as const,
                match: matchData,
                payload: payloadData
            };
            const facet = new StandardFacet(replaceData);
            expect(facet.isReplace).toBe(true);
            expect(facet.payload).toEqual(positionPayload);
            expect(facet.matchPayload).toEqual({ type: 'PositionFacet', x: 5, y: 10 });
        });

        it('should throw error for invalid argument', () => {
            expect(() => {
                new StandardFacet({ invalid: 'data' } as any);
            }).toThrow('Invalid argument to StandardFacet constructor');
        });
    });

    describe('Serialization', () => {
        it('should serialize plain facet to JSON', () => {
            const facetData: StandardFacetData<PositionPayload> = {
                reference: validReference,
                payload: positionPayload
            };
            const facet = new StandardFacet(facetData);
            const json = facet.toJSON();
            expect(json).toEqual(facetData);
            expect('tag' in json).toBe(false);
        });

        it('should serialize Replace facet to JSON', () => {
            const matchData: StandardFacetData<PositionPayload> = {
                reference: validReference,
                payload: { type: 'PositionFacet', x: 5, y: 10 }
            };
            const payloadData: StandardFacetData<PositionPayload> = {
                reference: validReference,
                payload: positionPayload
            };
            const replaceData = {
                tag: 'Replace' as const,
                match: matchData,
                payload: payloadData
            };
            const facet = new StandardFacet(replaceData);
            const json = facet.toJSON();
            expect('tag' in json && json.tag === 'Replace').toBe(true);
            if ('tag' in json && json.tag === 'Replace') {
                expect(json.match).toEqual(matchData);
                expect(json.payload).toEqual(payloadData);
            }
        });

        it('should round-trip serialize plain facet', () => {
            const facetData: StandardFacetData<PositionPayload> = {
                reference: validReference,
                payload: positionPayload
            };
            const facet = new StandardFacet(facetData);
            const json = facet.toJSON();
            const roundTrip = new StandardFacet(json as StandardFacetData<PositionPayload>);
            expect(roundTrip.payload).toEqual(facet.payload);
            expect(roundTrip.reference.key).toBe(facet.reference.key);
        });
    });

    describe('Equality and matching', () => {
        it('should return true for equal facets', () => {
            const facetData: StandardFacetData<PositionPayload> = {
                reference: validReference,
                payload: positionPayload
            };
            const facet1 = new StandardFacet(facetData);
            const facet2 = new StandardFacet(facetData);
            expect(facet1.equals(facet2)).toBe(true);
        });

        it('should return false for facets with different payloads', () => {
            const facetData1: StandardFacetData<PositionPayload> = {
                reference: validReference,
                payload: positionPayload
            };
            const facetData2: StandardFacetData<PositionPayload> = {
                reference: validReference,
                payload: { type: 'PositionFacet', x: 15, y: 25 }
            };
            const facet1 = new StandardFacet(facetData1);
            const facet2 = new StandardFacet(facetData2);
            expect(facet1.equals(facet2)).toBe(false);
        });

        it('should return true for sameKey with same target component', () => {
            const facetData1: StandardFacetData<PositionPayload> = {
                reference: validReference,
                payload: positionPayload
            };
            const facetData2: StandardFacetData<PositionPayload> = {
                reference: { ...validReference, ref: 2 },
                payload: { type: 'PositionFacet', x: 15, y: 25 }
            };
            const facet1 = new StandardFacet(facetData1);
            const facet2 = new StandardFacet(facetData2);
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
            const facet1 = new StandardFacet(facetData1);
            const facet2 = new StandardFacet(facetData2);
            expect(facet1.sameKey(facet2)).toBe(false);
        });
    });

    describe('Reference access', () => {
        it('should provide access to composed reference', () => {
            const facetData: StandardFacetData<PositionPayload> = {
                reference: validReference,
                payload: positionPayload
            };
            const facet = new StandardFacet(facetData);
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
            const facet1 = new StandardFacet(facetData1);
            const facet2 = new StandardFacet(facetData2);
            const merged = facet1.merge(facet2);
            expect(merged).toBeDefined();
            expect(merged!.ref).toBe(3); // 1 + 2
            expect(merged!.payload).toEqual(positionPayload);
            expect(merged!.isReplace).toBe(false);
        });

        it('should merge facets with same key and different payload (Replace operation)', () => {
            const facetData1: StandardFacetData<PositionPayload> = {
                reference: validReference,
                payload: { type: 'PositionFacet', x: 5, y: 10 }
            };
            const facetData2: StandardFacetData<PositionPayload> = {
                reference: validReference,
                payload: positionPayload
            };
            const facet1 = new StandardFacet(facetData1);
            const facet2 = new StandardFacet(facetData2);
            const merged = facet1.merge(facet2);
            expect(merged).toBeDefined();
            expect(merged!.isReplace).toBe(true);
            expect(merged!.payload).toEqual(positionPayload);
            expect(merged!.matchPayload).toEqual({ type: 'PositionFacet', x: 5, y: 10 });
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
            const facet1 = new StandardFacet(facetData1);
            const facet2 = new StandardFacet(facetData2);
            expect(() => {
                facet1.merge(facet2);
            }).toThrow('Cannot change which component a facet points to');
        });

        it('should return undefined when merge cancels out (ref arithmetic)', () => {
            const facetData1: StandardFacetData<PositionPayload> = {
                reference: { ...validReference, ref: 1 },
                payload: positionPayload
            };
            const facetData2: StandardFacetData<PositionPayload> = {
                reference: { ...validReference, ref: -1 },
                payload: positionPayload
            };
            const facet1 = new StandardFacet(facetData1);
            const facet2 = new StandardFacet(facetData2);
            const merged = facet1.merge(facet2);
            expect(merged).toBeUndefined();
        });

        it('should create Replace when ref cancels but payloads differ', () => {
            const facetData1: StandardFacetData<PositionPayload> = {
                reference: { ...validReference, ref: 1 },
                payload: { type: 'PositionFacet', x: 5, y: 10 }
            };
            const facetData2: StandardFacetData<PositionPayload> = {
                reference: { ...validReference, ref: -1 },
                payload: positionPayload
            };
            const facet1 = new StandardFacet(facetData1);
            const facet2 = new StandardFacet(facetData2);
            const merged = facet1.merge(facet2);
            expect(merged).toBeDefined();
            expect(merged!.isReplace).toBe(true);
            expect(merged!.payload).toEqual(positionPayload);
            expect(merged!.matchPayload).toEqual({ type: 'PositionFacet', x: 5, y: 10 });
        });
    });

    describe('Diff operations', () => {
        it('should return undefined when facets are identical', () => {
            const facetData: StandardFacetData<PositionPayload> = {
                reference: validReference,
                payload: positionPayload
            };
            const facet1 = new StandardFacet(facetData);
            const facet2 = new StandardFacet(facetData);
            const diff = facet1.diff(facet2);
            expect(diff).toBeUndefined();
        });

        it('should return Replace operation when payloads differ', () => {
            const facetData1: StandardFacetData<PositionPayload> = {
                reference: validReference,
                payload: { type: 'PositionFacet', x: 5, y: 10 }
            };
            const facetData2: StandardFacetData<PositionPayload> = {
                reference: validReference,
                payload: positionPayload
            };
            const facet1 = new StandardFacet(facetData1);
            const facet2 = new StandardFacet(facetData2);
            const diff = facet1.diff(facet2);
            expect(diff).toBeDefined();
            expect(diff!.isReplace).toBe(true);
            expect(diff!.payload).toEqual(positionPayload);
            expect(diff!.matchPayload).toEqual({ type: 'PositionFacet', x: 5, y: 10 });
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
            const facet1 = new StandardFacet(facetData1);
            const facet2 = new StandardFacet(facetData2);
            const diff = facet1.diff(facet2);
            expect(diff).toBeDefined();
            expect(diff!.ref).toBe(1); // 2 - 1
            expect(diff!.payload).toEqual(positionPayload);
            expect(diff!.isReplace).toBe(false);
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
            const facet1 = new StandardFacet(facetData1);
            const facet2 = new StandardFacet(facetData2);
            expect(() => {
                facet1.diff(facet2);
            }).toThrow('Cannot change which component a facet points to');
        });

        it('should invert when diffing from facet to nothing', () => {
            const facetData: StandardFacetData<PositionPayload> = {
                reference: validReference,
                payload: positionPayload
            };
            const facet = new StandardFacet(facetData);
            const diff = facet.diff(undefined);
            expect(diff).toBeDefined();
            expect(diff!.ref).toBe(-1); // Inverted
            expect(diff!.payload).toEqual(positionPayload);
        });
    });

    describe('Schema generation', () => {
        it('should generate schema for plain facet', () => {
            const facetData: StandardFacetData<PositionPayload> = {
                reference: validReference,
                payload: positionPayload
            };
            const facet = new StandardFacet(facetData);
            const schema = facet.schema;
            expect(schema).toBeDefined();
            expect(Array.isArray(schema)).toBe(true);
        });

        it('should generate Replace schema for Replace facet', () => {
            const matchData: StandardFacetData<PositionPayload> = {
                reference: validReference,
                payload: { type: 'PositionFacet', x: 5, y: 10 }
            };
            const payloadData: StandardFacetData<PositionPayload> = {
                reference: validReference,
                payload: positionPayload
            };
            const replaceData = {
                tag: 'Replace' as const,
                match: matchData,
                payload: payloadData
            };
            const facet = new StandardFacet(replaceData);
            const schema = facet.schema;
            expect(schema).toBeDefined();
            expect(schema[0].data.tag).toBe('Replace');
            expect(schema[0].children.length).toBe(2);
        });

        it('should generate nested schema', () => {
            const facetData: StandardFacetData<PositionPayload> = {
                reference: validReference,
                payload: positionPayload
            };
            const facet = new StandardFacet(facetData);
            const nested = facet.nestedSchema({ tag: 'Example' });
            expect(nested).toBeDefined();
            expect(nested[0].data.tag).toBe('Example');
        });
    });

    describe('Format conversion', () => {
        it('should convert to format', () => {
            const facetData: StandardFacetData<PositionPayload> = {
                reference: validReference,
                payload: positionPayload
            };
            const facet = new StandardFacet(facetData);
            const formatted = facet.toFormat('key');
            expect(formatted).toBeInstanceOf(StandardFacet);
            expect(formatted.payload).toEqual(positionPayload);
        });

        it('should lookup keys via mappings', () => {
            const facetData: StandardFacetData<PositionPayload> = {
                reference: validReference,
                payload: positionPayload
            };
            const facet = new StandardFacet(facetData);
            const lookedUp = facet.lookup([]);
            expect(lookedUp).toBeInstanceOf(StandardFacet);
            expect(lookedUp.payload).toEqual(positionPayload);
        });
    });

    describe('Clone', () => {
        it('should create independent clone', () => {
            const facetData: StandardFacetData<PositionPayload> = {
                reference: validReference,
                payload: positionPayload
            };
            const facet = new StandardFacet(facetData);
            const cloned = facet.clone();
            expect(cloned).not.toBe(facet);
            expect(cloned.payload).toEqual(facet.payload);
            expect(cloned.reference.key).toBe(facet.reference.key);
        });
    });
});
