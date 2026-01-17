import { PositionFacetPlainClass, PositionEditableClass, PositionPlainClass, PositionRemoveClass, PositionReplaceClass, isStandardPositionPayloadData } from '../position';
import type { PositionPayload as PositionPayloadType } from './facet';
import { StandardReference } from '../../reference';
import { treeFromWML } from '../../../../schema';
import { deIndentWML } from '../../../../schema/utils';
import { treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree";
import { isSchemaRoom, isSchemaPosition } from "@tonylb/mtw-base/ts/schema/components";
import { StandardEditableData } from "@tonylb/mtw-base/ts/editable";

describe('PositionFacetPlainClass - StandardEditablePayload implementation', () => {
    describe('constructor and basic operations', () => {
        it('should create PositionFacetPlainClass from valid data', () => {
            const data: PositionPayloadType = {
                x: 10,
                y: 20
            };
            const payload = new PositionFacetPlainClass(data);
            expect(payload.toJSON()).toEqual(data);
        });

        it('should clone correctly', () => {
            const data: PositionPayloadType = {
                x: 10,
                y: 20
            };
            const payload = new PositionFacetPlainClass(data);
            const cloned = payload.clone();
            expect(cloned).not.toBe(payload);
            expect(cloned.toJSON()).toEqual(data);
        });

        it('should return correct JSON', () => {
            const data: PositionPayloadType = {
                x: 15,
                y: 25
            };
            const payload = new PositionFacetPlainClass(data);
            expect(payload.toJSON()).toEqual(data);
        });

        it('should generate Position tag schema', () => {
            const data: PositionPayloadType = {
                x: 10,
                y: 20
            };
            const payload = new PositionFacetPlainClass(data);
            const schema = payload.schema;
            expect(schema.length).toBe(1);
            expect(schema[0].data.tag).toBe('Position');
            if (schema[0].data.tag === 'Position') {
                expect(schema[0].data.x).toBe(10);
                expect(schema[0].data.y).toBe(20);
            }
        });
    });

    describe('v2StandardEditableFactory (via StandardPositionPayload)', () => {
        it('should create from plain payload data', () => {
            const data: PositionPayloadType = {
                x: 10,
                y: 20
            };
            // Use PositionEditableClass.create() to dispatch to correct class
            const instance = PositionEditableClass.create(data);
            expect(instance).toBeInstanceOf(PositionPlainClass);
            expect(instance.toJSON()).toEqual(data);
        });

        it('should create from Position tag schema', () => {
            const schema = treeFromWML(deIndentWML('<Position {10, 20} />'));
            const instance = PositionEditableClass.create(schema);
            expect(instance).toBeInstanceOf(PositionPlainClass);
            expect(instance.toJSON()).toEqual({ x: 10, y: 20 });
        });

        it('should create from Remove structure', () => {
            const removeData: StandardEditableData<PositionPayloadType> = {
                tag: 'Remove',
                match: {
                    x: 10,
                    y: 20
                }
            };
            const instance = PositionEditableClass.create(removeData);
            expect(instance).toBeInstanceOf(PositionRemoveClass);
            const removeInstance = instance as any;
            expect(removeInstance.match?.toJSON()).toEqual({ x: 10, y: 20 });
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
            const instance = PositionEditableClass.create(replaceData);
            expect(instance).toBeInstanceOf(PositionReplaceClass);
            const replaceInstance = instance as any;
            expect(replaceInstance.match?.toJSON()).toEqual({ x: 10, y: 20 });
            expect(replaceInstance.payload?.toJSON()).toEqual({ x: 30, y: 40 });
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

    describe('v2 merge operations', () => {
        it('should merge with Replace semantics (incoming wins)', () => {
            const base: PositionPayloadType = {
                x: 10,
                y: 20
            };
            const incoming: PositionPayloadType = {
                x: 30,
                y: 40
            };
            const baseInstance = PositionEditableClass.create(base);
            const incomingInstance = PositionEditableClass.create(incoming);
            const merged = baseInstance.merge(incomingInstance);
            expect(merged).toBeInstanceOf(PositionPlainClass);
            expect(merged?.toJSON()).toEqual({ x: 30, y: 40 });
        });

        it('should cancel when removing same payload', () => {
            const payload: PositionPayloadType = {
                x: 10,
                y: 20
            };
            const addInstance = PositionEditableClass.create(payload);
            const removeInstance = PositionEditableClass.create({
                tag: 'Remove',
                match: payload
            } as StandardEditableData<PositionPayloadType>);
            const merged = addInstance.merge(removeInstance);
            expect(merged).toBeUndefined();
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
            const baseInstance = PositionEditableClass.create(base);
            const incomingInstance = PositionEditableClass.create(incoming);
            const merged = baseInstance.merge(incomingInstance);
            // When payloads differ, merge returns the incoming (Replace semantics)
            expect(merged).toBeInstanceOf(PositionPlainClass);
            expect(merged?.toJSON()).toEqual({ x: 30, y: 40 });
        });
    });

    describe('v2 diff operations', () => {
        it('should return undefined when payloads are same', () => {
            const payload: PositionPayloadType = {
                x: 10,
                y: 20
            };
            const baseInstance = PositionEditableClass.create(payload);
            const incomingInstance = PositionEditableClass.create(payload);
            const diffResult = baseInstance.diff(incomingInstance);
            expect(diffResult).toBeUndefined();
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
            const baseInstance = PositionEditableClass.create(base);
            const incomingInstance = PositionEditableClass.create(incoming);
            const diffResult = baseInstance.diff(incomingInstance);
            expect(diffResult).toBeInstanceOf(PositionReplaceClass);
            const replaceInstance = diffResult as any;
            expect(replaceInstance.match?.toJSON()).toEqual({ x: 10, y: 20 });
            expect(replaceInstance.payload?.toJSON()).toEqual({ x: 30, y: 40 });
        });
    });
});

describe('PositionFacetPlainClass - FacetPayloadBase implementation', () => {
    describe('fromSchema', () => {
        it('should parse Room with Position child (with key and uuid)', () => {
            const schema = treeFromWML(deIndentWML('<Room key=(testRoom) uuid=(ROOM#123)><Position {10, 20} /></Room>'));
            const reference = new StandardReference('ROOM#123', 'Room');
            const payload = new PositionFacetPlainClass({ x: 0, y: 0 });
            const result = payload.fromSchema(schema, reference);
            expect(result.x).toBe(10);
            expect(result.y).toBe(20);
        });

        it('should parse Room with Position child (uuid only)', () => {
            const schema = treeFromWML(deIndentWML('<Room uuid=(ROOM#123)><Position {15, 25} /></Room>'));
            const reference = new StandardReference('ROOM#123', 'Room');
            const payload = new PositionFacetPlainClass({ x: 0, y: 0 });
            const result = payload.fromSchema(schema, reference);
            expect(result.x).toBe(15);
            expect(result.y).toBe(25);
        });

        it('should throw error when Position child is missing', () => {
            const schema = treeFromWML(deIndentWML('<Room uuid=(ROOM#123) />'));
            const reference = new StandardReference('ROOM#123', 'Room');
            const payload = new PositionFacetPlainClass({ x: 0, y: 0 });
            expect(() => payload.fromSchema(schema, reference)).toThrow('Invalid schema: Position child not found');
        });

        it('should throw error when Room tag is missing', () => {
            const schema = treeFromWML(deIndentWML('<Position {10, 20} />'));
            const reference = new StandardReference('ROOM#123', 'Room');
            const payload = new PositionFacetPlainClass({ x: 0, y: 0 });
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
            const payload = new PositionFacetPlainClass(payloadData);
            const roomSchema = treeFromWML(deIndentWML(`
                <Room uuid=(ROOM#123)>
                    <ShortName>Test Room</ShortName>
                    <Feature key=(testFeature) />
                </Room>
            `))[0];
            const result = payload.renderFacet(reference, payloadData, roomSchema, undefined);
            
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
            const payload = new PositionFacetPlainClass(payloadData);
            const result = payload.renderFacet(reference, payloadData, undefined, undefined);
            
            // Should return aggregatedNode (not newNode)
            expect(result.aggregatedNode).toBeDefined();
            expect(result.newNode).toBeUndefined();
            
            // Verify aggregatedNode contains plain Room tag with Position child
            const aggregatedNode = result.aggregatedNode!;
            expect(treeNodeTypeguard(isSchemaRoom)(aggregatedNode)).toBe(true);
            if (aggregatedNode.data.tag === 'Room') {
                expect(aggregatedNode.data.key).toBe('testRoom');
                expect(aggregatedNode.data.uuid).toBeUndefined();
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
            const payload = new PositionFacetPlainClass(payloadData);
            const result = payload.renderFacet(reference, payloadData, undefined, undefined);
            
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
            const payload = new PositionFacetPlainClass(payloadData);
            
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
            const payload = new PositionFacetPlainClass(payloadData);
            const featureSchema = treeFromWML(deIndentWML('<Feature uuid=(FEATURE#123) />'))[0];
            expect(() => payload.renderFacet(reference, payloadData, featureSchema, undefined)).toThrow('Invalid referenceRender: expected Room tag');
        });

        it('should add Position as first child when referenceRender provided', () => {
            const reference = new StandardReference('ROOM#123', 'Room');
            const payloadData: PositionPayloadType = {
                x: 100,
                y: 200
            };
            const payload = new PositionFacetPlainClass(payloadData);
            const roomSchema = treeFromWML(deIndentWML('<Room uuid=(ROOM#123)><ShortName>Room</ShortName></Room>'))[0];
            const result = payload.renderFacet(reference, payloadData, roomSchema, undefined);
            
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
