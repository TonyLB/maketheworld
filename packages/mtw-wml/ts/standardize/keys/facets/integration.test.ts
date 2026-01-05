import { StandardFacet } from './facet';
import { StandardReference } from '../reference';
import { PositionPayload, MarkFacetPayload, ExitPayload } from './dataTypes/facet';
import { PositionPayload as PositionPayloadClass } from './position';
import { MarkFacetPayload as MarkFacetPayloadClass } from './mark';
import { ExitPayload as ExitPayloadClass } from './exit';
import { treeFromWML, schemaToWML } from '../../../schema';
import { deIndentWML } from '../../../schema/utils';
import { treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree";
import { isSchemaRoom, isSchemaPosition, isSchemaExit } from "@tonylb/mtw-base/ts/schema/components";
import { isSchemaMark, isSchemaMatch } from "@tonylb/mtw-base/ts/schema/worldState";
import { isSchemaString } from "@tonylb/mtw-base/ts/schema/renderTree";
import { GenericTreeNode } from "@tonylb/mtw-base/ts/genericTree";
import { SchemaTag, ComponentUUID } from "@tonylb/mtw-base/ts/schema";

describe('Facet Integration Tests', () => {
    // Helper function to strip type prefix from ComponentUUID for WML format
    const stripTypePrefix = (uuid: ComponentUUID | string): string => {
        const str = String(uuid);
        const hashIndex = str.indexOf('#');
        return hashIndex >= 0 ? str.substring(hashIndex + 1) : str;
    };

    // Test helper functions
    const createPositionFacet = (reference: StandardReference, x: number, y: number): StandardFacet<PositionPayload> => {
        const payload: PositionPayload = {
            type: 'PositionFacet',
            x,
            y
        };
        return new StandardFacet<PositionPayload>({
            reference: reference.toJSON(),
            payload
        });
    };

    const createMarkFacet = (reference: StandardReference, narrative: string): StandardFacet<MarkFacetPayload> => {
        const payload: MarkFacetPayload = {
            type: 'MarkFacet',
            narrative
        };
        return new StandardFacet<MarkFacetPayload>({
            reference: reference.toJSON(),
            payload
        });
    };

    const createExitFacet = (reference: StandardReference, description?: string): StandardFacet<ExitPayload> => {
        const payload: ExitPayload = {
            type: 'ExitFacet',
            description
        };
        return new StandardFacet<ExitPayload>({
            reference: reference.toJSON(),
            payload
        });
    };

    const parseWMLToFacet = (wml: string, payloadType: 'Position' | 'Mark' | 'Exit'): StandardFacet<any> => {
        const schema = treeFromWML(deIndentWML(wml));
        if (schema.length === 0) {
            throw new Error('Empty schema');
        }

        const firstNode = schema[0];

        if (payloadType === 'Position') {
            if (!treeNodeTypeguard(isSchemaRoom)(firstNode)) {
                throw new Error('Expected Room tag for Position facet');
            }
            const roomData = firstNode.data;
            // UUIDs in WML don't have type prefix, add it when constructing StandardReference
            const uuidValue = roomData.uuid ? (roomData.uuid.includes('#') ? roomData.uuid : `ROOM#${roomData.uuid}`) : undefined;
            const reference = new StandardReference({
                key: roomData.key,
                universalKey: uuidValue || (roomData.key ? `ROOM#${roomData.key}` : ''),
                tag: 'Room'
            });
            const payloadClass = new PositionPayloadClass();
            const payload = payloadClass.fromSchema(schema, reference);
            return new StandardFacet<PositionPayload>({
                reference: reference.toJSON(),
                payload
            });
        } else if (payloadType === 'Mark') {
            if (!treeNodeTypeguard(isSchemaMark)(firstNode)) {
                throw new Error('Expected Mark tag for Mark facet');
            }
            const markData = firstNode.data;
            // UUIDs in WML don't have type prefix, add it when constructing StandardReference
            const uuidValue = markData.uuid ? (markData.uuid.includes('#') ? markData.uuid : `MARK#${markData.uuid}`) : '';
            const reference = new StandardReference(uuidValue, 'Mark');
            const payloadClass = new MarkFacetPayloadClass();
            const payload = payloadClass.fromSchema(schema, reference);
            return new StandardFacet<MarkFacetPayload>({
                reference: reference.toJSON(),
                payload
            });
        } else if (payloadType === 'Exit') {
            if (!treeNodeTypeguard(isSchemaExit)(firstNode)) {
                throw new Error('Expected Exit tag for Exit facet');
            }
            const toValue = firstNode.data.to;
            if (!toValue) {
                throw new Error('Exit tag missing `to` property');
            }
            // Exit `to` property may be a key or UUID without prefix, StandardReference will handle it
            const reference = new StandardReference(toValue, 'Room');
            const payloadClass = new ExitPayloadClass();
            const payload = payloadClass.fromSchema(schema, reference);
            return new StandardFacet<ExitPayload>({
                reference: reference.toJSON(),
                payload
            });
        }

        throw new Error(`Unknown payload type: ${payloadType}`);
    };

    const facetToWML = (facet: StandardFacet<any>): string => {
        const renderResult = facet.renderFacet();
        if (renderResult.aggregatedNode) {
            return schemaToWML([renderResult.aggregatedNode]);
        } else if (renderResult.newNode) {
            return schemaToWML([renderResult.newNode]);
        }
        throw new Error('No node returned from renderFacet');
    };

    const createMockRoomReference = (key: string, uuid?: ComponentUUID): GenericTreeNode<SchemaTag> => {
        // Use treeFromWML to ensure proper types
        // Strip type prefix from UUID for WML format
        if (uuid) {
            const uuidStr = stripTypePrefix(uuid);
            return treeFromWML(deIndentWML(`<Room key=(${key}) uuid=(${uuidStr}) />`))[0];
        } else {
            return treeFromWML(deIndentWML(`<Room key=(${key}) />`))[0];
        }
    };

    const createMockMarkReference = (uuid: ComponentUUID): GenericTreeNode<SchemaTag> => {
        // Use treeFromWML to ensure proper types
        // Strip type prefix from UUID for WML format
        const uuidStr = stripTypePrefix(uuid);
        return treeFromWML(deIndentWML(`<Mark uuid=(${uuidStr}) />`))[0];
    };

    describe('Round-trip WML parsing/generation', () => {
        describe('PositionPayload', () => {
            it('should round-trip Position facet with key-based reference', () => {
                const originalWML = '<Room key=(room1)><Position x="10" y="20" /></Room>';
                const facet = parseWMLToFacet(originalWML, 'Position');
                
                // Payload is now a class instance - access type via toJSON(), properties directly
                expect(facet.payload.toJSON().type).toBe('PositionFacet');
                expect(facet.payload.x).toBe(10);
                expect(facet.payload.y).toBe(20);
                
                const generatedWML = facetToWML(facet);
                // Verify structure is preserved (allowing for formatting differences)
                expect(generatedWML).toContain('Room');
                expect(generatedWML).toContain('Position');
                expect(generatedWML).toContain('x=');
                expect(generatedWML).toContain('y=');
            });

            it('should round-trip Position facet with uuid-based reference', () => {
                const originalWML = '<Room uuid=(test123)><Position x="15" y="25" /></Room>';
                const facet = parseWMLToFacet(originalWML, 'Position');
                
                // Payload is now a class instance - access type via toJSON(), properties directly
                expect(facet.payload.toJSON().type).toBe('PositionFacet');
                expect(facet.payload.x).toBe(15);
                expect(facet.payload.y).toBe(25);
                
                const generatedWML = facetToWML(facet);
                expect(generatedWML).toContain('Room');
                expect(generatedWML).toContain('Position');
            });
        });

        describe('MarkFacetPayload', () => {
            it('should round-trip Mark facet', () => {
                const originalWML = '<Mark uuid=(test123)><Match>Condition text</Match></Mark>';
                const facet = parseWMLToFacet(originalWML, 'Mark');
                
                // Payload is now a class instance - access type via toJSON(), properties directly
                expect(facet.payload.toJSON().type).toBe('MarkFacet');
                expect(facet.payload.narrative).toBe('Condition text');
                
                const generatedWML = facetToWML(facet);
                expect(generatedWML).toContain('Mark');
                expect(generatedWML).toContain('Match');
            });

            it('should round-trip Mark facet with empty narrative', () => {
                const originalWML = '<Mark uuid=(test456)><Match></Match></Mark>';
                const facet = parseWMLToFacet(originalWML, 'Mark');
                
                // Payload is now a class instance - access type via toJSON(), properties directly
                expect(facet.payload.toJSON().type).toBe('MarkFacet');
                expect(facet.payload.narrative).toBe('');
                
                const generatedWML = facetToWML(facet);
                expect(generatedWML).toContain('Mark');
                expect(generatedWML).toContain('Match');
            });
        });

        describe('ExitPayload', () => {
            it('should round-trip Exit facet with description', () => {
                const originalWML = '<Exit to=(ROOM#target1)>North Exit</Exit>';
                const facet = parseWMLToFacet(originalWML, 'Exit');
                
                // Payload is now a class instance - access type via toJSON(), properties directly
                expect(facet.payload.toJSON().type).toBe('ExitFacet');
                expect(facet.payload.description).toBe('North Exit');
                
                const generatedWML = facetToWML(facet);
                expect(generatedWML).toContain('Exit');
                expect(generatedWML).toContain('to=');
            });

            it('should round-trip Exit facet without description', () => {
                const originalWML = '<Exit to=(ROOM#target2) />';
                const facet = parseWMLToFacet(originalWML, 'Exit');
                
                // Payload is now a class instance - access type via toJSON(), properties directly
                expect(facet.payload.toJSON().type).toBe('ExitFacet');
                expect(facet.payload.description).toBeUndefined();
                
                const generatedWML = facetToWML(facet);
                expect(generatedWML).toContain('Exit');
                expect(generatedWML).toContain('to=');
            });
        });
    });

    describe('Parsing edge cases', () => {
        describe('PositionPayload', () => {
            it('should error when Position child is missing', () => {
                const wml = '<Room key=(room1) />';
                expect(() => parseWMLToFacet(wml, 'Position')).toThrow();
            });

        });

        describe('MarkFacetPayload', () => {
            it('should error when Match child is missing', () => {
                const wml = '<Mark uuid=(test1) />';
                expect(() => parseWMLToFacet(wml, 'Mark')).toThrow();
            });

            it('should handle empty Match tag (empty narrative)', () => {
                const wml = '<Mark uuid=(test2)><Match></Match></Mark>';
                const facet = parseWMLToFacet(wml, 'Mark');
                expect(facet.payload.narrative).toBe('');
            });

        });

        describe('ExitPayload', () => {
            it('should error when `to` property is missing', () => {
                const wml = '<Exit>North</Exit>';
                expect(() => parseWMLToFacet(wml, 'Exit')).toThrow();
            });

            it('should handle empty Exit tag content (undefined description)', () => {
                const wml = '<Exit to=(ROOM#target1) />';
                const facet = parseWMLToFacet(wml, 'Exit');
                expect(facet.payload.description).toBeUndefined();
            });

        });
    });

    describe('renderFacet() tests', () => {
        describe('PositionPayload.renderFacet()', () => {
            it('should enhance pre-existing Room render with Position child', () => {
                const reference = new StandardReference('ROOM#123', 'Room');
                const payload = new PositionPayloadClass({ type: 'PositionFacet', x: 10, y: 20 });
                const roomRender = createMockRoomReference('room1', 'ROOM#123');
                roomRender.children.push({
                    data: { tag: 'ShortName' as const },
                    children: [{ data: { tag: 'String' as const, value: 'Test Room' }, children: [] }]
                });

                const result = payload.renderFacet(reference, payload.toJSON(), roomRender);

                expect(result.aggregatedNode).toBeDefined();
                expect(result.newNode).toBeUndefined();
                
                const aggregatedNode = result.aggregatedNode!;
                expect(treeNodeTypeguard(isSchemaRoom)(aggregatedNode)).toBe(true);
                const positionChild = aggregatedNode.children.find(treeNodeTypeguard(isSchemaPosition));
                expect(positionChild).toBeDefined();
                if (positionChild && positionChild.data.tag === 'Position') {
                    expect(positionChild.data.x).toBe(10);
                    expect(positionChild.data.y).toBe(20);
                }
            });

            it('should generate plain Room reference render without referenceRender', () => {
                const reference = new StandardReference({ key: 'testRoom', universalKey: 'ROOM#123', tag: 'Room' });
                const payload = new PositionPayloadClass({ type: 'PositionFacet', x: 15, y: 25 });

                const result = payload.renderFacet(reference, payload.toJSON());

                expect(result.aggregatedNode).toBeDefined();
                expect(result.newNode).toBeUndefined();

                const aggregatedNode = result.aggregatedNode!;
                expect(treeNodeTypeguard(isSchemaRoom)(aggregatedNode)).toBe(true);
                if (aggregatedNode.data.tag === 'Room') {
                    expect(aggregatedNode.data.key).toBe('testRoom');
                }
                const positionChild = aggregatedNode.children.find(treeNodeTypeguard(isSchemaPosition));
                expect(positionChild).toBeDefined();
            });

            it('should always return aggregatedNode (never newNode)', () => {
                const reference = new StandardReference('ROOM#789', 'Room');
                const payload = new PositionPayloadClass({ type: 'PositionFacet', x: 50, y: 60 });

                const result1 = payload.renderFacet(reference, payload.toJSON());
                expect(result1.aggregatedNode).toBeDefined();
                expect(result1.newNode).toBeUndefined();

                const roomRender = createMockRoomReference('room1', 'ROOM#789');
                const result2 = payload.renderFacet(reference, payload.toJSON(), roomRender);
                expect(result2.aggregatedNode).toBeDefined();
                expect(result2.newNode).toBeUndefined();
            });
        });

        describe('MarkFacetPayload.renderFacet()', () => {
            it('should enhance pre-existing Mark render with Match child', () => {
                const reference = new StandardReference('MARK#123', 'Mark');
                const payload = new MarkFacetPayloadClass({ type: 'MarkFacet', narrative: 'Test condition' });
                const markRender = createMockMarkReference('MARK#123');
                markRender.children.push({
                    data: { tag: 'ShortName' as const },
                    children: [{ data: { tag: 'String' as const, value: 'Test Mark' }, children: [] }]
                });

                const result = payload.renderFacet(reference, payload.toJSON(), markRender);

                expect(result.aggregatedNode).toBeDefined();
                expect(result.newNode).toBeUndefined();

                const aggregatedNode = result.aggregatedNode!;
                expect(treeNodeTypeguard(isSchemaMark)(aggregatedNode)).toBe(true);
                const matchChild = aggregatedNode.children.find(treeNodeTypeguard(isSchemaMatch));
                expect(matchChild).toBeDefined();
                if (matchChild) {
                    const stringChild = matchChild.children.find(child => isSchemaString(child.data));
                    expect(stringChild).toBeDefined();
                    if (stringChild && isSchemaString(stringChild.data)) {
                        expect(stringChild.data.value).toBe('Test condition');
                    }
                }
            });

            it('should generate plain Mark reference render without referenceRender', () => {
                const reference = new StandardReference('MARK#456', 'Mark');
                const payload = new MarkFacetPayloadClass({ type: 'MarkFacet', narrative: 'Another condition' });

                const result = payload.renderFacet(reference, payload.toJSON());

                expect(result.aggregatedNode).toBeDefined();
                expect(result.newNode).toBeUndefined();

                const aggregatedNode = result.aggregatedNode!;
                expect(treeNodeTypeguard(isSchemaMark)(aggregatedNode)).toBe(true);
                const matchChild = aggregatedNode.children.find(treeNodeTypeguard(isSchemaMatch));
                expect(matchChild).toBeDefined();
            });

            it('should always return aggregatedNode (never newNode)', () => {
                const reference = new StandardReference('MARK#789', 'Mark');
                const payload = new MarkFacetPayloadClass({ type: 'MarkFacet', narrative: 'Condition text' });

                const result1 = payload.renderFacet(reference, payload.toJSON());
                expect(result1.aggregatedNode).toBeDefined();
                expect(result1.newNode).toBeUndefined();

                const markRender = createMockMarkReference('MARK#789');
                const result2 = payload.renderFacet(reference, payload.toJSON(), markRender);
                expect(result2.aggregatedNode).toBeDefined();
                expect(result2.newNode).toBeUndefined();
            });
        });

        describe('ExitPayload.renderFacet()', () => {
            it('should ignore referenceRender parameter', () => {
                const reference = new StandardReference('ROOM#123', 'Room');
                const payload = new ExitPayloadClass({ type: 'ExitFacet', description: 'North Exit' });
                const roomRender = createMockRoomReference('room1', 'ROOM#123');

                const result1 = payload.renderFacet(reference, payload.toJSON());
                const result2 = payload.renderFacet(reference, payload.toJSON(), roomRender);

                // Both should return the same structure (referenceRender ignored)
                expect(result1.newNode).toBeDefined();
                expect(result2.newNode).toBeDefined();
                expect(result1.aggregatedNode).toBeUndefined();
                expect(result2.aggregatedNode).toBeUndefined();
            });

            it('should always return newNode (never aggregatedNode)', () => {
                const reference = new StandardReference('ROOM#456', 'Room');
                const payload = new ExitPayloadClass({ type: 'ExitFacet', description: 'East Exit' });

                const result1 = payload.renderFacet(reference, payload.toJSON());
                expect(result1.newNode).toBeDefined();
                expect(result1.aggregatedNode).toBeUndefined();

                const roomRender = createMockRoomReference('room2', 'ROOM#456');
                const result2 = payload.renderFacet(reference, payload.toJSON(), roomRender);
                expect(result2.newNode).toBeDefined();
                expect(result2.aggregatedNode).toBeUndefined();
            });

            it('should include Exit tag with correct `to` property', () => {
                const reference = new StandardReference({ key: 'testRoom', universalKey: 'ROOM#123', tag: 'Room' });
                const payload = new ExitPayloadClass({ type: 'ExitFacet', description: 'West Exit' });

                const result = payload.renderFacet(reference, payload.toJSON());

                const newNode = result.newNode!;
                expect(treeNodeTypeguard(isSchemaExit)(newNode)).toBe(true);
                if (newNode.data.tag === 'Exit') {
                    expect(newNode.data.to).toBeTruthy();
                }
            });

            it('should include description in Exit tag content', () => {
                const reference = new StandardReference('ROOM#789', 'Room');
                const payload = new ExitPayloadClass({ type: 'ExitFacet', description: 'South Exit' });

                const result = payload.renderFacet(reference, payload.toJSON());

                const newNode = result.newNode!;
                if (newNode.data.tag === 'Exit') {
                    const stringChild = newNode.children.find(child => isSchemaString(child.data));
                    expect(stringChild).toBeDefined();
                    if (stringChild && isSchemaString(stringChild.data)) {
                        expect(stringChild.data.value).toBe('South Exit');
                    }
                }
            });

            it('should have empty Exit tag when description is undefined', () => {
                const reference = new StandardReference('ROOM#999', 'Room');
                const payload = new ExitPayloadClass({ type: 'ExitFacet' });

                const result = payload.renderFacet(reference, payload.toJSON());

                const newNode = result.newNode!;
                if (newNode.data.tag === 'Exit') {
                    // Should have no String children
                    const stringChildren = newNode.children.filter(child => isSchemaString(child.data));
                    expect(stringChildren.length).toBe(0);
                }
            });
        });
    });

    describe('StandardFacet.renderFacet() helper', () => {
        it('should delegate to payload class renderFacet() correctly', () => {
            const reference = new StandardReference('ROOM#123', 'Room');
            const facet = createPositionFacet(reference, 10, 20);

            const result = facet.renderFacet();

            expect(result.aggregatedNode).toBeDefined();
            expect(result.newNode).toBeUndefined();
        });

        it('should handle Replace operations with Position facet', () => {
            const reference = new StandardReference('ROOM#123', 'Room');
            const matchFacet = createPositionFacet(reference, 5, 10);
            const payloadFacet = createPositionFacet(reference, 15, 20);
            const replaceFacet = matchFacet.merge(payloadFacet);

            expect(replaceFacet).toBeDefined();
            expect(replaceFacet!.isReplace).toBe(true);

            const result = replaceFacet!.renderFacet();

            // Replace operations should return aggregatedNode with Replace structure
            expect(result.aggregatedNode).toBeDefined();
            if (result.aggregatedNode) {
                expect(result.aggregatedNode.data.tag).toBe('Replace');
            }
        });

        it('should handle Replace operations with Mark facet', () => {
            const reference = new StandardReference('MARK#123', 'Mark');
            const matchFacet = createMarkFacet(reference, 'Old condition');
            const payloadFacet = createMarkFacet(reference, 'New condition');
            const replaceFacet = matchFacet.merge(payloadFacet);

            expect(replaceFacet).toBeDefined();
            expect(replaceFacet!.isReplace).toBe(true);

            const result = replaceFacet!.renderFacet();

            expect(result.aggregatedNode).toBeDefined();
            if (result.aggregatedNode) {
                expect(result.aggregatedNode.data.tag).toBe('Replace');
            }
        });

        it('should handle Replace operations with Exit facet', () => {
            const reference = new StandardReference('ROOM#123', 'Room');
            const matchFacet = createExitFacet(reference, 'Old exit');
            const payloadFacet = createExitFacet(reference, 'New exit');
            const replaceFacet = matchFacet.merge(payloadFacet);

            expect(replaceFacet).toBeDefined();
            expect(replaceFacet!.isReplace).toBe(true);

            const result = replaceFacet!.renderFacet();

            // Exit facets return aggregatedNode with Replace wrapper even though payload returns newNode
            expect(result.aggregatedNode).toBeDefined();
            if (result.aggregatedNode) {
                expect(result.aggregatedNode.data.tag).toBe('Replace');
            }
        });

        it('should handle Replace operations with referenceRender for Position facet', () => {
            const reference = new StandardReference('ROOM#123', 'Room');
            const matchFacet = createPositionFacet(reference, 5, 10);
            const payloadFacet = createPositionFacet(reference, 15, 20);
            const replaceFacet = matchFacet.merge(payloadFacet);

            const roomRender = createMockRoomReference('room1', 'ROOM#123');
            const result = replaceFacet!.renderFacet(roomRender);

            expect(result.aggregatedNode).toBeDefined();
            if (result.aggregatedNode) {
                expect(result.aggregatedNode.data.tag).toBe('Replace');
            }
        });
    });

    describe('Parent component orchestration patterns', () => {
        describe('Mock Map component with Position facets', () => {
            it('should enhance Room references with Position children', () => {
                // Mock rendering rooms reference list first
                const room1Ref = new StandardReference({ key: 'room1', universalKey: 'ROOM#1', tag: 'Room' });
                const room2Ref = new StandardReference({ key: 'room2', universalKey: 'ROOM#2', tag: 'Room' });
                
                const room1Render = room1Ref.schema[0];
                const room2Render = room2Ref.schema[0];

                // Apply Position facet rendering
                const facet1 = createPositionFacet(room1Ref, 10, 20);
                const facet2 = createPositionFacet(room2Ref, 30, 40);

                const result1 = facet1.renderFacet(room1Render);
                const result2 = facet2.renderFacet(room2Render);

                expect(result1.aggregatedNode).toBeDefined();
                expect(result2.aggregatedNode).toBeDefined();

                // Verify enhanced references have Position children
                const enhanced1 = result1.aggregatedNode!;
                const position1 = enhanced1.children.find(treeNodeTypeguard(isSchemaPosition));
                expect(position1).toBeDefined();

                const enhanced2 = result2.aggregatedNode!;
                const position2 = enhanced2.children.find(treeNodeTypeguard(isSchemaPosition));
                expect(position2).toBeDefined();
            });

            it('should handle Rooms without positions (reference render only)', () => {
                const room1Ref = new StandardReference({ key: 'room1', universalKey: 'ROOM#1', tag: 'Room' });
                const room2Ref = new StandardReference({ key: 'room2', universalKey: 'ROOM#2', tag: 'Room' });

                const room1Render = room1Ref.schema[0];
                const room2Render = room2Ref.schema[0];

                // Only room1 has a position facet
                const facet1 = createPositionFacet(room1Ref, 10, 20);

                const result1 = facet1.renderFacet(room1Render);

                expect(result1.aggregatedNode).toBeDefined();
                // room2 has no facet, so just use room2Render directly (no enhancement)
                expect(room2Render.children.length).toBe(0); // No Position child
            });

            it('should verify zippering pattern works correctly', () => {
                // Mock Map with rooms and positions
                const room1Ref = new StandardReference({ key: 'room1', universalKey: 'ROOM#1', tag: 'Room' });
                const room2Ref = new StandardReference({ key: 'room2', universalKey: 'ROOM#2', tag: 'Room' });
                const room3Ref = new StandardReference({ key: 'room3', universalKey: 'ROOM#3', tag: 'Room' });

                const roomRenders = [
                    room1Ref.schema[0],
                    room2Ref.schema[0],
                    room3Ref.schema[0]
                ];

                // Create facets for room1 and room3 (room2 has no position)
                const facet1 = createPositionFacet(room1Ref, 10, 20);
                const facet3 = createPositionFacet(room3Ref, 50, 60);

                // Zipper: enhance room1 and room3, leave room2 as-is
                const enhanced1 = facet1.renderFacet(roomRenders[0]).aggregatedNode!;
                const room2Plain = roomRenders[1];
                const enhanced3 = facet3.renderFacet(roomRenders[2]).aggregatedNode!;

                // Verify room1 has Position
                expect(enhanced1.children.find(treeNodeTypeguard(isSchemaPosition))).toBeDefined();
                // Verify room2 has no Position
                expect(room2Plain.children.find(treeNodeTypeguard(isSchemaPosition))).toBeUndefined();
                // Verify room3 has Position
                expect(enhanced3.children.find(treeNodeTypeguard(isSchemaPosition))).toBeDefined();
            });
        });

        describe('Mock Example component with Mark facets', () => {
            it('should enhance Mark references with Match children', () => {
                // Mock rendering marks reference list first
                const mark1Ref = new StandardReference('MARK#1', 'Mark');
                const mark2Ref = new StandardReference('MARK#2', 'Mark');

                const mark1Render = mark1Ref.schema[0];
                const mark2Render = mark2Ref.schema[0];

                // Apply Mark facet rendering
                const facet1 = createMarkFacet(mark1Ref, 'Condition 1');
                const facet2 = createMarkFacet(mark2Ref, 'Condition 2');

                const result1 = facet1.renderFacet(mark1Render);
                const result2 = facet2.renderFacet(mark2Render);

                expect(result1.aggregatedNode).toBeDefined();
                expect(result2.aggregatedNode).toBeDefined();

                // Verify enhanced references have Match children
                const enhanced1 = result1.aggregatedNode!;
                const match1 = enhanced1.children.find(treeNodeTypeguard(isSchemaMatch));
                expect(match1).toBeDefined();

                const enhanced2 = result2.aggregatedNode!;
                const match2 = enhanced2.children.find(treeNodeTypeguard(isSchemaMatch));
                expect(match2).toBeDefined();
            });

            it('should handle Marks without facet payloads (reference render only)', () => {
                const mark1Ref = new StandardReference('MARK#1', 'Mark');
                const mark2Ref = new StandardReference('MARK#2', 'Mark');

                const mark1Render = mark1Ref.schema[0];
                const mark2Render = mark2Ref.schema[0];

                // Only mark1 has a facet
                const facet1 = createMarkFacet(mark1Ref, 'Condition 1');

                const result1 = facet1.renderFacet(mark1Render);

                expect(result1.aggregatedNode).toBeDefined();
                // mark2 has no facet, so just use mark2Render directly (no enhancement)
                expect(mark2Render.children.length).toBe(0); // No Match child
            });
        });

        describe('Mock Map component with Exit facets', () => {
            it('should create new Exit nodes (not enhancements)', () => {
                const room1Ref = new StandardReference('ROOM#1', 'Room');
                const room2Ref = new StandardReference('ROOM#2', 'Room');

                // Create Exit facets
                const exit1 = createExitFacet(room1Ref, 'North');
                const exit2 = createExitFacet(room2Ref, 'South');

                const result1 = exit1.renderFacet();
                const result2 = exit2.renderFacet();

                expect(result1.newNode).toBeDefined();
                expect(result2.newNode).toBeDefined();
                expect(result1.aggregatedNode).toBeUndefined();
                expect(result2.aggregatedNode).toBeUndefined();

                // Verify Exit nodes have correct structure
                const exitNode1 = result1.newNode!;
                expect(treeNodeTypeguard(isSchemaExit)(exitNode1)).toBe(true);
                
                const exitNode2 = result2.newNode!;
                expect(treeNodeTypeguard(isSchemaExit)(exitNode2)).toBe(true);
            });

            it('should mix Rooms (with/without Position facets) and Exits', () => {
                const room1Ref = new StandardReference({ key: 'room1', universalKey: 'ROOM#1', tag: 'Room' });
                const room2Ref = new StandardReference({ key: 'room2', universalKey: 'ROOM#2', tag: 'Room' });

                // room1 has a Position facet
                const positionFacet = createPositionFacet(room1Ref, 10, 20);
                const room1Render = room1Ref.schema[0];
                const enhancedRoom1 = positionFacet.renderFacet(room1Render).aggregatedNode!;

                // room2 has no Position facet (plain reference)
                const room2Render = room2Ref.schema[0];

                // Create Exit facets
                const exit1 = createExitFacet(room1Ref, 'North');
                const exit2 = createExitFacet(room2Ref, 'South');

                const exitNode1 = exit1.renderFacet().newNode!;
                const exitNode2 = exit2.renderFacet().newNode!;

                // Verify all structures are correct
                expect(enhancedRoom1.children.find(treeNodeTypeguard(isSchemaPosition))).toBeDefined();
                expect(room2Render.children.find(treeNodeTypeguard(isSchemaPosition))).toBeUndefined();
                expect(treeNodeTypeguard(isSchemaExit)(exitNode1)).toBe(true);
                expect(treeNodeTypeguard(isSchemaExit)(exitNode2)).toBe(true);
            });
        });
    });

    describe('Edge cases', () => {
        it('should handle Rooms without positions (plain Room references)', () => {
            const roomRef = new StandardReference({ key: 'room1', universalKey: 'ROOM#1', tag: 'Room' });
            const roomRender = roomRef.schema[0];

            // No Position facet, so render should remain as plain reference
            expect(roomRender.children.length).toBe(0);
            expect(roomRender.children.find(treeNodeTypeguard(isSchemaPosition))).toBeUndefined();
        });

        it('should handle Rooms with positions (enhanced Room references)', () => {
            const roomRef = new StandardReference({ key: 'room1', universalKey: 'ROOM#1', tag: 'Room' });
            const facet = createPositionFacet(roomRef, 10, 20);

            const result = facet.renderFacet();

            expect(result.aggregatedNode).toBeDefined();
            const enhanced = result.aggregatedNode!;
            expect(enhanced.children.find(treeNodeTypeguard(isSchemaPosition))).toBeDefined();
        });

        it('should handle Maps with Exits (new Exit nodes)', () => {
            const roomRef = new StandardReference('ROOM#1', 'Room');
            const exit = createExitFacet(roomRef, 'North');

            const result = exit.renderFacet();

            expect(result.newNode).toBeDefined();
            expect(treeNodeTypeguard(isSchemaExit)(result.newNode!)).toBe(true);
        });

        it('should handle Examples with Mark references but no facet payloads', () => {
            const markRef = new StandardReference('MARK#1', 'Mark');
            const markRender = markRef.schema[0];

            // No Mark facet, so render should remain as plain reference
            expect(markRender.children.length).toBe(0);
            expect(markRender.children.find(treeNodeTypeguard(isSchemaMatch))).toBeUndefined();
        });

        it('should still render correctly when facets reference non-existent components', () => {
            // Facets can reference components that don't exist yet
            // Validation happens elsewhere, rendering should still work
            const roomRef = new StandardReference('ROOM#nonexistent', 'Room');
            const facet = createPositionFacet(roomRef, 10, 20);

            const result = facet.renderFacet();

            // Should still render correctly
            expect(result.aggregatedNode).toBeDefined();
            const enhanced = result.aggregatedNode!;
            expect(enhanced.children.find(treeNodeTypeguard(isSchemaPosition))).toBeDefined();
        });
    });
});
