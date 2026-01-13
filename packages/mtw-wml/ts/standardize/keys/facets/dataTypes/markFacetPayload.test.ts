import { MarkFacetPlainClass } from '../mark';
import { EditableClass, PlainClass, RemoveClass, ReplaceClass, isStandardLiteralData } from '../../../literal';
import type { MarkFacetPayload as MarkFacetPayloadType } from './facet';
import { StandardReference } from '../../reference';
import { treeFromWML } from '../../../../schema';
import { deIndentWML } from '../../../../schema/utils';
import { treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree";
import { isSchemaMark, isSchemaMatch } from "@tonylb/mtw-base/ts/schema/worldState";
import { StandardEditableData } from "@tonylb/mtw-base/ts/editable";
import { isSchemaString } from "@tonylb/mtw-base/ts/schema/renderTree";

describe('MarkFacetPlainClass - StandardEditablePayload implementation', () => {
    describe('constructor and basic operations', () => {
        it('should create MarkFacetPlainClass from valid data', () => {
            const data: MarkFacetPayloadType = 'Test condition';
            const payload = new MarkFacetPlainClass(data);
            expect(payload.toJSON()).toBe('Test condition');
        });

        it('should clone correctly', () => {
            const data: MarkFacetPayloadType = 'Test condition';
            const payload = new MarkFacetPlainClass(data);
            const cloned = payload.clone();
            expect(cloned).not.toBe(payload);
            expect(cloned.toJSON()).toBe('Test condition');
        });

        it('should return correct JSON', () => {
            const data: MarkFacetPayloadType = 'Another condition';
            const payload = new MarkFacetPlainClass(data);
            expect(payload.toJSON()).toBe('Another condition');
        });

        it('should generate Match tag schema', () => {
            const data: MarkFacetPayloadType = 'Test condition';
            const payload = new MarkFacetPlainClass(data);
            // nestedSchema wraps String in Match tag
            const schema = payload.nestedSchema({ tag: 'Match' });
            expect(schema.length).toBe(1);
            expect(schema[0].data.tag).toBe('Match');
            // Verify Match tag contains String child with narrative
            expect(schema[0].children.length).toBe(1);
            const stringChild = schema[0].children[0];
            if (stringChild.data.tag === 'String') {
                expect(stringChild.data.value).toBe('Test condition');
            }
        });
    });

    describe('v2StandardEditableFactory (via StandardLiteral)', () => {
        it('should create from plain payload data', () => {
            const data: MarkFacetPayloadType = 'Test condition';
            // Use EditableClass.create() to dispatch to correct class
            const instance = EditableClass.create(data);
            expect(instance).toBeInstanceOf(PlainClass);
            expect(instance.toJSON()).toBe('Test condition');
        });

        it('should create from String tag schema', () => {
            // v2 classes work with String tags, not Match tags directly
            const schema = treeFromWML(deIndentWML('<String>Test condition</String>'));
            const instance = EditableClass.create(schema);
            expect(instance).toBeInstanceOf(PlainClass);
            expect(instance.toJSON()).toBe('Test condition');
        });

        it('should create from Remove structure', () => {
            const removeData: StandardEditableData<string> = {
                tag: 'Remove',
                match: 'Test condition'
            };
            const instance = EditableClass.create(removeData);
            expect(instance).toBeInstanceOf(RemoveClass);
            const removeInstance = instance as any;
            expect(removeInstance.match?.toJSON()).toBe('Test condition');
        });

        it('should create from Replace structure', () => {
            const replaceData: StandardEditableData<string> = {
                tag: 'Replace',
                match: 'Old condition',
                payload: 'New condition'
            };
            const instance = EditableClass.create(replaceData);
            expect(instance).toBeInstanceOf(ReplaceClass);
            const replaceInstance = instance as any;
            expect(replaceInstance.match?.toJSON()).toBe('Old condition');
            expect(replaceInstance.payload?.toJSON()).toBe('New condition');
        });

        it('should validate typeguard correctly', () => {
            const valid: string = 'Test condition';
            expect(isStandardLiteralData(valid)).toBe(true);

            const invalid = { x: 10, y: 20 };
            expect(isStandardLiteralData(invalid)).toBe(false);
        });
    });

    // Note: Merge and diff operations are inherited from StandardLiteral (PlainClass) and are tested there.
    // MarkFacetPlainClass does not override merge or diff, so no payload-specific tests are needed.
    // The only methods overridden/added are: nestedSchema, _wrap, fromSchema, and renderFacet.
});

describe('MarkFacetPlainClass - FacetPayloadBase implementation', () => {
    describe('fromSchema', () => {
        it('should parse Mark with Match child (with key and uuid)', () => {
            const schema = treeFromWML(deIndentWML('<Mark key=(testMark) uuid=(MARK#123)><Match>Test condition</Match></Mark>'));
            const reference = new StandardReference('MARK#123', 'Mark');
            const payload = new MarkFacetPlainClass('');
            const result = payload.fromSchema(schema, reference);
            expect(result).toBe('Test condition');
        });

        it('should parse Mark with Match child (uuid only)', () => {
            const schema = treeFromWML(deIndentWML('<Mark uuid=(MARK#123)><Match>Another condition</Match></Mark>'));
            const reference = new StandardReference('MARK#123', 'Mark');
            const payload = new MarkFacetPlainClass('');
            const result = payload.fromSchema(schema, reference);
            expect(result).toBe('Another condition');
        });

        it('should throw error when Match child is missing', () => {
            const schema = treeFromWML(deIndentWML('<Mark uuid=(MARK#123) />'));
            const reference = new StandardReference('MARK#123', 'Mark');
            const payload = new MarkFacetPlainClass('');
            expect(() => payload.fromSchema(schema, reference)).toThrow('Invalid schema: Match child not found');
        });

        it('should throw error when Mark tag is missing', () => {
            const schema = treeFromWML(deIndentWML('<Match>Test condition</Match>'));
            const reference = new StandardReference('MARK#123', 'Mark');
            const payload = new MarkFacetPlainClass('');
            expect(() => payload.fromSchema(schema, reference)).toThrow('Invalid schema: Mark tag not found');
        });

        it('should handle empty Match content', () => {
            const schema = treeFromWML(deIndentWML('<Mark uuid=(MARK#123)><Match></Match></Mark>'));
            const reference = new StandardReference('MARK#123', 'Mark');
            const payload = new MarkFacetPlainClass('');
            const result = payload.fromSchema(schema, reference);
            expect(result).toBe('');
        });
    });

    describe('renderFacet', () => {
        it('should render with pre-existing Mark render', () => {
            const reference = new StandardReference('MARK#123', 'Mark');
            const payloadData: MarkFacetPayloadType = 'Test condition';
            const payload = new MarkFacetPlainClass(payloadData);
            const markSchema = treeFromWML(deIndentWML(`
                <Mark uuid=(MARK#123)>
                    <ShortName>Test Mark</ShortName>
                    <Description>Mark description</Description>
                </Mark>
            `))[0];
            const result = payload.renderFacet(reference, payloadData, markSchema);
            
            // Should return aggregatedNode (not newNode)
            expect(result.aggregatedNode).toBeDefined();
            expect(result.newNode).toBeUndefined();
            
            // Verify aggregatedNode is enhanced Mark with Match child
            const aggregatedNode = result.aggregatedNode!;
            expect(treeNodeTypeguard(isSchemaMark)(aggregatedNode)).toBe(true);
            const matchChild = aggregatedNode.children.find(treeNodeTypeguard(isSchemaMatch));
            expect(matchChild).toBeDefined();
            if (matchChild && treeNodeTypeguard(isSchemaMatch)(matchChild)) {
                // Extract narrative from Match's String children
                const narrative = matchChild.children
                    .map(({ data }) => data)
                    .filter(isSchemaString)
                    .map(({ value }) => value)
                    .join('');
                expect(narrative).toBe('Test condition');
            }
            
            // Verify existing children are preserved
            expect(aggregatedNode.children.length).toBeGreaterThan(1);
            const hasShortName = aggregatedNode.children.some(child => child.data.tag === 'ShortName');
            expect(hasShortName).toBe(true);
            const hasDescription = aggregatedNode.children.some(child => child.data.tag === 'Description');
            expect(hasDescription).toBe(true);
        });

        it('should render without reference render (plain Mark tag)', () => {
            const reference = new StandardReference({ key: 'testMark', universalKey: 'MARK#123', tag: 'Mark' });
            const payloadData: MarkFacetPayloadType = 'Another condition';
            const payload = new MarkFacetPlainClass(payloadData);
            const result = payload.renderFacet(reference, payloadData);
            
            // Should return aggregatedNode (not newNode)
            expect(result.aggregatedNode).toBeDefined();
            expect(result.newNode).toBeUndefined();
            
            // Verify aggregatedNode contains plain Mark tag with Match child
            const aggregatedNode = result.aggregatedNode!;
            expect(treeNodeTypeguard(isSchemaMark)(aggregatedNode)).toBe(true);
            if (aggregatedNode.data.tag === 'Mark') {
                expect(aggregatedNode.data.key).toBe('testMark');
                expect(aggregatedNode.data.uuid).toBe('MARK#123');
            }
            const matchChild = aggregatedNode.children.find(treeNodeTypeguard(isSchemaMatch));
            expect(matchChild).toBeDefined();
            if (matchChild && treeNodeTypeguard(isSchemaMatch)(matchChild)) {
                const narrative = matchChild.children
                    .map(({ data }) => data)
                    .filter(isSchemaString)
                    .map(({ value }) => value)
                    .join('');
                expect(narrative).toBe('Another condition');
            }
        });

        it('should render without reference render (uuid only)', () => {
            const reference = new StandardReference('MARK#456', 'Mark');
            const payloadData: MarkFacetPayloadType = 'Third condition';
            const payload = new MarkFacetPlainClass(payloadData);
            const result = payload.renderFacet(reference, payloadData);
            
            // Should return aggregatedNode (not newNode)
            expect(result.aggregatedNode).toBeDefined();
            expect(result.newNode).toBeUndefined();
            
            // Verify aggregatedNode contains Mark tag with Match child
            const aggregatedNode = result.aggregatedNode!;
            expect(treeNodeTypeguard(isSchemaMark)(aggregatedNode)).toBe(true);
            if (aggregatedNode.data.tag === 'Mark') {
                expect(aggregatedNode.data.uuid).toBe('MARK#456');
            }
            const matchChild = aggregatedNode.children.find(treeNodeTypeguard(isSchemaMatch));
            if (matchChild && treeNodeTypeguard(isSchemaMatch)(matchChild)) {
                const narrative = matchChild.children
                    .map(({ data }) => data)
                    .filter(isSchemaString)
                    .map(({ value }) => value)
                    .join('');
                expect(narrative).toBe('Third condition');
            }
        });

        it('should always return aggregatedNode (never newNode)', () => {
            const reference = new StandardReference('MARK#789', 'Mark');
            const payloadData: MarkFacetPayloadType = 'Fourth condition';
            const payload = new MarkFacetPlainClass(payloadData);
            
            // Test without referenceRender
            const result1 = payload.renderFacet(reference, payloadData);
            expect(result1.aggregatedNode).toBeDefined();
            expect(result1.newNode).toBeUndefined();
            
            // Test with referenceRender
            const markSchema = treeFromWML(deIndentWML('<Mark uuid=(MARK#789)><ShortName>Mark</ShortName></Mark>'))[0];
            const result2 = payload.renderFacet(reference, payloadData, markSchema);
            expect(result2.aggregatedNode).toBeDefined();
            expect(result2.newNode).toBeUndefined();
        });

        it('should throw error when referenceRender is not a Mark', () => {
            const reference = new StandardReference('MARK#123', 'Mark');
            const payloadData: MarkFacetPayloadType = 'Test condition';
            const payload = new MarkFacetPlainClass(payloadData);
            const roomSchema = treeFromWML(deIndentWML('<Room uuid=(ROOM#123) />'))[0];
            expect(() => payload.renderFacet(reference, payloadData, roomSchema)).toThrow('Invalid referenceRender: expected Mark tag');
        });

        it('should add Match as first child when referenceRender provided', () => {
            const reference = new StandardReference('MARK#123', 'Mark');
            const payloadData: MarkFacetPayloadType = 'Final condition';
            const payload = new MarkFacetPlainClass(payloadData);
            const markSchema = treeFromWML(deIndentWML('<Mark uuid=(MARK#123)><ShortName>Mark</ShortName></Mark>'))[0];
            const result = payload.renderFacet(reference, payloadData, markSchema);
            
            const aggregatedNode = result.aggregatedNode!;
            // Match should be first child
            expect(aggregatedNode.children[0].data.tag).toBe('Match');
            if (aggregatedNode.children[0].data.tag === 'Match') {
                const matchChild = aggregatedNode.children[0];
                const narrative = matchChild.children
                    .map(({ data }) => data)
                    .filter(isSchemaString)
                    .map(({ value }) => value)
                    .join('');
                expect(narrative).toBe('Final condition');
            }
            // Other children should follow
            expect(aggregatedNode.children.length).toBe(2);
            expect(aggregatedNode.children[1].data.tag).toBe('ShortName');
        });
    });

    describe('edge cases', () => {
        it('should handle empty narrative string', () => {
            const data: MarkFacetPayloadType = '';
            const payload = new MarkFacetPlainClass(data);
            expect(payload.toJSON()).toBe('');
            expect(payload.toJSON()).toBe('');
            
            // Schema should still generate Match tag with empty String child
            const schema = payload.schema;
            expect(schema[0].children[0].data.tag).toBe('String');
            if (schema[0].children[0].data.tag === 'String') {
                expect(schema[0].children[0].data.value).toBe('');
            }
        });

        it('should handle long narrative strings', () => {
            const longNarrative = 'A'.repeat(1000);
            const data: MarkFacetPayloadType = longNarrative;
            const payload = new MarkFacetPlainClass(data);
            expect(payload.toJSON()).toBe(longNarrative);
        });

        it('should handle special characters in narrative', () => {
            const specialNarrative = 'Test with "quotes" and <tags> and & symbols';
            const data: MarkFacetPayloadType = specialNarrative;
            const payload = new MarkFacetPlainClass(data);
            expect(payload.toJSON()).toBe(specialNarrative);
            
            // Verify it can be rendered
            const reference = new StandardReference('MARK#123', 'Mark');
            const result = payload.renderFacet(reference, data);
            expect(result.aggregatedNode).toBeDefined();
        });
    });
});
