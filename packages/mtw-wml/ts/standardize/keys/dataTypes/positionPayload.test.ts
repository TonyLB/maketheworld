import { PositionPayload, factory, isStandardPositionPayloadData, merge, diff } from './positionPayload';
import type { PositionPayload as PositionPayloadType } from './facet';
import { FacetPayloadBase } from './facetPayloadBase';
import { StandardReference } from '../reference';
import { Schema, treeFromWML } from '../../../schema';
import { deIndentWML } from '../../../schema/utils';
import { GenericTree } from "@tonylb/mtw-base/ts/genericTree";
import { treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree";
import { SchemaTag } from "@tonylb/mtw-base/ts/schema";
import { isSchemaRoom, isSchemaPosition } from "@tonylb/mtw-base/ts/schema/components";
import { StandardEditableData } from "@tonylb/mtw-base/ts/editable";

describe('PositionPayload - StandardEditablePayload implementation', () => {
    describe('constructor and basic operations', () => {
        it('should create PositionPayload from valid data', () => {
            const data: PositionPayloadType = {
                type: 'PositionFacet',
                x: 10,
                y: 20
            };
            const payload = new PositionPayload(data);
            expect(payload.x).toBe(10);
            expect(payload.y).toBe(20);
        });

        it('should clone correctly', () => {
            const data: PositionPayloadType = {
                type: 'PositionFacet',
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
                type: 'PositionFacet',
                x: 15,
                y: 25
            };
            const payload = new PositionPayload(data);
            expect(payload.toJSON()).toEqual(data);
        });

        it('should generate Position tag schema', () => {
            const data: PositionPayloadType = {
                type: 'PositionFacet',
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
                type: 'PositionFacet',
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
                    type: 'PositionFacet',
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
                    type: 'PositionFacet',
                    x: 10,
                    y: 20
                },
                payload: {
                    type: 'PositionFacet',
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
                type: 'PositionFacet',
                x: 10,
                y: 20
            };
            expect(isStandardPositionPayloadData(valid)).toBe(true);

            const invalid = {
                type: 'MarkFacet',
                narrative: 'test'
            };
            expect(isStandardPositionPayloadData(invalid)).toBe(false);
        });
    });

    describe('StandardEditable merge operations', () => {
        it('should merge with Replace semantics (incoming wins)', () => {
            const base: PositionPayloadType = {
                type: 'PositionFacet',
                x: 10,
                y: 20
            };
            const incoming: PositionPayloadType = {
                type: 'PositionFacet',
                x: 30,
                y: 40
            };
            const baseDelta = factory(base);
            const incomingDelta = factory(incoming);
            // Use type assertion to handle generic type constraints
            const merged = merge(baseDelta as any, incomingDelta as any) as any;
            if (merged?.add) {
                const payload = merged.add as PositionPayload;
                const payloadData = payload.toJSON();
                expect(payloadData.x).toBe(30);
                expect(payloadData.y).toBe(40);
            }
        });

        it('should cancel when removing same payload', () => {
            const payload: PositionPayloadType = {
                type: 'PositionFacet',
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
                type: 'PositionFacet',
                x: 10,
                y: 20
            };
            const incoming: PositionPayloadType = {
                type: 'PositionFacet',
                x: 30,
                y: 40
            };
            const baseDelta = factory(base);
            const incomingDelta = factory(incoming);
            const merged = merge(baseDelta as any, incomingDelta as any) as any;
            // When base is added and incoming is added, and they differ, should keep incoming
            if (merged?.add) {
                const payload = merged.add as PositionPayload;
                const payloadData = payload.toJSON();
                expect(payloadData.x).toBe(30);
                expect(payloadData.y).toBe(40);
            }
        });
    });

    describe('StandardEditable diff operations', () => {
        it('should return empty when payloads are same', () => {
            const payload: PositionPayloadType = {
                type: 'PositionFacet',
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
                type: 'PositionFacet',
                x: 10,
                y: 20
            };
            const incoming: PositionPayloadType = {
                type: 'PositionFacet',
                x: 30,
                y: 40
            };
            const baseDelta = factory(base);
            const incomingDelta = factory(incoming);
            const diffResult = diff(baseDelta as any, incomingDelta as any) as any;
            if (diffResult?.remove && diffResult?.add) {
                const removePayload = diffResult.remove as PositionPayload;
                const addPayload = diffResult.add as PositionPayload;
                const removeData = removePayload.toJSON();
                const addData = addPayload.toJSON();
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
            const payload = new PositionPayload({ type: 'PositionFacet', x: 0, y: 0 });
            const result = payload.fromSchema(schema, reference);
            expect(result.x).toBe(10);
            expect(result.y).toBe(20);
            expect(result.type).toBe('PositionFacet');
        });

        it('should parse Room with Position child (uuid only)', () => {
            const schema = treeFromWML(deIndentWML('<Room uuid=(ROOM#123)><Position x="15" y="25" /></Room>'));
            const reference = new StandardReference('ROOM#123', 'Room');
            const payload = new PositionPayload({ type: 'PositionFacet', x: 0, y: 0 });
            const result = payload.fromSchema(schema, reference);
            expect(result.x).toBe(15);
            expect(result.y).toBe(25);
        });

        it('should throw error when Position child is missing', () => {
            const schema = treeFromWML(deIndentWML('<Room uuid=(ROOM#123) />'));
            const reference = new StandardReference('ROOM#123', 'Room');
            const payload = new PositionPayload({ type: 'PositionFacet', x: 0, y: 0 });
            expect(() => payload.fromSchema(schema, reference)).toThrow('Invalid schema: Position child not found');
        });

        it('should throw error when Room tag is missing', () => {
            const schema = treeFromWML(deIndentWML('<Position x="10" y="20" />'));
            const reference = new StandardReference('ROOM#123', 'Room');
            const payload = new PositionPayload({ type: 'PositionFacet', x: 0, y: 0 });
            expect(() => payload.fromSchema(schema, reference)).toThrow('Invalid schema: Room tag not found');
        });
    });

    describe('schema (FacetPayloadBase)', () => {
        it('should generate Room+Position schema from reference with key and uuid', () => {
            const reference = new StandardReference({ key: 'testRoom', universalKey: 'ROOM#123', tag: 'Room' });
            const payloadData: PositionPayloadType = {
                type: 'PositionFacet',
                x: 10,
                y: 20
            };
            const payload = new PositionPayload(payloadData);
            // Call _facetSchema directly (since schema is a getter, not a method)
            const schema = (payload as any)._facetSchema(reference, payloadData);
            expect(schema.length).toBe(1);
            const roomNode = schema[0];
            expect(treeNodeTypeguard(isSchemaRoom)(roomNode)).toBe(true);
            if (roomNode.data.tag === 'Room') {
                expect(roomNode.data.key).toBe('testRoom');
                expect(roomNode.data.uuid).toBe('ROOM#123');
            }
            const positionChild = roomNode.children.find(treeNodeTypeguard(isSchemaPosition));
            expect(positionChild).toBeDefined();
            if (positionChild && positionChild.data.tag === 'Position') {
                expect(positionChild.data.x).toBe(10);
                expect(positionChild.data.y).toBe(20);
            }
        });

        it('should generate Room+Position schema from reference with uuid only', () => {
            const reference = new StandardReference('ROOM#123', 'Room');
            const payloadData: PositionPayloadType = {
                type: 'PositionFacet',
                x: 15,
                y: 25
            };
            const payload = new PositionPayload(payloadData);
            // Call _facetSchema directly (since schema is a getter, not a method)
            const schema = (payload as any)._facetSchema(reference, payloadData);
            expect(schema.length).toBe(1);
            const roomNode = schema[0];
            expect(treeNodeTypeguard(isSchemaRoom)(roomNode)).toBe(true);
            if (roomNode.data.tag === 'Room') {
                expect(roomNode.data.uuid).toBe('ROOM#123');
            }
            const positionChild = roomNode.children.find(treeNodeTypeguard(isSchemaPosition));
            if (positionChild && positionChild.data.tag === 'Position') {
                expect(positionChild.data.x).toBe(15);
                expect(positionChild.data.y).toBe(25);
            }
        });

        it('should round-trip schema generation and parsing', () => {
            const reference = new StandardReference({ key: 'testRoom', universalKey: 'ROOM#123', tag: 'Room' });
            const payloadData: PositionPayloadType = {
                type: 'PositionFacet',
                x: 10,
                y: 20
            };
            const payload = new PositionPayload(payloadData);
            // Call _facetSchema directly (since schema is a getter, not a method)
            const generatedSchema = (payload as any)._facetSchema(reference, payloadData);
            const parsedPayload = payload.fromSchema(generatedSchema, reference);
            expect(parsedPayload.x).toBe(10);
            expect(parsedPayload.y).toBe(20);
        });
    });

    describe('nestedSchema', () => {
        it('should merge Position into Room schema with no existing children', () => {
            const reference = new StandardReference('ROOM#123', 'Room');
            const payloadData: PositionPayloadType = {
                type: 'PositionFacet',
                x: 10,
                y: 20
            };
            const payload = new PositionPayload(payloadData);
            const roomSchema = treeFromWML(deIndentWML('<Room uuid=(ROOM#123) />'))[0];
            const merged = payload.nestedSchema(reference, payloadData, roomSchema);
            expect(treeNodeTypeguard(isSchemaRoom)(merged)).toBe(true);
            const positionChild = merged.children.find(treeNodeTypeguard(isSchemaPosition));
            expect(positionChild).toBeDefined();
            expect(positionChild?.data.x).toBe(10);
            expect(positionChild?.data.y).toBe(20);
        });

        it('should merge Position into Room schema with existing children', () => {
            const reference = new StandardReference('ROOM#123', 'Room');
            const payloadData: PositionPayloadType = {
                type: 'PositionFacet',
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
            const merged = payload.nestedSchema(reference, payloadData, roomSchema);
            expect(treeNodeTypeguard(isSchemaRoom)(merged)).toBe(true);
            const positionChild = merged.children.find(treeNodeTypeguard(isSchemaPosition));
            expect(positionChild).toBeDefined();
            expect(positionChild?.data.x).toBe(10);
            expect(positionChild?.data.y).toBe(20);
            // Verify existing children are preserved
            expect(merged.children.length).toBeGreaterThan(1);
            const hasShortName = merged.children.some(child => child.data.tag === 'ShortName');
            expect(hasShortName).toBe(true);
            const hasFeature = merged.children.some(child => child.data.tag === 'Feature');
            expect(hasFeature).toBe(true);
        });

        it('should not duplicate Position if already present', () => {
            const reference = new StandardReference('ROOM#123', 'Room');
            const payloadData: PositionPayloadType = {
                type: 'PositionFacet',
                x: 10,
                y: 20
            };
            const payload = new PositionPayload(payloadData);
            const roomSchema = treeFromWML(deIndentWML(`
                <Room uuid=(ROOM#123)>
                    <Position x="5" y="15" />
                    <ShortName>Test Room</ShortName>
                </Room>
            `))[0];
            const merged = payload.nestedSchema(reference, payloadData, roomSchema);
            const positionChildren = merged.children.filter(treeNodeTypeguard(isSchemaPosition));
            // Should preserve existing Position (not add duplicate)
            expect(positionChildren.length).toBe(1);
        });

        it('should throw error when componentSchema is not a Room', () => {
            const reference = new StandardReference('ROOM#123', 'Room');
            const payloadData: PositionPayloadType = {
                type: 'PositionFacet',
                x: 10,
                y: 20
            };
            const payload = new PositionPayload(payloadData);
            const featureSchema = treeFromWML(deIndentWML('<Feature uuid=(FEATURE#123) />'))[0];
            expect(() => payload.nestedSchema(reference, payloadData, featureSchema)).toThrow('Invalid componentSchema: expected Room tag');
        });
    });
});
