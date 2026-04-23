import { facetClassFactory } from './facetFactory';
import { 
    createPositionFacetPayload,
    PositionFacetPayload,
} from './position';
import { StandardFacetData, PositionPayload as PositionPayloadType } from './dataTypes/facet';
import { StandardReferenceData } from '../dataTypes/reference';
import { GenericTree, treeNodeTypeguard } from '@tonylb/mtw-base/ts/genericTree';
import { SchemaTag } from '@tonylb/mtw-base/ts/schema';
import { treeFromWML, schemaToWML } from '../../../schema';
import { deIndentWML } from '../../../schema/utils';
import { isSchemaReplace } from '@tonylb/mtw-base/ts/schema/edit';

describe('facetClassFactory', () => {
    const TestFacetClass = facetClassFactory(
        PositionFacetPayload,
        createPositionFacetPayload,
        'TestFacet',
        undefined,
        {
            missingPayloadDefault: () => ({ x: 0, y: 0 })
        }
    );
    
    const validReference: StandardReferenceData = {
        key: 'room1',
        tag: 'Room',
        universalKey: 'ROOM#room1'
    };

    const positionPayload: PositionPayloadType = {
        x: 10,
        y: 20
    };

    describe('Factory function', () => {
        it('should generate a class', () => {
            expect(TestFacetClass).toBeDefined();
            expect(typeof TestFacetClass).toBe('function');
        });

        it('should generate a class that can be instantiated', () => {
            const facetData: StandardFacetData<PositionPayloadType> = {
                reference: validReference,
                payload: positionPayload
            };
            const facet = new TestFacetClass(facetData);
            expect(facet).toBeInstanceOf(TestFacetClass);
        });
    });

    describe('Construction', () => {
        it('should construct from StandardFacetData', () => {
            const facetData: StandardFacetData<PositionPayloadType> = {
                reference: validReference,
                payload: positionPayload
            };
            const facet = new TestFacetClass(facetData);
            expect(facet.payload.toJSON()).toEqual(positionPayload);
            expect(facet.reference.key).toBe('room1');
        });

        it('should construct from Replace JSON structure', () => {
            const replaceData: StandardFacetData<PositionPayloadType> = {
                reference: validReference,
                payload: {
                    tag: 'Replace' as const,
                    match: { x: 5, y: 10 },
                    payload: positionPayload
                }
            };
            const facet = new TestFacetClass(replaceData);
            expect(facet.payload.toJSON()).toEqual({
                tag: 'Replace',
                match: { x: 5, y: 10 },
                payload: positionPayload
            });
        });

        it('should inject default payload when payload key is missing', () => {
            const facet = new TestFacetClass({
                reference: validReference
            } as any);
            expect(facet.payload.toJSON()).toEqual({ x: 0, y: 0 });
        });

        it('should keep strict behavior when payload key exists but is malformed', () => {
            expect(() => new TestFacetClass({
                reference: validReference,
                payload: null
            } as any)).toThrow('Invalid argument in StandardPositionPayloadBase factory');
        });

        it('should clone from another facet instance', () => {
            const facetData: StandardFacetData<PositionPayloadType> = {
                reference: validReference,
                payload: positionPayload
            };
            const original = new TestFacetClass(facetData);
            const cloned = new TestFacetClass(original);
            expect(cloned.payload.toJSON()).toEqual(original.payload.toJSON());
            expect(cloned.reference.key).toBe(original.reference.key);
            expect(cloned).not.toBe(original);
        });
    });

    describe('Getters', () => {
        it('should provide reference accessors', () => {
            const facetData: StandardFacetData<PositionPayloadType> = {
                reference: validReference,
                payload: positionPayload
            };
            const facet = new TestFacetClass(facetData);
            expect(facet.reference.key).toBe('room1');
            expect(facet.standardKey.key).toBe('room1');
            expect(facet.ref).toBe(1);
            expect(facet.tag).toBe('Room');
            expect(facet.key).toBe('room1');
            expect(facet.universalKey).toBe('ROOM#room1');
        });

        it('should provide payload accessors', () => {
            const facetData: StandardFacetData<PositionPayloadType> = {
                reference: validReference,
                payload: positionPayload
            };
            const facet = new TestFacetClass(facetData);
            // For non-Replace operations, payload is a PlainClass
            expect(facet.payload.toJSON()).toEqual({ x: 10, y: 20 });
        });
    });

    describe('_wrap method', () => {
        it('should exist and return the instance', () => {
            const facetData: StandardFacetData<PositionPayloadType> = {
                reference: validReference,
                payload: positionPayload
            };
            const facet = new TestFacetClass(facetData);
            const wrapped = facet._wrap(facet);
            expect(wrapped).toBe(facet);
        });

        it('should be used by clone()', () => {
            const facetData: StandardFacetData<PositionPayloadType> = {
                reference: validReference,
                payload: positionPayload
            };
            const facet = new TestFacetClass(facetData);
            const cloned = facet.clone();
            expect(cloned).toBeInstanceOf(TestFacetClass);
            expect(cloned.payload.toJSON()).toEqual(facet.payload.toJSON());
        });
    });

    describe('toJSON', () => {
        it('should serialize to StandardFacetData', () => {
            const facetData: StandardFacetData<PositionPayloadType> = {
                reference: validReference,
                payload: positionPayload
            };
            const facet = new TestFacetClass(facetData);
            const json = facet.toJSON();
            expect(json).toEqual(facetData);
        });

        it('should serialize Replace operations correctly', () => {
            const replaceData: StandardFacetData<PositionPayloadType> = {
                reference: validReference,
                payload: {
                    tag: 'Replace' as const,
                    match: { x: 5, y: 10 },
                    payload: positionPayload
                }
            };
            const facet = new TestFacetClass(replaceData);
            const json = facet.toJSON();
            expect(json).toEqual({
                reference: validReference,
                payload: {
                    tag: 'Replace' as const,
                    match: { x: 5, y: 10 },
                    payload: positionPayload
                }
            });
        });
    });

    describe('equals and sameKey', () => {
        it('should identify equal facets', () => {
            const facetData: StandardFacetData<PositionPayloadType> = {
                reference: validReference,
                payload: positionPayload
            };
            const facet1 = new TestFacetClass(facetData);
            const facet2 = new TestFacetClass(facetData);
            expect(facet1.equals(facet2)).toBe(true);
        });

        it('should identify different facets', () => {
            const facetData1: StandardFacetData<PositionPayloadType> = {
                reference: validReference,
                payload: positionPayload
            };
            const facetData2: StandardFacetData<PositionPayloadType> = {
                reference: validReference,
                payload: { x: 15, y: 25 }
            };
            const facet1 = new TestFacetClass(facetData1);
            const facet2 = new TestFacetClass(facetData2);
            expect(facet1.equals(facet2)).toBe(false);
        });

        it('should check sameKey correctly', () => {
            const facetData1: StandardFacetData<PositionPayloadType> = {
                reference: validReference,
                payload: positionPayload
            };
            const facetData2: StandardFacetData<PositionPayloadType> = {
                reference: validReference,
                payload: { x: 15, y: 25 }
            };
            const facet1 = new TestFacetClass(facetData1);
            const facet2 = new TestFacetClass(facetData2);
            expect(facet1.sameKey(facet2)).toBe(true);
        });
    });

    describe('merge', () => {
        it('should merge facets with same payload', () => {
            const facetData1: StandardFacetData<PositionPayloadType> = {
                reference: validReference,
                payload: positionPayload
            };
            const facetData2: StandardFacetData<PositionPayloadType> = {
                reference: validReference,
                payload: positionPayload
            };
            const facet1 = new TestFacetClass(facetData1);
            const facet2 = new TestFacetClass(facetData2);
            const merged = facet1.merge(facet2);
            expect(merged).toBeDefined();
            expect(merged?.payload.toJSON()).toEqual(positionPayload);
        });

        it('should return facet with merged payload when references cancel out but payloads remain', () => {
            const facetData1: StandardFacetData<PositionPayloadType> = {
                reference: { ...validReference, ref: 1 },
                payload: positionPayload
            };
            const facetData2: StandardFacetData<PositionPayloadType> = {
                reference: { ...validReference, ref: -1 },
                payload: positionPayload
            };
            const facet1 = new TestFacetClass(facetData1);
            const facet2 = new TestFacetClass(facetData2);
            const merged = facet1.merge(facet2);
            // When ref cancels out but payloads are identical, merge returns a facet with the merged payload
            // (not undefined, because the payload merge doesn't return undefined for identical payloads)
            expect(merged).toBeDefined();
            expect(merged?.payload.toJSON()).toEqual(positionPayload);
            expect(merged?.ref).toBe(0); // Reference with ref=0 after cancellation
        });

        it('should merge default-injected missing-payload facet with explicit equivalent payload', () => {
            const fromMissingPayload = new TestFacetClass({
                reference: validReference
            } as any);
            const explicitPayloadFacet = new TestFacetClass({
                reference: validReference,
                payload: { x: 0, y: 0 }
            });
            const merged = fromMissingPayload.merge(explicitPayloadFacet);
            expect(merged).toBeDefined();
            expect(merged?.payload.toJSON()).toEqual({ x: 0, y: 0 });
        });
    });

    describe('diff', () => {
        it('should return undefined when facets are identical', () => {
            const facetData: StandardFacetData<PositionPayloadType> = {
                reference: validReference,
                payload: positionPayload
            };
            const facet1 = new TestFacetClass(facetData);
            const facet2 = new TestFacetClass(facetData);
            const diff = facet1.diff(facet2);
            expect(diff).toBeUndefined();
        });

        it('should diff default-injected missing-payload facet against changed payload', () => {
            const fromMissingPayload = new TestFacetClass({
                reference: validReference
            } as any);
            const changedPayloadFacet = new TestFacetClass({
                reference: validReference,
                payload: { x: 99, y: 101 }
            });
            const diff = fromMissingPayload.diff(changedPayloadFacet);
            expect(diff).toBeDefined();
            expect(diff?.payload.toJSON()).toEqual({
                tag: 'Replace',
                match: { x: 0, y: 0 },
                payload: { x: 99, y: 101 }
            });
        });
    });

    describe('invert', () => {
        it('should invert facet (both reference and payload)', () => {
            const facetData: StandardFacetData<PositionPayloadType> = {
                reference: { ...validReference, ref: 1 },
                payload: positionPayload
            };
            const facet = new TestFacetClass(facetData);
            const inverted = facet.invert();
            // Reference should be inverted
            expect(inverted.ref).toBe(-1);
            // Payload should be inverted: PlainClass becomes RemoveClass
            expect(inverted.payload.toJSON()).toEqual({
                tag: 'Remove',
                match: positionPayload
            });
        });

        it('should invert default-injected missing-payload facet', () => {
            const fromMissingPayload = new TestFacetClass({
                reference: validReference
            } as any);
            const inverted = fromMissingPayload.invert();
            expect(inverted.ref).toBe(-1);
            expect(inverted.payload.toJSON()).toEqual({
                tag: 'Remove',
                match: { x: 0, y: 0 }
            });
        });

        it('should invert Replace state (swap match and payload)', () => {
            const originalMatch = { x: 5, y: 10 };
            const replaceData: StandardFacetData<PositionPayloadType> = {
                reference: validReference,
                payload: {
                    tag: 'Replace' as const,
                    match: originalMatch,
                    payload: positionPayload
                }
            };
            const facet = new TestFacetClass(replaceData);
            const inverted = facet.invert();
            // For Replace operations, inversion swaps match and payload
            expect(inverted.payload.toJSON()).toEqual({
                tag: 'Replace',
                match: positionPayload,  // Old payload becomes new match
                payload: originalMatch   // Old match becomes new payload
            });
        });
    });

    describe('renderFacet', () => {
        it('should delegate to payload class', () => {
            const facetData: StandardFacetData<PositionPayloadType> = {
                reference: validReference,
                payload: positionPayload
            };
            const facet = new TestFacetClass(facetData);
            const result = facet.renderFacet();
            expect(result).toHaveProperty('aggregatedNode');
            expect(result.newNode).toBeUndefined();
        });

        it('should handle Replace operations', () => {
            const replaceData: StandardFacetData<PositionPayloadType> = {
                reference: validReference,
                payload: {
                    tag: 'Replace' as const,
                    match: { x: 5, y: 10 },
                    payload: positionPayload
                }
            };
            const facet = new TestFacetClass(replaceData);
            const result = facet.renderFacet();
            expect(result).toHaveProperty('aggregatedNode');
            if (result.aggregatedNode) {
                // Replace operations should return Room node wrapping Replace/With containing Position tags
                expect(result.aggregatedNode.data.tag).toBe('Room');
                // Should have Replace child
                const replaceChild = result.aggregatedNode.children.find(child =>
                    treeNodeTypeguard(isSchemaReplace)(child)
                );
                expect(replaceChild).toBeDefined();
            }
        });

        it('should invert payload when reference is negative (transitivity)', () => {
            // Facet with negative reference and PlainClass payload
            const facetData: StandardFacetData<PositionPayloadType> = {
                reference: { ...validReference, ref: -1 },
                payload: positionPayload
            };
            const facet = new TestFacetClass(facetData);
            const result = facet.renderFacet();
            expect(result).toHaveProperty('aggregatedNode');
            expect(result.aggregatedNode).toBeDefined();
            
            // Convert rendered schema to WML and compare against expected
            const renderedWML = schemaToWML([result.aggregatedNode!]);
            const expectedWML = deIndentWML(`
                <Remove>
                    <Room key=(room1)><Remove><Position {10, 20} /></Remove></Room>
                </Remove>
            `);
            expect(renderedWML).toBe(expectedWML);
        });
    });

    describe('toFormat and lookup', () => {
        it('should convert format', () => {
            const facetData: StandardFacetData<PositionPayloadType> = {
                reference: validReference,
                payload: positionPayload
            };
            const facet = new TestFacetClass(facetData);
            const formatted = facet.toFormat('universal');
            expect(formatted).toBeInstanceOf(TestFacetClass);
            expect(formatted.payload.toJSON()).toEqual(positionPayload);
        });

        it('should lookup references', () => {
            const facetData: StandardFacetData<PositionPayloadType> = {
                reference: validReference,
                payload: positionPayload
            };
            const facet = new TestFacetClass(facetData);
            const lookupFn = (key: any) => key;
            const lookedUp = facet.lookup(lookupFn);
            expect(lookedUp).toBeInstanceOf(TestFacetClass);
            expect(lookedUp.payload.toJSON()).toEqual(positionPayload);
        });

        it('should preserve Replace state in toFormat', () => {
            const replaceData: StandardFacetData<PositionPayloadType> = {
                reference: validReference,
                payload: {
                    tag: 'Replace' as const,
                    match: { x: 5, y: 10 },
                    payload: positionPayload
                }
            };
            const facet = new TestFacetClass(replaceData);
            const formatted = facet.toFormat('universal');
            expect(formatted.payload.toJSON()).toEqual({
                tag: 'Replace',
                match: { x: 5, y: 10 },
                payload: positionPayload
            });
        });
    });

    describe('WML/Schema parsing', () => {
        describe('Plain facet parsing', () => {
            it('should construct from WML string (plain facet)', () => {
                const wml = deIndentWML(`
                    <Room key=(room1) uuid=(test123)>
                        <Position {10, 20} />
                    </Room>
                `);
                const facet = new TestFacetClass(wml);
                expect(facet.payload.toJSON()).toEqual({ x: 10, y: 20 });
                expect(facet.reference.key).toBe('room1');
                expect(facet.reference.universalKey).toBe('ROOM#test123');
            });

            it('should construct from GenericTree<SchemaTag> (plain facet)', () => {
                const schema: GenericTree<SchemaTag> = treeFromWML(deIndentWML(`
                    <Room key=(room1) uuid=(test123)>
                        <Position {15, 25} />
                    </Room>
                `));
                const facet = new TestFacetClass(schema);
                expect(facet.payload.toJSON()).toEqual({ x: 15, y: 25 });
                expect(facet.reference.key).toBe('room1');
                expect(facet.reference.universalKey).toBe('ROOM#test123');
            });
        });

        describe('Remove-wrapped facet parsing', () => {
            it('should construct from WML string (Remove-wrapped facet)', () => {
                const wml = deIndentWML(`
                    <Remove>
                        <Room key=(room1) uuid=(test123)>
                            <Position {10, 20} />
                        </Room>
                    </Remove>
                `);
                const facet = new TestFacetClass(wml);
                // Remove-wrapped facet should have negative ref and RemoveClass payload
                expect(facet.ref).toBe(-1);
                expect(facet.payload.toJSON()).toEqual({
                    tag: 'Remove',
                    match: { x: 10, y: 20 }
                });
                expect(facet.reference.key).toBe('room1');
                expect(facet.reference.universalKey).toBe('ROOM#test123');
            });

            it('should handle double-negative (Remove-wrapped Remove)', () => {
                const wml = deIndentWML(`
                    <Remove>
                        <Room key=(room1) uuid=(test123)>
                            <Remove>
                                <Position {10, 20} />
                            </Remove>
                        </Room>
                    </Remove>
                `);
                const facet = new TestFacetClass(wml);
                // Double-negative should have negative ref and PlainClass payload (inverted Remove → Plain)
                expect(facet.ref).toBe(-1);
                expect(facet.payload.toJSON()).toEqual({ x: 10, y: 20 });
                expect(facet.reference.key).toBe('room1');
                expect(facet.reference.universalKey).toBe('ROOM#test123');
            });
        });

        describe('Replace-wrapped facet parsing', () => {
            it('should construct from WML string (Replace-wrapped facet)', () => {
                const wml = deIndentWML(`
                    <Replace>
                        <Room key=(room1) uuid=(test123)>
                            <Position {5, 10} />
                        </Room>
                    </Replace>
                    <With>
                        <Room key=(room1) uuid=(test123)>
                            <Position {10, 20} />
                        </Room>
                    </With>
                `);
                const facet = new TestFacetClass(wml);
                expect(facet.payload.toJSON()).toEqual({
                    tag: 'Replace',
                    match: { x: 5, y: 10 },
                    payload: { x: 10, y: 20 }
                });
                expect(facet.reference.key).toBe('room1');
                expect(facet.reference.universalKey).toBe('ROOM#test123');
            });

            it('should construct from GenericTree<SchemaTag> (Replace-wrapped facet)', () => {
                const schema: GenericTree<SchemaTag> = treeFromWML(deIndentWML(`
                    <Replace>
                        <Room key=(room1) uuid=(test123)>
                            <Position {5, 10} />
                        </Room>
                    </Replace>
                    <With>
                        <Room key=(room1) uuid=(test123)>
                            <Position {15, 25} />
                        </Room>
                    </With>
                `));
                const facet = new TestFacetClass(schema);
                expect(facet.payload.toJSON()).toEqual({
                    tag: 'Replace',
                    match: { x: 5, y: 10 },
                    payload: { x: 15, y: 25 }
                });
                expect(facet.reference.key).toBe('room1');
                expect(facet.reference.universalKey).toBe('ROOM#test123');
                // When references match exactly, ref should be 0
                expect(facet.ref).toBe(0);
            });

            it('should error when Replace match and payload reference different components', () => {
                const wml = deIndentWML(`
                    <Replace>
                        <Room key=(room1) uuid=(test123)>
                            <Position {5, 10} />
                        </Room>
                    </Replace>
                    <With>
                        <Room key=(room2) uuid=(test456)>
                            <Position {10, 20} />
                        </Room>
                    </With>
                `);
                expect(() => new TestFacetClass(wml)).toThrow('must reference the same component');
            });

        });

        describe('Default reference extraction', () => {
            it('should use default reference extraction (Position/Mark style)', () => {
                // TestFacetClass uses PositionPayload, which should use default extraction
                const wml = deIndentWML(`
                    <Room key=(room1) uuid=(test123)>
                        <Position {10, 20} />
                    </Room>
                `);
                const facet = new TestFacetClass(wml);
                // Default extraction should read from Room tag attributes
                expect(facet.reference.key).toBe('room1');
                expect(facet.reference.universalKey).toBe('ROOM#test123');
                expect(facet.reference.tag).toBe('Room');
            });
        });

        describe('Error handling', () => {
            it('should throw error for empty WML string', () => {
                expect(() => new TestFacetClass('')).toThrow('Invalid argument');
            });

            it('should throw error for invalid WML string', () => {
                expect(() => new TestFacetClass('not valid WML')).toThrow('Invalid argument');
            });

            it('should throw error for empty schema tree', () => {
                const emptySchema: GenericTree<SchemaTag> = [];
                expect(() => new TestFacetClass(emptySchema)).toThrow('Invalid argument');
            });
        });
    });
});
