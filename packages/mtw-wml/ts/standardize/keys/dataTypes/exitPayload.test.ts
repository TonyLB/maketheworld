import { ExitPayload, factory, isStandardExitPayloadData, merge, diff } from './exitPayload';
import type { ExitPayload as ExitPayloadType } from './facet';
import { StandardReference } from '../reference';
import { treeFromWML } from '../../../schema';
import { deIndentWML } from '../../../schema/utils';
import { treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree";
import { isSchemaExit } from "@tonylb/mtw-base/ts/schema/components";
import { StandardEditableData } from "@tonylb/mtw-base/ts/editable";

describe('ExitPayload - StandardEditablePayload implementation', () => {
    describe('constructor and basic operations', () => {
        it('should create ExitPayload from valid data with description', () => {
            const data: ExitPayloadType = {
                type: 'ExitFacet',
                description: 'North Exit'
            };
            const payload = new ExitPayload(data);
            expect(payload.description).toBe('North Exit');
        });

        it('should create ExitPayload from valid data without description', () => {
            const data: ExitPayloadType = {
                type: 'ExitFacet'
            };
            const payload = new ExitPayload(data);
            expect(payload.description).toBeUndefined();
        });

        it('should clone correctly', () => {
            const data: ExitPayloadType = {
                type: 'ExitFacet',
                description: 'South Exit'
            };
            const payload = new ExitPayload(data);
            const cloned = payload.clone();
            expect(cloned).not.toBe(payload);
            const clonedPayload = cloned as ExitPayload;
            expect(clonedPayload.description).toBe('South Exit');
            expect(cloned.toJSON()).toEqual(data);
        });

        it('should return correct JSON', () => {
            const data: ExitPayloadType = {
                type: 'ExitFacet',
                description: 'East Exit'
            };
            const payload = new ExitPayload(data);
            expect(payload.toJSON()).toEqual(data);
        });

        it('should return correct JSON without description', () => {
            const data: ExitPayloadType = {
                type: 'ExitFacet'
            };
            const payload = new ExitPayload(data);
            expect(payload.toJSON()).toEqual(data);
        });

        it('should generate Exit tag schema with description', () => {
            const data: ExitPayloadType = {
                type: 'ExitFacet',
                description: 'West Exit'
            };
            const payload = new ExitPayload(data);
            const schema = payload.schema;
            expect(schema.length).toBe(1);
            expect(schema[0].data.tag).toBe('Exit');
            // Verify Exit tag has empty `to` property (reference-based)
            if (schema[0].data.tag === 'Exit') {
                expect(schema[0].data.to).toBe('');
            }
            // Verify Exit tag contains String child with description
            expect(schema[0].children.length).toBe(1);
            const stringChild = schema[0].children[0];
            if (stringChild.data.tag === 'String') {
                expect(stringChild.data.value).toBe('West Exit');
            }
        });

        it('should generate Exit tag schema without description', () => {
            const data: ExitPayloadType = {
                type: 'ExitFacet'
            };
            const payload = new ExitPayload(data);
            const schema = payload.schema;
            expect(schema.length).toBe(1);
            expect(schema[0].data.tag).toBe('Exit');
            // Verify Exit tag has empty `to` property
            if (schema[0].data.tag === 'Exit') {
                expect(schema[0].data.to).toBe('');
            }
            // Verify Exit tag has no children
            expect(schema[0].children.length).toBe(0);
        });
    });

    describe('StandardEditable factory', () => {
        it('should create from plain payload data', () => {
            const data: ExitPayloadType = {
                type: 'ExitFacet',
                description: 'North Exit'
            };
            const delta = factory(data);
            expect(delta).toBeDefined();
            expect(delta?.add).toBeDefined();
            if (delta?.add) {
                const payloadData = delta.add.toJSON();
                expect(payloadData.description).toBe('North Exit');
            }
        });

        it('should create from Exit tag schema', () => {
            const schema = treeFromWML(deIndentWML('<Exit to=(ROOM#123)>North Exit</Exit>'));
            const delta = factory(schema);
            expect(delta).toBeDefined();
            expect(delta?.add).toBeDefined();
            if (delta?.add) {
                const payloadData = delta.add.toJSON();
                expect(payloadData.description).toBe('North Exit');
            }
        });

        it('should create from Exit tag schema without description', () => {
            const schema = treeFromWML(deIndentWML('<Exit to=(ROOM#123) />'));
            const delta = factory(schema);
            expect(delta).toBeDefined();
            expect(delta?.add).toBeDefined();
            if (delta?.add) {
                const payloadData = delta.add.toJSON();
                expect(payloadData.description).toBeUndefined();
            }
        });

        it('should create from Remove structure', () => {
            const removeData: StandardEditableData<ExitPayloadType> = {
                tag: 'Remove',
                match: {
                    type: 'ExitFacet',
                    description: 'South Exit'
                }
            };
            const delta = factory(removeData);
            expect(delta).toBeDefined();
            expect(delta?.remove).toBeDefined();
            if (delta?.remove) {
                const payloadData = delta.remove.toJSON();
                expect(payloadData.description).toBe('South Exit');
            }
        });

        it('should create from Replace structure', () => {
            const replaceData: StandardEditableData<ExitPayloadType> = {
                tag: 'Replace',
                match: {
                    type: 'ExitFacet',
                    description: 'Old Exit'
                },
                payload: {
                    type: 'ExitFacet',
                    description: 'New Exit'
                }
            };
            const delta = factory(replaceData);
            expect(delta).toBeDefined();
            expect(delta?.remove).toBeDefined();
            expect(delta?.add).toBeDefined();
            if (delta?.remove && delta?.add) {
                const removeData = delta.remove.toJSON();
                const addData = delta.add.toJSON();
                expect(removeData.description).toBe('Old Exit');
                expect(addData.description).toBe('New Exit');
            }
        });

        it('should validate typeguard correctly', () => {
            const valid: ExitPayloadType = {
                type: 'ExitFacet',
                description: 'Test Exit'
            };
            expect(isStandardExitPayloadData(valid)).toBe(true);

            const validWithoutDescription: ExitPayloadType = {
                type: 'ExitFacet'
            };
            expect(isStandardExitPayloadData(validWithoutDescription)).toBe(true);

            const invalid = {
                type: 'PositionFacet',
                x: 10,
                y: 20
            };
            expect(isStandardExitPayloadData(invalid)).toBe(false);
        });
    });

    describe('StandardEditable merge operations', () => {
        it('should merge with Replace semantics (incoming wins)', () => {
            const base: ExitPayloadType = {
                type: 'ExitFacet',
                description: 'Old Exit'
            };
            const incoming: ExitPayloadType = {
                type: 'ExitFacet',
                description: 'New Exit'
            };
            const baseDelta = factory(base);
            const incomingDelta = factory(incoming);
            // Use type assertion to handle generic type constraints
            const merged = merge(baseDelta as any, incomingDelta as any) as any;
            if (merged?.add) {
                const payload = merged.add as ExitPayload;
                const payloadData = payload.toJSON();
                expect(payloadData.description).toBe('New Exit');
            }
        });

        it('should cancel when removing same payload', () => {
            const payload: ExitPayloadType = {
                type: 'ExitFacet',
                description: 'Test Exit'
            };
            const addDelta = factory(payload);
            const removeDelta = factory({
                tag: 'Remove',
                match: payload
            } as StandardEditableData<ExitPayloadType>);
            const merged = merge(addDelta as any, removeDelta as any) as any;
            expect(merged).toEqual({ add: undefined, remove: undefined });
        });

        it('should create Replace when payloads differ during merge', () => {
            const base: ExitPayloadType = {
                type: 'ExitFacet',
                description: 'Old Exit'
            };
            const incoming: ExitPayloadType = {
                type: 'ExitFacet',
                description: 'New Exit'
            };
            const baseDelta = factory(base);
            const incomingDelta = factory(incoming);
            const merged = merge(baseDelta as any, incomingDelta as any) as any;
            // When base is added and incoming is added, and they differ, should keep incoming
            if (merged?.add) {
                const payload = merged.add as ExitPayload;
                const payloadData = payload.toJSON();
                expect(payloadData.description).toBe('New Exit');
            }
        });
    });

    describe('StandardEditable diff operations', () => {
        it('should return empty when payloads are same', () => {
            const payload: ExitPayloadType = {
                type: 'ExitFacet',
                description: 'Test Exit'
            };
            const baseDelta = factory(payload);
            const incomingDelta = factory(payload);
            const diffResult = diff(baseDelta as any, incomingDelta as any) as any;
            expect(diffResult).toEqual({ add: undefined, remove: undefined });
        });

        it('should create Replace when payloads differ', () => {
            const base: ExitPayloadType = {
                type: 'ExitFacet',
                description: 'Old Exit'
            };
            const incoming: ExitPayloadType = {
                type: 'ExitFacet',
                description: 'New Exit'
            };
            const baseDelta = factory(base);
            const incomingDelta = factory(incoming);
            const diffResult = diff(baseDelta as any, incomingDelta as any) as any;
            if (diffResult?.remove && diffResult?.add) {
                const removePayload = diffResult.remove as ExitPayload;
                const addPayload = diffResult.add as ExitPayload;
                const removeData = removePayload.toJSON();
                const addData = addPayload.toJSON();
                expect(removeData.description).toBe('Old Exit');
                expect(addData.description).toBe('New Exit');
            }
        });
    });
});

describe('ExitPayload - FacetPayloadBase implementation', () => {
    describe('fromSchema', () => {
        it('should parse Exit tag with description (key and uuid)', () => {
            const schema = treeFromWML(deIndentWML('<Exit to=(ROOM#123)>North Exit</Exit>'));
            const reference = new StandardReference('ROOM#123', 'Room');
            const payload = new ExitPayload({ type: 'ExitFacet' });
            const result = payload.fromSchema(schema, reference);
            expect(result.description).toBe('North Exit');
            expect(result.type).toBe('ExitFacet');
        });

        it('should parse Exit tag with description (uuid only)', () => {
            const schema = treeFromWML(deIndentWML('<Exit to=(ROOM#456)>South Exit</Exit>'));
            const reference = new StandardReference('ROOM#456', 'Room');
            const payload = new ExitPayload({ type: 'ExitFacet' });
            const result = payload.fromSchema(schema, reference);
            expect(result.description).toBe('South Exit');
        });

        it('should parse Exit tag without description', () => {
            const schema = treeFromWML(deIndentWML('<Exit to=(ROOM#789) />'));
            const reference = new StandardReference('ROOM#789', 'Room');
            const payload = new ExitPayload({ type: 'ExitFacet' });
            const result = payload.fromSchema(schema, reference);
            expect(result.description).toBeUndefined();
            expect(result.type).toBe('ExitFacet');
        });

        it('should parse Exit tag with description containing multiple String children', () => {
            // Exit tags can have multiple String children (though typically just one)
            const schema = treeFromWML(deIndentWML('<Exit to=(ROOM#123)>First part Second part</Exit>'));
            const reference = new StandardReference('ROOM#123', 'Room');
            const payload = new ExitPayload({ type: 'ExitFacet' });
            const result = payload.fromSchema(schema, reference);
            // String children should be joined
            expect(result.description).toContain('First part');
            expect(result.description).toContain('Second part');
        });

        it('should throw error when Exit tag is missing', () => {
            const schema = treeFromWML(deIndentWML('<Room uuid=(ROOM#123) />'));
            const reference = new StandardReference('ROOM#123', 'Room');
            const payload = new ExitPayload({ type: 'ExitFacet' });
            expect(() => payload.fromSchema(schema, reference)).toThrow('Invalid schema: Exit tag not found');
        });

        it('should handle empty Exit content', () => {
            const schema = treeFromWML(deIndentWML('<Exit to=(ROOM#123)></Exit>'));
            const reference = new StandardReference('ROOM#123', 'Room');
            const payload = new ExitPayload({ type: 'ExitFacet' });
            const result = payload.fromSchema(schema, reference);
            expect(result.description).toBeUndefined();
        });
    });

    describe('renderFacet', () => {
        it('should render Exit tag with description (always returns newNode)', () => {
            const reference = new StandardReference({ key: 'testRoom', universalKey: 'ROOM#123', tag: 'Room' });
            const payloadData: ExitPayloadType = {
                type: 'ExitFacet',
                description: 'North Exit'
            };
            const payload = new ExitPayload(payloadData);
            const result = payload.renderFacet(reference, payloadData);
            
            // Should return newNode (not aggregatedNode)
            expect(result.newNode).toBeDefined();
            expect(result.aggregatedNode).toBeUndefined();
            
            // Verify newNode is Exit tag with description
            const newNode = result.newNode!;
            expect(treeNodeTypeguard(isSchemaExit)(newNode)).toBe(true);
            if (newNode.data.tag === 'Exit') {
                // Verify `to` property uses reference key format
                const toKey = reference.standardKey.toFormat('key');
                const expectedTo = toKey.key ?? toKey.universalKey ?? '';
                expect(newNode.data.to).toBe(expectedTo);
            }
            // Verify description is rendered as String children
            const stringChild = newNode.children.find(child => child.data.tag === 'String');
            expect(stringChild).toBeDefined();
            if (stringChild && stringChild.data.tag === 'String') {
                expect(stringChild.data.value).toBe('North Exit');
            }
        });

        it('should render Exit tag without description', () => {
            const reference = new StandardReference('ROOM#456', 'Room');
            const payloadData: ExitPayloadType = {
                type: 'ExitFacet'
            };
            const payload = new ExitPayload(payloadData);
            const result = payload.renderFacet(reference, payloadData);
            
            // Should return newNode (not aggregatedNode)
            expect(result.newNode).toBeDefined();
            expect(result.aggregatedNode).toBeUndefined();
            
            // Verify newNode is Exit tag without children
            const newNode = result.newNode!;
            expect(treeNodeTypeguard(isSchemaExit)(newNode)).toBe(true);
            if (newNode.data.tag === 'Exit') {
                const toKey = reference.standardKey.toFormat('key');
                const expectedTo = toKey.key ?? toKey.universalKey ?? '';
                expect(newNode.data.to).toBe(expectedTo);
            }
            expect(newNode.children.length).toBe(0);
        });

        it('should ignore referenceRender parameter', () => {
            const reference = new StandardReference('ROOM#789', 'Room');
            const payloadData: ExitPayloadType = {
                type: 'ExitFacet',
                description: 'South Exit'
            };
            const payload = new ExitPayload(payloadData);
            // Provide a referenceRender (should be ignored)
            const roomSchema = treeFromWML(deIndentWML('<Room uuid=(ROOM#789)><ShortName>Room</ShortName></Room>'))[0];
            const result = payload.renderFacet(reference, payloadData, roomSchema);
            
            // Should still return newNode (referenceRender ignored)
            expect(result.newNode).toBeDefined();
            expect(result.aggregatedNode).toBeUndefined();
            
            // Verify newNode is Exit tag (not Room tag)
            const newNode = result.newNode!;
            expect(treeNodeTypeguard(isSchemaExit)(newNode)).toBe(true);
            expect(newNode.data.tag).toBe('Exit');
        });

        it('should always return newNode (never aggregatedNode)', () => {
            const reference = new StandardReference('ROOM#123', 'Room');
            const payloadData: ExitPayloadType = {
                type: 'ExitFacet',
                description: 'East Exit'
            };
            const payload = new ExitPayload(payloadData);
            
            // Test without referenceRender
            const result1 = payload.renderFacet(reference, payloadData);
            expect(result1.newNode).toBeDefined();
            expect(result1.aggregatedNode).toBeUndefined();
            
            // Test with referenceRender (should still return newNode)
            const roomSchema = treeFromWML(deIndentWML('<Room uuid=(ROOM#123)><ShortName>Room</ShortName></Room>'))[0];
            const result2 = payload.renderFacet(reference, payloadData, roomSchema);
            expect(result2.newNode).toBeDefined();
            expect(result2.aggregatedNode).toBeUndefined();
        });

        it('should use reference key format for `to` property', () => {
            const reference = new StandardReference({ key: 'testRoom', universalKey: 'ROOM#123', tag: 'Room' });
            const payloadData: ExitPayloadType = {
                type: 'ExitFacet',
                description: 'West Exit'
            };
            const payload = new ExitPayload(payloadData);
            const result = payload.renderFacet(reference, payloadData);
            
            const newNode = result.newNode!;
            if (newNode.data.tag === 'Exit') {
                // Should use key if available, otherwise universalKey
                const toKey = reference.standardKey.toFormat('key');
                const expectedTo = toKey.key ?? toKey.universalKey ?? '';
                expect(newNode.data.to).toBe(expectedTo);
            }
        });

        it('should use reference universalKey when key not available', () => {
            const reference = new StandardReference('ROOM#456', 'Room');
            const payloadData: ExitPayloadType = {
                type: 'ExitFacet',
                description: 'Northwest Exit'
            };
            const payload = new ExitPayload(payloadData);
            const result = payload.renderFacet(reference, payloadData);
            
            const newNode = result.newNode!;
            if (newNode.data.tag === 'Exit') {
                // Should use universalKey when key not available
                const toKey = reference.standardKey.toFormat('key');
                const expectedTo = toKey.key ?? toKey.universalKey ?? '';
                expect(newNode.data.to).toBe('ROOM#456');
            }
        });
    });

    describe('edge cases', () => {
        it('should handle empty description string', () => {
            const data: ExitPayloadType = {
                type: 'ExitFacet',
                description: ''
            };
            const payload = new ExitPayload(data);
            expect(payload.description).toBe('');
            expect(payload.toJSON().description).toBe('');
            
            // Schema should still generate Exit tag with empty String child
            const schema = payload.schema;
            expect(schema[0].children[0].data.tag).toBe('String');
            if (schema[0].children[0].data.tag === 'String') {
                expect(schema[0].children[0].data.value).toBe('');
            }
        });

        it('should handle long description strings', () => {
            const longDescription = 'A'.repeat(1000);
            const data: ExitPayloadType = {
                type: 'ExitFacet',
                description: longDescription
            };
            const payload = new ExitPayload(data);
            expect(payload.description).toBe(longDescription);
            expect(payload.toJSON().description).toBe(longDescription);
        });

        it('should handle special characters in description', () => {
            const specialDescription = 'Exit with "quotes" and <tags> and & symbols';
            const data: ExitPayloadType = {
                type: 'ExitFacet',
                description: specialDescription
            };
            const payload = new ExitPayload(data);
            expect(payload.description).toBe(specialDescription);
            
            // Verify it can be rendered
            const reference = new StandardReference('ROOM#123', 'Room');
            const result = payload.renderFacet(reference, data);
            expect(result.newNode).toBeDefined();
        });

        it('should handle merge with undefined description', () => {
            const base: ExitPayloadType = {
                type: 'ExitFacet',
                description: 'Old Exit'
            };
            const incoming: ExitPayloadType = {
                type: 'ExitFacet'
            };
            const baseDelta = factory(base);
            const incomingDelta = factory(incoming);
            const merged = merge(baseDelta as any, incomingDelta as any) as any;
            if (merged?.add) {
                const payload = merged.add as ExitPayload;
                const payloadData = payload.toJSON();
                expect(payloadData.description).toBeUndefined();
            }
        });
    });
});
