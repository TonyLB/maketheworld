import { ExitFacetPlainClass } from '../exit';
import { EditableClass, PlainClass, RemoveClass, ReplaceClass, isStandardLiteralData } from '../../../literal';
import type { ExitPayload as ExitPayloadType } from './facet';
import { StandardReference } from '../../reference';
import { treeFromWML } from '../../../../schema';
import { deIndentWML } from '../../../../schema/utils';
import { treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree";
import { isSchemaExit } from "@tonylb/mtw-base/ts/schema/components";
import { StandardEditableData } from "@tonylb/mtw-base/ts/editable";

describe('ExitFacetPlainClass - StandardEditablePayload implementation', () => {
    describe('constructor and basic operations', () => {
        it('should create ExitFacetPlainClass from valid data with description', () => {
            const data: ExitPayloadType = 'North Exit';
            // For Exit facets, undefined is converted to empty string for StandardLiteral compatibility
            const payload = new ExitFacetPlainClass(data ?? '');
            // toJSON() converts empty string back to undefined for Exit facets
            expect(payload.toJSON()).toBe('North Exit');
        });

        it('should create ExitFacetPlainClass from valid data without description', () => {
            const data: ExitPayloadType = undefined;
            // Convert undefined to empty string for StandardLiteral
            const payload = new ExitFacetPlainClass('');
            // toJSON() converts empty string back to undefined
            expect(payload.toJSON()).toBeUndefined();
        });

        it('should clone correctly', () => {
            const data: ExitPayloadType = 'South Exit';
            const payload = new ExitFacetPlainClass(data ?? '');
            const cloned = payload.clone();
            expect(cloned).not.toBe(payload);
            expect(cloned.toJSON()).toBe('South Exit');
        });

        it('should return correct JSON', () => {
            const data: ExitPayloadType = 'East Exit';
            const payload = new ExitFacetPlainClass(data ?? '');
            expect(payload.toJSON()).toBe('East Exit');
        });

        it('should return correct JSON without description', () => {
            const data: ExitPayloadType = undefined;
            const payload = new ExitFacetPlainClass('');
            expect(payload.toJSON()).toBeUndefined();
        });

        it('should generate String tag schema with description', () => {
            const data: ExitPayloadType = 'West Exit';
            const payload = new ExitFacetPlainClass(data ?? '');
            const schema = payload.schema;
            // v2 PlainClass returns String tag schema (not Exit tag)
            expect(schema.length).toBe(1);
            expect(schema[0].data.tag).toBe('String');
            if (schema[0].data.tag === 'String') {
                expect(schema[0].data.value).toBe('West Exit');
            }
        });

        it('should generate String tag schema without description', () => {
            const data: ExitPayloadType = undefined;
            const payload = new ExitFacetPlainClass('');
            const schema = payload.schema;
            // v2 PlainClass returns String tag schema (not Exit tag)
            expect(schema.length).toBe(1);
            expect(schema[0].data.tag).toBe('String');
            if (schema[0].data.tag === 'String') {
                expect(schema[0].data.value).toBe('');
            }
        });
    });

    describe('v2StandardEditableFactory (via StandardLiteral)', () => {
        it('should create from plain payload data', () => {
            const data: ExitPayloadType = 'North Exit';
            // Use EditableClass.create() to dispatch to correct class
            const instance = EditableClass.create(data ?? '');
            expect(instance).toBeInstanceOf(PlainClass);
            expect(instance.toJSON()).toBe('North Exit');
        });

        it('should create from String tag schema', () => {
            // v2 classes work with String tags, not Exit tags
            const schema = treeFromWML(deIndentWML('<String>North Exit</String>'));
            const instance = EditableClass.create(schema);
            expect(instance).toBeInstanceOf(PlainClass);
            expect(instance.toJSON()).toBe('North Exit');
        });

        it('should create from String tag schema without description', () => {
            // Empty string represents undefined for Exit facets
            const schema = treeFromWML(deIndentWML('<String></String>'));
            const instance = EditableClass.create(schema);
            expect(instance).toBeInstanceOf(PlainClass);
            expect(instance.toJSON()).toBe('');
        });

        it('should create from Remove structure', () => {
            const removeData: StandardEditableData<string> = {
                tag: 'Remove',
                match: 'South Exit'
            };
            const instance = EditableClass.create(removeData);
            expect(instance).toBeInstanceOf(RemoveClass);
            const removeInstance = instance as any;
            expect(removeInstance.match?.toJSON()).toBe('South Exit');
        });

        it('should create from Replace structure', () => {
            const replaceData: StandardEditableData<string> = {
                tag: 'Replace',
                match: 'Old Exit',
                payload: 'New Exit'
            };
            const instance = EditableClass.create(replaceData);
            expect(instance).toBeInstanceOf(ReplaceClass);
            const replaceInstance = instance as any;
            expect(replaceInstance.match?.toJSON()).toBe('Old Exit');
            expect(replaceInstance.payload?.toJSON()).toBe('New Exit');
        });

        it('should validate typeguard correctly', () => {
            const valid: string = 'Test Exit';
            expect(isStandardLiteralData(valid)).toBe(true);

            const validEmpty: string = '';
            expect(isStandardLiteralData(validEmpty)).toBe(true);

            const invalid = {
                x: 10,
                y: 20
            };
            expect(isStandardLiteralData(invalid)).toBe(false);
        });
    });

    // Merge operations are tested at the StandardLiteral level (literal/index.test.ts)
    // These tests were redundant - they only tested payload functionality, not facet delegation

    describe('v2 diff operations', () => {
        it('should return undefined when payloads are same', () => {
            const payload: ExitPayloadType = 'Test Exit';
            const baseInstance = EditableClass.create(payload ?? '');
            const incomingInstance = EditableClass.create(payload ?? '');
            const diffResult = baseInstance.diff(incomingInstance);
            expect(diffResult).toBeUndefined();
        });

        it('should create Replace when payloads differ', () => {
            const base: ExitPayloadType = 'Old Exit';
            const incoming: ExitPayloadType = 'New Exit';
            const baseInstance = EditableClass.create(base ?? '');
            const incomingInstance = EditableClass.create(incoming ?? '');
            const diffResult = baseInstance.diff(incomingInstance);
            expect(diffResult).toBeInstanceOf(ReplaceClass);
            const replaceInstance = diffResult as any;
            expect(replaceInstance.match?.toJSON()).toBe('Old Exit');
            expect(replaceInstance.payload?.toJSON()).toBe('New Exit');
        });
    });
});

describe('ExitFacetPlainClass - FacetPayloadBase implementation', () => {
    describe('fromSchema', () => {
        it('should parse Exit tag with description (key and uuid)', () => {
            const schema = treeFromWML(deIndentWML('<Exit to=(ROOM#123)>North Exit</Exit>'));
            const reference = new StandardReference('ROOM#123', 'Room');
            const payload = new ExitFacetPlainClass('');
            const result = payload.fromSchema(schema, reference);
            expect(result).toBe('North Exit');
        });

        it('should parse Exit tag with description (uuid only)', () => {
            const schema = treeFromWML(deIndentWML('<Exit to=(ROOM#456)>South Exit</Exit>'));
            const reference = new StandardReference('ROOM#456', 'Room');
            const payload = new ExitFacetPlainClass('');
            const result = payload.fromSchema(schema, reference);
            expect(result).toBe('South Exit');
        });

        it('should parse Exit tag without description', () => {
            const schema = treeFromWML(deIndentWML('<Exit to=(ROOM#789) />'));
            const reference = new StandardReference('ROOM#789', 'Room');
            const payload = new ExitFacetPlainClass('');
            const result = payload.fromSchema(schema, reference);
            expect(result).toBeUndefined();
        });

        it('should parse Exit tag with description containing multiple String children', () => {
            // Exit tags can have multiple String children (though typically just one)
            const schema = treeFromWML(deIndentWML('<Exit to=(ROOM#123)>First part Second part</Exit>'));
            const reference = new StandardReference('ROOM#123', 'Room');
            const payload = new ExitFacetPlainClass('');
            const result = payload.fromSchema(schema, reference);
            // String children should be joined
            expect(result).toContain('First part');
            expect(result).toContain('Second part');
        });

        it('should throw error when Exit tag is missing', () => {
            const schema = treeFromWML(deIndentWML('<Room uuid=(ROOM#123) />'));
            const reference = new StandardReference('ROOM#123', 'Room');
            const payload = new ExitFacetPlainClass('');
            expect(() => payload.fromSchema(schema, reference)).toThrow('Invalid schema: Exit tag not found');
        });

        it('should handle empty Exit content', () => {
            const schema = treeFromWML(deIndentWML('<Exit to=(ROOM#123)></Exit>'));
            const reference = new StandardReference('ROOM#123', 'Room');
            const payload = new ExitFacetPlainClass('');
            const result = payload.fromSchema(schema, reference);
            expect(result).toBeUndefined();
        });
    });

    describe('renderFacet', () => {
        it('should render Exit tag with description (always returns newNode)', () => {
            const reference = new StandardReference({ key: 'testRoom', universalKey: 'ROOM#123', tag: 'Room' });
            const payloadData: ExitPayloadType = 'North Exit';
            const payload = new ExitFacetPlainClass(payloadData ?? '');
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
            const payloadData: ExitPayloadType = undefined;
            const payload = new ExitFacetPlainClass(payloadData ?? '');
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
            const payloadData: ExitPayloadType = 'South Exit';
            const payload = new ExitFacetPlainClass(payloadData ?? '');
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
            const payloadData: ExitPayloadType = 'East Exit';
            const payload = new ExitFacetPlainClass(payloadData ?? '');
            
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
            const payloadData: ExitPayloadType = 'West Exit';
            const payload = new ExitFacetPlainClass(payloadData ?? '');
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
            const payloadData: ExitPayloadType = 'Northwest Exit';
            const payload = new ExitFacetPlainClass(payloadData ?? '');
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
            const data: ExitPayloadType = '';
            const payload = new ExitFacetPlainClass(data ?? '');
            // ExitFacetPlainClass.toJSON() converts empty string to undefined for Exit payload compatibility
            expect(payload.toJSON()).toBeUndefined();
            
            // v2 PlainClass returns String tag schema (not Exit tag)
            const schema = payload.schema;
            expect(schema[0].data.tag).toBe('String');
            if (schema[0].data.tag === 'String') {
                expect(schema[0].data.value).toBe('');
            }
        });

        it('should handle long description strings', () => {
            const longDescription = 'A'.repeat(1000);
            const data: ExitPayloadType = longDescription;
            const payload = new ExitFacetPlainClass(data ?? '');
            expect(payload.toJSON()).toBe(longDescription);
        });

        it('should handle special characters in description', () => {
            const specialDescription = 'Exit with "quotes" and <tags> and & symbols';
            const data: ExitPayloadType = specialDescription;
            const payload = new ExitFacetPlainClass(data ?? '');
            expect(payload.toJSON()).toBe(specialDescription);
            
            // Verify it can be rendered
            const reference = new StandardReference('ROOM#123', 'Room');
            const result = payload.renderFacet(reference, data);
            expect(result.newNode).toBeDefined();
        });

        it('should handle merge with undefined description', () => {
            const base: ExitPayloadType = 'Old Exit';
            const baseInstance = EditableClass.create(base ?? '');
            const incomingInstance = EditableClass.create('');
            const merged = baseInstance.merge(incomingInstance);
            // When merging with empty string, StandardLiteral uses Add semantics (concatenation)
            // "Old Exit" + "" = "Old Exit"
            expect(merged).toBeInstanceOf(PlainClass);
            expect(merged?.toJSON()).toBe('Old Exit');
        });
    });
});
