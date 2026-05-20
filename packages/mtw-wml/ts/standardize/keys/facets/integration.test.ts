import { StandardReference } from '../reference';
import { PositionPayload, MarkFacetPayload as MarkFacetPayloadType, ExitPayload } from './dataTypes/facet';
import { PositionFacetPayload, StandardPositionFacet } from './position';
import { MarkFacetPayload, StandardMarkFacet } from './mark';
import { ExitFacetPayload, StandardExitFacet } from './exit';
import { treeFromWML, schemaToWML } from '../../../schema';
import { deIndentWML } from '../../../schema/utils';
import { treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree";
import { isSchemaRoom, isSchemaPosition, isSchemaExit } from "@tonylb/mtw-base/ts/schema/components";
import { isSchemaMark, isSchemaMatch } from "@tonylb/mtw-base/ts/schema/worldState";
import { isSchemaString } from "@tonylb/mtw-base/ts/schema/renderTree";
import { isSchemaReplace } from "@tonylb/mtw-base/ts/schema/edit";
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
    const createPositionFacet = (reference: StandardReference, x: number, y: number): StandardPositionFacet => {
        const payload: PositionPayload = {
            x,
            y
        };
        return new StandardPositionFacet({
            reference: reference.toJSON(),
            payload
        });
    };

    const createMarkFacet = (reference: StandardReference, narrative: string): StandardMarkFacet => {
        const payload: MarkFacetPayloadType = narrative;
        return new StandardMarkFacet({
            reference: reference.toJSON(),
            payload
        });
    };

    const createExitFacet = (reference: StandardReference, description?: string): StandardExitFacet => {
        const payload: ExitPayload = description;
        return new StandardExitFacet({
            reference: reference.toJSON(),
            payload
        });
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
                const originalWML = deIndentWML(`<Room key=(room1)><Position {10, 20} /></Room>`);
                const facet = new StandardPositionFacet(originalWML);
                
                // Payload is now a class instance - access properties via toJSON()
                const positionFacet = facet as StandardPositionFacet;
                const payload = positionFacet.payload.toJSON();
                // For plain payloads, toJSON() returns PositionPayload (no tag property)
                expect(payload).toEqual({ x: 10, y: 20 });
                
                const renderResult = facet.renderFacet();
                const generatedWML = renderResult.aggregatedNode 
                    ? schemaToWML([renderResult.aggregatedNode])
                    : schemaToWML([renderResult.newNode!]);
                expect(generatedWML).toEqual(originalWML);
            });

            it('should round-trip Position facet with uuid-based reference', () => {
                const originalWML = deIndentWML(`
                    <Room uuid=(test123)><Position {15, 25} /></Room>
                `);
                const facet = new StandardPositionFacet(originalWML);
                
                // Payload is now a class instance - access properties via toJSON()
                const positionFacet = facet as StandardPositionFacet;
                expect(positionFacet.payload.toJSON()).toEqual({ x: 15, y: 25 });
                
                const renderResult = facet.renderFacet();
                const generatedWML = renderResult.aggregatedNode 
                    ? schemaToWML([renderResult.aggregatedNode])
                    : schemaToWML([renderResult.newNode!]);
                expect(generatedWML).toEqual(originalWML);
            });
        });

        describe('MarkFacetPayload', () => {
            it('should round-trip Mark facet', () => {
                const originalWML = deIndentWML(`<Mark uuid=(test123)><Match>Condition text</Match></Mark>`);
                const facet = new StandardMarkFacet(originalWML);
                
                // Payload is now a class instance - use toJSON() to get the string value
                const markFacet = facet as StandardMarkFacet;
                expect(markFacet.payload.toJSON()).toBe('Condition text');
                
                const renderResult = facet.renderFacet();
                const generatedWML = renderResult.aggregatedNode 
                    ? schemaToWML([renderResult.aggregatedNode])
                    : schemaToWML([renderResult.newNode!]);
                expect(generatedWML).toEqual(originalWML);
            });

            it('should round-trip Mark facet with empty narrative', () => {
                const originalWML = deIndentWML(`<Mark uuid=(test456)><Match></Match></Mark>`);
                const facet = new StandardMarkFacet(originalWML);
                
                // Payload is now a class instance - use toJSON() to get the string value
                const markFacet = facet as StandardMarkFacet;
                expect(markFacet.payload.toJSON()).toBe('');
                
                const renderResult = facet.renderFacet();
                const generatedWML = renderResult.aggregatedNode 
                    ? schemaToWML([renderResult.aggregatedNode])
                    : schemaToWML([renderResult.newNode!]);
                expect(generatedWML).toEqual(originalWML);
            });
        });

        describe('ExitPayload', () => {
            it('should round-trip Exit facet with description', () => {
                const originalWML = deIndentWML(`<Exit to=(ROOM#target1)>North Exit</Exit>`);
                const facet = new StandardExitFacet(originalWML);
                
                // Payload is now a class instance - ExitPayload is a string, access via toJSON()
                const exitFacet = facet as StandardExitFacet;
                expect(exitFacet.payload.toJSON()).toBe('North Exit');
                
                const renderResult = facet.renderFacet();
                const generatedWML = renderResult.aggregatedNode 
                    ? schemaToWML([renderResult.aggregatedNode])
                    : schemaToWML([renderResult.newNode!]);
                expect(generatedWML).toEqual(originalWML);
            });

            it('should round-trip Exit facet without description', () => {
                const originalWML = deIndentWML(`<Exit to=(ROOM#target2) />`);
                const facet = new StandardExitFacet(originalWML);
                
                // Payload is now a class instance - ExitPayload is a string, access via toJSON()
                const exitFacet = facet as StandardExitFacet;
                expect(exitFacet.payload.toJSON()).toBeUndefined();
                
                const renderResult = facet.renderFacet();
                const generatedWML = renderResult.aggregatedNode 
                    ? schemaToWML([renderResult.aggregatedNode])
                    : schemaToWML([renderResult.newNode!]);
                expect(generatedWML).toEqual(originalWML);
            });
        });
    });

    describe('Parsing edge cases', () => {
        describe('PositionPayload', () => {
            it('should error when Position child is missing', () => {
                const wml = deIndentWML(`<Room key=(room1) />`);
                expect(() => new StandardPositionFacet(wml)).toThrow();
            });

        });

        describe('MarkFacetPayload', () => {
            it('should error when Match child is missing', () => {
                const wml = deIndentWML(`<Mark uuid=(test1) />`);
                expect(() => new StandardMarkFacet(wml)).toThrow();
            });

            it('should handle empty Match tag (empty narrative)', () => {
                const wml = deIndentWML(`
                    <Mark uuid=(test2)>
                        <Match></Match>
                    </Mark>
                `);
                const facet = new StandardMarkFacet(wml);
                const markFacet = facet as StandardMarkFacet;
                expect(markFacet.payload.toJSON()).toBe('');
            });

        });

        describe('ExitPayload', () => {
            it('should error when `to` property is missing', () => {
                const wml = deIndentWML(`<Exit>North</Exit>`);
                expect(() => new StandardExitFacet(wml)).toThrow();
            });

            it('should handle empty Exit tag content (undefined description)', () => {
                const wml = deIndentWML(`<Exit to=(ROOM#target1) />`);
                const facet = new StandardExitFacet(wml);
                const exitFacet = facet as StandardExitFacet;
                // ExitPayload is a string, access via toJSON()
                expect(exitFacet.payload.toJSON()).toBeUndefined();
            });

        });
    });

    describe('renderFacet() tests', () => {
        describe('PositionPayload.renderFacet()', () => {
            it('should enhance pre-existing Room render with Position child', () => {
                const reference = new StandardReference('ROOM#123', 'Room');
                const payload = new PositionFacetPayload({ x: 10, y: 20 });
                const roomRender = createMockRoomReference('room1', 'ROOM#123');
                roomRender.children.push({
                    data: { tag: 'ShortName' as const },
                    children: [{ data: { tag: 'String' as const, value: 'Test Room' }, children: [] }]
                });

                // Extract plain payload data from toJSON() (may be union type, but these are plain payloads)
                const payloadJSON = payload.toJSON();
                const payloadData: PositionPayload = ('tag' in payloadJSON && payloadJSON.tag !== undefined) 
                    ? (payloadJSON as any).match || (payloadJSON as any).payload 
                    : payloadJSON as PositionPayload;
                const result = payload.renderFacet(reference, payloadData, roomRender, undefined);

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
                const payload = new PositionFacetPayload({ x: 15, y: 25 });
                const payloadData = (payload as any).payload?.toJSON() ?? payload.toJSON() as PositionPayload;

                const result = payload.renderFacet(reference, payloadData, undefined, undefined);

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
                const payload = new PositionFacetPayload({ x: 50, y: 60 });
                const payloadData = (payload as any).payload?.toJSON() ?? payload.toJSON() as PositionPayload;

                const result1 = payload.renderFacet(reference, payloadData, undefined, undefined);
                expect(result1.aggregatedNode).toBeDefined();
                expect(result1.newNode).toBeUndefined();

                const roomRender = createMockRoomReference('room1', 'ROOM#789');
                const result2 = payload.renderFacet(reference, payloadData, roomRender, undefined);
                expect(result2.aggregatedNode).toBeDefined();
                expect(result2.newNode).toBeUndefined();
            });
        });

        describe('MarkFacetPayload.renderFacet()', () => {
            it('should enhance pre-existing Mark render with Match child', () => {
                const reference = new StandardReference('MARK#123', 'Mark');
                const payload = new MarkFacetPayload('Test condition');
                const markRender = createMockMarkReference('MARK#123');
                markRender.children.push({
                    data: { tag: 'ShortName' as const },
                    children: [{ data: { tag: 'String' as const, value: 'Test Mark' }, children: [] }]
                });

                // Extract plain payload data from toJSON() (may be union type, but these are plain payloads)
                const payloadJSON = payload.toJSON();
                const payloadData: string = (typeof payloadJSON === 'string') ? payloadJSON : '';
                const result = payload.renderFacet(reference, payloadData, markRender, undefined);

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
                const payload = new MarkFacetPayload('Another condition');
                const payloadData = (payload as any).payload?.data ?? payload.toJSON() as string;

                const result = payload.renderFacet(reference, payloadData, undefined, undefined);

                expect(result.aggregatedNode).toBeDefined();
                expect(result.newNode).toBeUndefined();

                const aggregatedNode = result.aggregatedNode!;
                expect(treeNodeTypeguard(isSchemaMark)(aggregatedNode)).toBe(true);
                const matchChild = aggregatedNode.children.find(treeNodeTypeguard(isSchemaMatch));
                expect(matchChild).toBeDefined();
            });

            it('should always return aggregatedNode (never newNode)', () => {
                const reference = new StandardReference('MARK#789', 'Mark');
                const payload = new MarkFacetPayload('Condition text');
                const payloadData = (payload as any).payload?.data ?? payload.toJSON() as string;

                const result1 = payload.renderFacet(reference, payloadData, undefined, undefined);
                expect(result1.aggregatedNode).toBeDefined();
                expect(result1.newNode).toBeUndefined();

                const markRender = createMockMarkReference('MARK#789');
                const result2 = payload.renderFacet(reference, payloadData, markRender, undefined);
                expect(result2.aggregatedNode).toBeDefined();
                expect(result2.newNode).toBeUndefined();
            });
        });

        describe('ExitPayload.renderFacet()', () => {
            it('should ignore referenceRender parameter', () => {
                const reference = new StandardReference('ROOM#123', 'Room');
                const payload = new ExitFacetPayload('North Exit');
                // Extract plain payload data from toJSON() (may be union type, but these are plain payloads)
                // For Exit facets, toJSON() converts empty string back to undefined
                const payloadJSON = payload.toJSON();
                const payloadData: string | undefined = (typeof payloadJSON === 'string' || payloadJSON === undefined) 
                    ? payloadJSON 
                    : undefined;
                const roomRender = createMockRoomReference('room1', 'ROOM#123');

                const result1 = payload.renderFacet(reference, payloadData, undefined, undefined);
                const result2 = payload.renderFacet(reference, payloadData, roomRender, undefined);

                // Both should return the same structure (referenceRender ignored)
                expect(result1.newNode).toBeDefined();
                expect(result2.newNode).toBeDefined();
                expect(result1.aggregatedNode).toBeUndefined();
                expect(result2.aggregatedNode).toBeUndefined();
            });

            it('should always return newNode (never aggregatedNode)', () => {
                const reference = new StandardReference('ROOM#456', 'Room');
                const payload = new ExitFacetPayload('East Exit');
                const payloadData = (payload as any).payload?.data ?? payload.toJSON() as string | undefined;

                const result1 = payload.renderFacet(reference, payloadData, undefined, undefined);
                expect(result1.newNode).toBeDefined();
                expect(result1.aggregatedNode).toBeUndefined();

                const roomRender = createMockRoomReference('room2', 'ROOM#456');
                const result2 = payload.renderFacet(reference, payloadData, roomRender, undefined);
                expect(result2.newNode).toBeDefined();
                expect(result2.aggregatedNode).toBeUndefined();
            });

            it('should include Exit tag with correct `to` property', () => {
                const reference = new StandardReference({ key: 'testRoom', universalKey: 'ROOM#123', tag: 'Room' });
                const payload = new ExitFacetPayload('West Exit');
                const payloadData = (payload as any).payload?.data ?? payload.toJSON() as string | undefined;

                const result = payload.renderFacet(reference, payloadData, undefined, undefined);

                const newNode = result.newNode!;
                expect(treeNodeTypeguard(isSchemaExit)(newNode)).toBe(true);
                if (newNode.data.tag === 'Exit') {
                    expect(newNode.data.to).toBeTruthy();
                }
            });

            it('should include description in Exit tag content', () => {
                const reference = new StandardReference('ROOM#789', 'Room');
                const payload = new ExitFacetPayload('South Exit');
                const payloadData = (payload as any).payload?.data ?? payload.toJSON() as string | undefined;

                const result = payload.renderFacet(reference, payloadData, undefined, undefined);

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
                // For Exit facets, undefined is converted to empty string for StandardLiteral compatibility
                const payload = new ExitFacetPayload('');
                // toJSON() converts empty string back to undefined for Exit facets
                const payloadData = payload.toJSON() as string | undefined;
                expect(payloadData).toBeUndefined();

                const result = payload.renderFacet(reference, payloadData, undefined, undefined);

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
            // Use diff() to create Replace operations (merge doesn't create Replace for plain values)
            const replaceFacet = matchFacet.diff(payloadFacet);

            expect(replaceFacet).toBeDefined();
            // Check that payload is a Replace operation via toJSON() structure
            const replacePayload = replaceFacet!.payload.toJSON();
            expect(typeof replacePayload === 'object' && replacePayload !== null && 'tag' in replacePayload && replacePayload.tag === 'Replace').toBe(true);

            const result = replaceFacet!.renderFacet();

            // Replace operations should return Room node wrapping Replace/With containing Position tags
            expect(result.aggregatedNode).toBeDefined();
            if (result.aggregatedNode) {
                expect(result.aggregatedNode.data.tag).toBe('Room');
                // Should have Replace child
                const replaceChild = result.aggregatedNode.children.find(child =>
                    treeNodeTypeguard(isSchemaReplace)(child)
                );
                expect(replaceChild).toBeDefined();
            }
        });

        it('should handle Replace operations with Mark facet', () => {
            const reference = new StandardReference('MARK#123', 'Mark');
            const matchFacet = createMarkFacet(reference, 'Old condition');
            const payloadFacet = createMarkFacet(reference, 'New condition');
            // Use diff() to create Replace operations (merge doesn't create Replace for plain values)
            const replaceFacet = matchFacet.diff(payloadFacet);

            expect(replaceFacet).toBeDefined();
            // Check that payload is a Replace operation via toJSON() structure
            const replacePayload = replaceFacet!.payload.toJSON();
            expect(typeof replacePayload === 'object' && replacePayload !== null && 'tag' in replacePayload && replacePayload.tag === 'Replace').toBe(true);

            const result = replaceFacet!.renderFacet();

            // Replace operations should return Mark node wrapping Replace/With containing Match tags
            expect(result.aggregatedNode).toBeDefined();
            if (result.aggregatedNode) {
                expect(result.aggregatedNode.data.tag).toBe('Mark');
                // Should have Replace child
                const replaceChild = result.aggregatedNode.children.find(child =>
                    treeNodeTypeguard(isSchemaReplace)(child)
                );
                expect(replaceChild).toBeDefined();
            }
        });

        it('should handle Replace operations with Exit facet', () => {
            const reference = new StandardReference('ROOM#123', 'Room');
            const matchFacet = createExitFacet(reference, 'Old exit');
            const payloadFacet = createExitFacet(reference, 'New exit');
            // Use diff() to create Replace operations (merge doesn't create Replace for plain values)
            const replaceFacet = matchFacet.diff(payloadFacet);

            expect(replaceFacet).toBeDefined();
            // Check that payload is a Replace operation via toJSON() structure
            const replacePayload = replaceFacet!.payload.toJSON();
            expect(typeof replacePayload === 'object' && replacePayload !== null && 'tag' in replacePayload && replacePayload.tag === 'Replace').toBe(true);

            const result = replaceFacet!.renderFacet();

            // Exit facets with Replace should return Room node wrapping Replace/With containing Exit tags
            expect(result.aggregatedNode).toBeDefined();
            if (result.aggregatedNode) {
                expect(result.aggregatedNode.data.tag).toBe('Room');
                // Should have Replace child
                const replaceChild = result.aggregatedNode.children.find(child =>
                    treeNodeTypeguard(isSchemaReplace)(child)
                );
                expect(replaceChild).toBeDefined();
            }
        });

        it('should handle Replace operations with referenceRender for Position facet', () => {
            const reference = new StandardReference('ROOM#123', 'Room');
            const matchFacet = createPositionFacet(reference, 5, 10);
            const payloadFacet = createPositionFacet(reference, 15, 20);
            // Use diff() to create Replace operations (merge doesn't create Replace for plain values)
            const replaceFacet = matchFacet.diff(payloadFacet);

            const roomRender = createMockRoomReference('room1', 'ROOM#123');
            const result = replaceFacet!.renderFacet(roomRender);

            // Replace operations should return Room node (from referenceRender) wrapping Replace/With containing Position tags
            expect(result.aggregatedNode).toBeDefined();
            if (result.aggregatedNode) {
                expect(result.aggregatedNode.data.tag).toBe('Room');
                // Should have Replace child
                const replaceChild = result.aggregatedNode.children.find(child =>
                    treeNodeTypeguard(isSchemaReplace)(child)
                );
                expect(replaceChild).toBeDefined();
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

        describe('Mock Situation component with Mark facets', () => {
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

        it('should handle Situations with Mark references but no facet payloads', () => {
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
