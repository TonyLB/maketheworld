import { PositionPayload, factory, isStandardPositionPayloadData, merge, diff } from '../position';
import type { PositionPayload as PositionPayloadType } from './facet';
import { StandardReference } from '../../reference';
import { treeFromWML } from '../../../../schema';
import { deIndentWML } from '../../../../schema/utils';
import { treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree";
import { isSchemaRoom, isSchemaPosition } from "@tonylb/mtw-base/ts/schema/components";
import { StandardEditableData } from "@tonylb/mtw-base/ts/editable";

describe('PositionPayload - StandardEditablePayload implementation', () => {
    describe('constructor and basic operations', () => {
        it('should create PositionPayload from valid data', () => {
            const data: PositionPayloadType = {
                x: 10,
                y: 20
            };
            const payload = new PositionPayload(data);
            expect(payload.x).toBe(10);
            expect(payload.y).toBe(20);
        });

        it('should clone correctly', () => {
            const data: PositionPayloadType = {
                x: 10,
                y: 20
            };
            const payload = new PositionPayload(data);
            const cloned = payload.clone();
            expect(cloned).not.toBe(payload);
            const clonedPayload = cloned as PositionPayload;
            expect(clonedPayload.x).toBe(10);
            expect(clonedPayload.y).toBe(20);
            expect(cloned.toJSON()).toEqual(data);
        });

        it('should return correct JSON', () => {
            const data: PositionPayloadType = {
                x: 15,
                y: 25
            };
            const payload = new PositionPayload(data);
            expect(payload.toJSON()).toEqual(data);
        });

        it('should generate Position tag schema', () => {
            const data: PositionPayloadType = {
                x: 10,
                y: 20
            };
            const payload = new PositionPayload(data);
            const schema = payload.schema;
            expect(schema.length).toBe(1);
            expect(schema[0].data.tag).toBe('Position');
            if (schema[0].data.tag === 'Position') {
                expect(schema[0].data.x).toBe(10);
                expect(schema[0].data.y).toBe(20);
            }
        });
    });

    describe('StandardEditable factory', () => {
        it('should create from plain payload data', () => {
            const data: PositionPayloadType = {
                x: 10,
                y: 20
            };
            const delta = factory(data);
            expect(delta).toBeDefined();
            expect(delta?.add).toBeDefined();
            if (delta?.add) {
                const payloadData = delta.add.toJSON();
                expect(payloadData.x).toBe(10);
                expect(payloadData.y).toBe(20);
            }
        });

        it('should create from Position tag schema', () => {
            const schema = treeFromWML(deIndentWML('<Position x="10" y="20" />'));
            const delta = factory(schema);
            expect(delta).toBeDefined();
            expect(delta?.add).toBeDefined();
            if (delta?.add) {
                const payloadData = delta.add.toJSON();
                expect(payloadData.x).toBe(10);
                expect(payloadData.y).toBe(20);
            }
        });

        it('should create from Remove structure', () => {
            const removeData: StandardEditableData<PositionPayloadType> = {
                tag: 'Remove',
                match: {
                    x: 10,
                    y: 20
                }
            };
            const delta = factory(removeData);
            expect(delta).toBeDefined();
            expect(delta?.remove).toBeDefined();
            if (delta?.remove) {
                const payloadData = delta.remove.toJSON();
                expect(payloadData.x).toBe(10);
                expect(payloadData.y).toBe(20);
            }
        });

        it('should create from Replace structure', () => {
            const replaceData: StandardEditableData<PositionPayloadType> = {
                tag: 'Replace',
                match: {
                    x: 10,
                    y: 20
                },
                payload: {
                    x: 30,
                    y: 40
                }
            };
            const delta = factory(replaceData);
            expect(delta).toBeDefined();
            expect(delta?.remove).toBeDefined();
            expect(delta?.add).toBeDefined();
            if (delta?.remove && delta?.add) {
                const removeData = delta.remove.toJSON();
                const addData = delta.add.toJSON();
                expect(removeData.x).toBe(10);
                expect(removeData.y).toBe(20);
                expect(addData.x).toBe(30);
                expect(addData.y).toBe(40);
            }
        });

        it('should validate typeguard correctly', () => {
            const valid: PositionPayloadType = {
                x: 10,
                y: 20
            };
            expect(isStandardPositionPayloadData(valid)).toBe(true);

            const invalid = {
                narrative: 'test'
            };
            expect(isStandardPositionPayloadData(invalid)).toBe(false);
        });
    });

    describe('StandardEditable merge operations', () => {
        it('should merge with Replace semantics (incoming wins)', () => {
            const base: PositionPayloadType = {
                x: 10,
                y: 20
            };
            const incoming: PositionPayloadType = {
                x: 30,
                y: 40
            };
            const baseDelta = factory(base);
            const incomingDelta = factory(incoming);
            // Use type assertion to handle generic type constraints
            const merged = merge(baseDelta as any, incomingDelta as any) as any;
            if (merged?.add) {
                // merge returns StandardEditableDataDelta<PayloadDataType<PositionPayload>>,
                // which is { add?: { x, y }, remove?: { x, y } } - plain data types, not class instances
                const payloadData = merged.add as PositionPayloadType;
                expect(payloadData.x).toBe(30);
                expect(payloadData.y).toBe(40);
            }
        });

        it('should cancel when removing same payload', () => {
            const payload: PositionPayloadType = {
                x: 10,
                y: 20
            };
            const addDelta = factory(payload);
            const removeDelta = factory({
                tag: 'Remove',
                match: payload
            } as StandardEditableData<PositionPayloadType>);
            const merged = merge(addDelta as any, removeDelta as any) as any;
            expect(merged).toEqual({ add: undefined, remove: undefined });
        });

        it('should create Replace when payloads differ during merge', () => {
            const base: PositionPayloadType = {
                x: 10,
                y: 20
            };
            const incoming: PositionPayloadType = {
                x: 30,
                y: 40
            };
            const baseDelta = factory(base);
            const incomingDelta = factory(incoming);
            const merged = merge(baseDelta as any, incomingDelta as any) as any;
            // When base is added and incoming is added, and they differ, should keep incoming
            if (merged?.add) {
                // merge returns StandardEditableDataDelta<PayloadDataType<PositionPayload>>,
                // which is { add?: { x, y }, remove?: { x, y } } - plain data types, not class instances
                const payloadData = merged.add as PositionPayloadType;
                expect(payloadData.x).toBe(30);
                expect(payloadData.y).toBe(40);
            }
        });
    });

    describe('StandardEditable diff operations', () => {
        it('should return empty when payloads are same', () => {
            const payload: PositionPayloadType = {
                x: 10,
                y: 20
            };
            const baseDelta = factory(payload);
            const incomingDelta = factory(payload);
            const diffResult = diff(baseDelta as any, incomingDelta as any) as any;
            expect(diffResult).toEqual({ add: undefined, remove: undefined });
        });

        it('should create Replace when payloads differ', () => {
            const base: PositionPayloadType = {
                x: 10,
                y: 20
            };
            const incoming: PositionPayloadType = {
                x: 30,
                y: 40
            };
            const baseDelta = factory(base);
            const incomingDelta = factory(incoming);
            const diffResult = diff(baseDelta as any, incomingDelta as any) as any;
            if (diffResult?.remove && diffResult?.add) {
                // diff returns StandardEditableDataDelta<PayloadDataType<PositionPayload>>,
                // which is { add?: { x, y }, remove?: { x, y } } - plain data types, not class instances
                const removeData = diffResult.remove as PositionPayloadType;
                const addData = diffResult.add as PositionPayloadType;
                expect(removeData.x).toBe(10);
                expect(removeData.y).toBe(20);
                expect(addData.x).toBe(30);
                expect(addData.y).toBe(40);
            }
        });
    });
});

describe('PositionPayload - FacetPayloadBase implementation', () => {
    describe('fromSchema', () => {
        it('should parse Room with Position child (with key and uuid)', () => {
            const schema = treeFromWML(deIndentWML('<Room key=(testRoom) uuid=(ROOM#123)><Position x="10" y="20" /></Room>'));
            const reference = new StandardReference('ROOM#123', 'Room');
            const payload = new PositionPayload({ x: 0, y: 0 });
            const result = payload.fromSchema(schema, reference);
            expect(result.x).toBe(10);
            expect(result.y).toBe(20);
        });

        it('should parse Room with Position child (uuid only)', () => {
            const schema = treeFromWML(deIndentWML('<Room uuid=(ROOM#123)><Position x="15" y="25" /></Room>'));
            const reference = new StandardReference('ROOM#123', 'Room');
            const payload = new PositionPayload({ x: 0, y: 0 });
            const result = payload.fromSchema(schema, reference);
            expect(result.x).toBe(15);
            expect(result.y).toBe(25);
        });

        it('should throw error when Position child is missing', () => {
            const schema = treeFromWML(deIndentWML('<Room uuid=(ROOM#123) />'));
            const reference = new StandardReference('ROOM#123', 'Room');
            const payload = new PositionPayload({ x: 0, y: 0 });
            expect(() => payload.fromSchema(schema, reference)).toThrow('Invalid schema: Position child not found');
        });

        it('should throw error when Room tag is missing', () => {
            const schema = treeFromWML(deIndentWML('<Position x="10" y="20" />'));
            const reference = new StandardReference('ROOM#123', 'Room');
            const payload = new PositionPayload({ x: 0, y: 0 });
            expect(() => payload.fromSchema(schema, reference)).toThrow('Invalid schema: Room tag not found');
        });
    });

    describe('renderFacet', () => {
        it('should render with pre-existing Room render', () => {
            const reference = new StandardReference('ROOM#123', 'Room');
            const payloadData: PositionPayloadType = {
                x: 10,
                y: 20
            };
            const payload = new PositionPayload(payloadData);
            const roomSchema = treeFromWML(deIndentWML(`
                <Room uuid=(ROOM#123)>
                    <ShortName>Test Room</ShortName>
                    <Feature key=(testFeature) />
                </Room>
            `))[0];
            const result = payload.renderFacet(reference, payloadData, roomSchema);
            
            // Should return aggregatedNode (not newNode)
            expect(result.aggregatedNode).toBeDefined();
            expect(result.newNode).toBeUndefined();
            
            // Verify aggregatedNode is enhanced Room with Position child
            const aggregatedNode = result.aggregatedNode!;
            expect(treeNodeTypeguard(isSchemaRoom)(aggregatedNode)).toBe(true);
            const positionChild = aggregatedNode.children.find(treeNodeTypeguard(isSchemaPosition));
            expect(positionChild).toBeDefined();
            if (positionChild && positionChild.data.tag === 'Position') {
                expect(positionChild.data.x).toBe(10);
                expect(positionChild.data.y).toBe(20);
            }
            
            // Verify existing children are preserved
            expect(aggregatedNode.children.length).toBeGreaterThan(1);
            const hasShortName = aggregatedNode.children.some(child => child.data.tag === 'ShortName');
            expect(hasShortName).toBe(true);
            const hasFeature = aggregatedNode.children.some(child => child.data.tag === 'Feature');
            expect(hasFeature).toBe(true);
        });

        it('should render without reference render (plain Room tag)', () => {
            const reference = new StandardReference({ key: 'testRoom', universalKey: 'ROOM#123', tag: 'Room' });
            const payloadData: PositionPayloadType = {
                x: 15,
                y: 25
            };
            const payload = new PositionPayload(payloadData);
            const result = payload.renderFacet(reference, payloadData);
            
            // Should return aggregatedNode (not newNode)
            expect(result.aggregatedNode).toBeDefined();
            expect(result.newNode).toBeUndefined();
            
            // Verify aggregatedNode contains plain Room tag with Position child
            const aggregatedNode = result.aggregatedNode!;
            expect(treeNodeTypeguard(isSchemaRoom)(aggregatedNode)).toBe(true);
            if (aggregatedNode.data.tag === 'Room') {
                expect(aggregatedNode.data.key).toBe('testRoom');
                expect(aggregatedNode.data.uuid).toBe('ROOM#123');
            }
            const positionChild = aggregatedNode.children.find(treeNodeTypeguard(isSchemaPosition));
            expect(positionChild).toBeDefined();
            if (positionChild && positionChild.data.tag === 'Position') {
                expect(positionChild.data.x).toBe(15);
                expect(positionChild.data.y).toBe(25);
            }
        });

        it('should render without reference render (uuid only)', () => {
            const reference = new StandardReference('ROOM#456', 'Room');
            const payloadData: PositionPayloadType = {
                x: 30,
                y: 40
            };
            const payload = new PositionPayload(payloadData);
            const result = payload.renderFacet(reference, payloadData);
            
            // Should return aggregatedNode (not newNode)
            expect(result.aggregatedNode).toBeDefined();
            expect(result.newNode).toBeUndefined();
            
            // Verify aggregatedNode contains Room tag with Position child
            const aggregatedNode = result.aggregatedNode!;
            expect(treeNodeTypeguard(isSchemaRoom)(aggregatedNode)).toBe(true);
            if (aggregatedNode.data.tag === 'Room') {
                expect(aggregatedNode.data.uuid).toBe('ROOM#456');
            }
            const positionChild = aggregatedNode.children.find(treeNodeTypeguard(isSchemaPosition));
            if (positionChild && positionChild.data.tag === 'Position') {
                expect(positionChild.data.x).toBe(30);
                expect(positionChild.data.y).toBe(40);
            }
        });

        it('should always return aggregatedNode (never newNode)', () => {
            const reference = new StandardReference('ROOM#789', 'Room');
            const payloadData: PositionPayloadType = {
                x: 50,
                y: 60
            };
            const payload = new PositionPayload(payloadData);
            
            // Test without referenceRender
            const result1 = payload.renderFacet(reference, payloadData);
            expect(result1.aggregatedNode).toBeDefined();
            expect(result1.newNode).toBeUndefined();
            
            // Test with referenceRender
            const roomSchema = treeFromWML(deIndentWML('<Room uuid=(ROOM#789)><ShortName>Room</ShortName></Room>'))[0];
            const result2 = payload.renderFacet(reference, payloadData, roomSchema);
            expect(result2.aggregatedNode).toBeDefined();
            expect(result2.newNode).toBeUndefined();
        });

        it('should throw error when referenceRender is not a Room', () => {
            const reference = new StandardReference('ROOM#123', 'Room');
            const payloadData: PositionPayloadType = {
                x: 10,
                y: 20
            };
            const payload = new PositionPayload(payloadData);
            const featureSchema = treeFromWML(deIndentWML('<Feature uuid=(FEATURE#123) />'))[0];
            expect(() => payload.renderFacet(reference, payloadData, featureSchema)).toThrow('Invalid referenceRender: expected Room tag');
        });

        it('should add Position as first child when referenceRender provided', () => {
            const reference = new StandardReference('ROOM#123', 'Room');
            const payloadData: PositionPayloadType = {
                x: 100,
                y: 200
            };
            const payload = new PositionPayload(payloadData);
            const roomSchema = treeFromWML(deIndentWML('<Room uuid=(ROOM#123)><ShortName>Room</ShortName></Room>'))[0];
            const result = payload.renderFacet(reference, payloadData, roomSchema);
            
            const aggregatedNode = result.aggregatedNode!;
            // Position should be first child
            expect(aggregatedNode.children[0].data.tag).toBe('Position');
            if (aggregatedNode.children[0].data.tag === 'Position') {
                expect(aggregatedNode.children[0].data.x).toBe(100);
                expect(aggregatedNode.children[0].data.y).toBe(200);
            }
            // Other children should follow
            expect(aggregatedNode.children.length).toBe(2);
            expect(aggregatedNode.children[1].data.tag).toBe('ShortName');
        });
    });
});
