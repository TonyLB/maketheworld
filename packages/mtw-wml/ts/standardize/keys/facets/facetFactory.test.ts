import { facetClassFactory } from './facetFactory';
import { standardFacetFactory } from './standardFacetFactory';
import { PositionPayload } from './position';
import { StandardFacetData, PositionPayload as PositionPayloadType, MarkFacetPayload, ExitPayload } from './dataTypes/facet';
import { StandardReferenceData } from '../dataTypes/reference';
import { GenericTree, treeNodeTypeguard } from '@tonylb/mtw-base/ts/genericTree';
import { SchemaTag } from '@tonylb/mtw-base/ts/schema';
import { treeFromWML } from '../../../schema';
import { deIndentWML } from '../../../schema/utils';
import { StandardPositionFacet } from './position';
import { StandardMarkFacet } from './mark';
import { StandardExitFacet } from './exit';
import { isSchemaReplace } from '@tonylb/mtw-base/ts/schema/edit';

describe('facetClassFactory', () => {
    const TestFacetClass = facetClassFactory(PositionPayload, 'TestFacet');
    
    const validReference: StandardReferenceData = {
        key: 'room1',
        tag: 'Room',
        universalKey: 'ROOM#room1'
    };

    const positionPayload: PositionPayloadType = {
        type: 'PositionFacet',
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
            expect(facet.isReplace).toBe(false);
        });

        it('should construct from Replace JSON structure', () => {
            const matchData: StandardFacetData<PositionPayloadType> = {
                reference: validReference,
                payload: { type: 'PositionFacet', x: 5, y: 10 }
            };
            const payloadData: StandardFacetData<PositionPayloadType> = {
                reference: validReference,
                payload: positionPayload
            };
            const replaceData = {
                tag: 'Replace' as const,
                match: matchData,
                payload: payloadData
            };
            const facet = new TestFacetClass(replaceData);
            expect(facet.isReplace).toBe(true);
            expect(facet.matchPayload?.toJSON()).toEqual(matchData.payload);
            expect(facet.payload.toJSON()).toEqual(payloadData.payload);
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
            expect(facet.payload.x).toBe(10);
            expect(facet.payload.y).toBe(20);
            expect(facet.isReplace).toBe(false);
            expect(facet.matchPayload).toBeUndefined();
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
            const matchData: StandardFacetData<PositionPayloadType> = {
                reference: validReference,
                payload: { type: 'PositionFacet', x: 5, y: 10 }
            };
            const payloadData: StandardFacetData<PositionPayloadType> = {
                reference: validReference,
                payload: positionPayload
            };
            const replaceData = {
                tag: 'Replace' as const,
                match: matchData,
                payload: payloadData
            };
            const facet = new TestFacetClass(replaceData);
            const json = facet.toJSON();
            expect(json).toHaveProperty('tag', 'Replace');
            if ('tag' in json && json.tag === 'Replace') {
                expect(json.match).toEqual(matchData);
                expect(json.payload).toEqual(payloadData);
            }
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
                payload: { type: 'PositionFacet', x: 15, y: 25 }
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
                payload: { type: 'PositionFacet', x: 15, y: 25 }
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

        it('should create Replace operation when payloads differ', () => {
            const facetData1: StandardFacetData<PositionPayloadType> = {
                reference: validReference,
                payload: positionPayload
            };
            const facetData2: StandardFacetData<PositionPayloadType> = {
                reference: validReference,
                payload: { type: 'PositionFacet', x: 15, y: 25 }
            };
            const facet1 = new TestFacetClass(facetData1);
            const facet2 = new TestFacetClass(facetData2);
            const merged = facet1.merge(facet2);
            expect(merged).toBeDefined();
            expect(merged?.isReplace).toBe(true);
            expect(merged?.matchPayload?.toJSON()).toEqual(positionPayload);
            expect(merged?.payload.toJSON()).toEqual(facetData2.payload);
        });

        it('should return undefined when references cancel out and payloads are same', () => {
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
            expect(merged).toBeUndefined();
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

        it('should create Replace operation when payloads differ', () => {
            const facetData1: StandardFacetData<PositionPayloadType> = {
                reference: validReference,
                payload: positionPayload
            };
            const facetData2: StandardFacetData<PositionPayloadType> = {
                reference: validReference,
                payload: { type: 'PositionFacet', x: 15, y: 25 }
            };
            const facet1 = new TestFacetClass(facetData1);
            const facet2 = new TestFacetClass(facetData2);
            const diff = facet1.diff(facet2);
            expect(diff).toBeDefined();
            expect(diff?.isReplace).toBe(true);
            expect(diff?.matchPayload?.toJSON()).toEqual(positionPayload);
            expect(diff?.payload.toJSON()).toEqual(facetData2.payload);
        });
    });

    describe('invert', () => {
        it('should invert reference', () => {
            const facetData: StandardFacetData<PositionPayloadType> = {
                reference: { ...validReference, ref: 1 },
                payload: positionPayload
            };
            const facet = new TestFacetClass(facetData);
            const inverted = facet.invert();
            expect(inverted.ref).toBe(-1);
            expect(inverted.payload.toJSON()).toEqual(positionPayload);
        });

        it('should preserve Replace state when inverting', () => {
            const matchData: StandardFacetData<PositionPayloadType> = {
                reference: validReference,
                payload: { type: 'PositionFacet', x: 5, y: 10 }
            };
            const payloadData: StandardFacetData<PositionPayloadType> = {
                reference: validReference,
                payload: positionPayload
            };
            const replaceData = {
                tag: 'Replace' as const,
                match: matchData,
                payload: payloadData
            };
            const facet = new TestFacetClass(replaceData);
            const inverted = facet.invert();
            expect(inverted.isReplace).toBe(true);
            expect(inverted.matchPayload).toBeDefined();
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
            const matchData: StandardFacetData<PositionPayloadType> = {
                reference: validReference,
                payload: { type: 'PositionFacet', x: 5, y: 10 }
            };
            const payloadData: StandardFacetData<PositionPayloadType> = {
                reference: validReference,
                payload: positionPayload
            };
            const replaceData = {
                tag: 'Replace' as const,
                match: matchData,
                payload: payloadData
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
            const matchData: StandardFacetData<PositionPayloadType> = {
                reference: validReference,
                payload: { type: 'PositionFacet', x: 5, y: 10 }
            };
            const payloadData: StandardFacetData<PositionPayloadType> = {
                reference: validReference,
                payload: positionPayload
            };
            const replaceData = {
                tag: 'Replace' as const,
                match: matchData,
                payload: payloadData
            };
            const facet = new TestFacetClass(replaceData);
            const formatted = facet.toFormat('universal');
            expect(formatted.isReplace).toBe(true);
        });
    });

    describe('WML/Schema parsing', () => {
        describe('Plain facet parsing', () => {
            it('should construct from WML string (plain facet)', () => {
                const wml = deIndentWML(`
                    <Room key=(room1) uuid=(test123)>
                        <Position x="10" y="20" />
                    </Room>
                `);
                const facet = new TestFacetClass(wml);
                expect(facet.payload.x).toBe(10);
                expect(facet.payload.y).toBe(20);
                expect(facet.reference.key).toBe('room1');
                expect(facet.reference.universalKey).toBe('ROOM#test123');
                expect(facet.isReplace).toBe(false);
            });

            it('should construct from GenericTree<SchemaTag> (plain facet)', () => {
                const schema: GenericTree<SchemaTag> = treeFromWML(deIndentWML(`
                    <Room key=(room1) uuid=(test123)>
                        <Position x="15" y="25" />
                    </Room>
                `));
                const facet = new TestFacetClass(schema);
                expect(facet.payload.x).toBe(15);
                expect(facet.payload.y).toBe(25);
                expect(facet.reference.key).toBe('room1');
                expect(facet.reference.universalKey).toBe('ROOM#test123');
                expect(facet.isReplace).toBe(false);
            });
        });

        describe('Replace-wrapped facet parsing', () => {
            it('should construct from WML string (Replace-wrapped facet)', () => {
                const wml = deIndentWML(`
                    <Replace>
                        <Room key=(room1) uuid=(test123)>
                            <Position x="5" y="10" />
                        </Room>
                    </Replace>
                    <With>
                        <Room key=(room1) uuid=(test123)>
                            <Position x="10" y="20" />
                        </Room>
                    </With>
                `);
                const facet = new TestFacetClass(wml);
                expect(facet.isReplace).toBe(true);
                expect(facet.matchPayload?.x).toBe(5);
                expect(facet.matchPayload?.y).toBe(10);
                expect(facet.payload.x).toBe(10);
                expect(facet.payload.y).toBe(20);
                expect(facet.reference.key).toBe('room1');
                expect(facet.reference.universalKey).toBe('ROOM#test123');
            });

            it('should construct from GenericTree<SchemaTag> (Replace-wrapped facet)', () => {
                const schema: GenericTree<SchemaTag> = treeFromWML(deIndentWML(`
                    <Replace>
                        <Room key=(room1) uuid=(test123)>
                            <Position x="5" y="10" />
                        </Room>
                    </Replace>
                    <With>
                        <Room key=(room1) uuid=(test123)>
                            <Position x="15" y="25" />
                        </Room>
                    </With>
                `));
                const facet = new TestFacetClass(schema);
                expect(facet.isReplace).toBe(true);
                expect(facet.matchPayload?.x).toBe(5);
                expect(facet.matchPayload?.y).toBe(10);
                expect(facet.payload.x).toBe(15);
                expect(facet.payload.y).toBe(25);
                expect(facet.reference.key).toBe('room1');
                expect(facet.reference.universalKey).toBe('ROOM#test123');
            });

        });

        describe('Default reference extraction', () => {
            it('should use default reference extraction (Position/Mark style)', () => {
                // TestFacetClass uses PositionPayload, which should use default extraction
                const wml = deIndentWML(`
                    <Room key=(room1) uuid=(test123)>
                        <Position x="10" y="20" />
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

describe('standardFacetFactory', () => {
    const validReference: StandardReferenceData = {
        key: 'room1',
        tag: 'Room',
        ref: 1
    };

    describe('JSON data input (StandardFacetData)', () => {
        it('should create StandardPositionFacet from Position payload', () => {
            const facetData: StandardFacetData<PositionPayloadType> = {
                reference: validReference,
                payload: {
                    type: 'PositionFacet',
                    x: 10,
                    y: 20
                }
            };
            const facet = standardFacetFactory(facetData);
            expect(facet).toBeInstanceOf(StandardPositionFacet);
            expect(facet?.payload.toJSON()).toEqual(facetData.payload);
        });

        it('should create StandardMarkFacet from Mark payload', () => {
            const facetData: StandardFacetData<MarkFacetPayload> = {
                reference: {
                    key: 'mark1',
                    tag: 'Mark',
                    ref: 1,
                    universalKey: 'MARK#mark1'
                },
                payload: {
                    type: 'MarkFacet',
                    narrative: 'A dark room'
                }
            };
            const facet = standardFacetFactory(facetData);
            expect(facet).toBeInstanceOf(StandardMarkFacet);
            expect(facet?.payload.toJSON()).toEqual(facetData.payload);
        });

        it('should create StandardExitFacet from Exit payload', () => {
            const facetData: StandardFacetData<ExitPayload> = {
                reference: validReference,
                payload: {
                    type: 'ExitFacet',
                    description: 'A wooden door'
                }
            };
            const facet = standardFacetFactory(facetData);
            expect(facet).toBeInstanceOf(StandardExitFacet);
            expect(facet?.payload.toJSON()).toEqual(facetData.payload);
        });
    });

    describe('Schema tree input (GenericTree<SchemaTag>)', () => {
        it('should create StandardPositionFacet from Room schema (Position facet)', () => {
            const wml = '<Room key=(room1)><Position x="10" y="20" /></Room>';
            const schema = treeFromWML(deIndentWML(wml));
            const facet = standardFacetFactory(schema);
            expect(facet).toBeInstanceOf(StandardPositionFacet);
            expect(facet?.payload.toJSON()).toEqual({
                type: 'PositionFacet',
                x: 10,
                y: 20
            });
        });

        it('should create StandardMarkFacet from Mark schema (Mark facet)', () => {
            const wml = '<Mark uuid=(mark1)><Match>Dark room</Match></Mark>';
            const schema = treeFromWML(deIndentWML(wml));
            const facet = standardFacetFactory(schema);
            expect(facet).toBeInstanceOf(StandardMarkFacet);
            expect(facet?.payload.toJSON()).toEqual({
                type: 'MarkFacet',
                narrative: 'Dark room'
            });
        });

        it('should create StandardExitFacet from Exit schema (Exit facet)', () => {
            const wml = '<Exit to=(room1)>North</Exit>';
            const schema = treeFromWML(deIndentWML(wml));
            const facet = standardFacetFactory(schema);
            expect(facet).toBeInstanceOf(StandardExitFacet);
            expect(facet?.payload.toJSON()).toEqual({
                type: 'ExitFacet',
                description: 'North'
            });
        });
    });

    describe('Error cases', () => {
        it('should return undefined for invalid JSON data (missing payload type)', () => {
            const invalidData = {
                reference: validReference,
                payload: {
                    // Missing type field
                    x: 10,
                    y: 20
                }
            };
            const facet = standardFacetFactory(invalidData as any);
            expect(facet).toBeUndefined();
        });

        it('should return undefined for invalid schema tree (unknown root tag)', () => {
            const wml = '<Example key=(example1)>Test</Example>';
            const schema = treeFromWML(deIndentWML(wml));
            const facet = standardFacetFactory(schema);
            expect(facet).toBeUndefined();
        });

        it('should return undefined for null input', () => {
            const facet = standardFacetFactory(null as any);
            expect(facet).toBeUndefined();
        });

        it('should return undefined for undefined input', () => {
            const facet = standardFacetFactory(undefined as any);
            expect(facet).toBeUndefined();
        });

        it('should return undefined for empty schema tree', () => {
            const emptySchema: GenericTree<SchemaTag> = [];
            const facet = standardFacetFactory(emptySchema);
            expect(facet).toBeUndefined();
        });
    });
});
