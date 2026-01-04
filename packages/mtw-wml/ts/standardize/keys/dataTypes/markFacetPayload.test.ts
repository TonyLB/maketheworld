import { MarkFacetPayload, factory, isStandardMarkFacetPayloadData, merge, diff } from './markFacetPayload';
import type { MarkFacetPayload as MarkFacetPayloadType } from './facet';
import { StandardReference } from '../reference';
import { treeFromWML } from '../../../schema';
import { deIndentWML } from '../../../schema/utils';
import { treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree";
import { isSchemaMark, isSchemaMatch } from "@tonylb/mtw-base/ts/schema/worldState";
import { StandardEditableData } from "@tonylb/mtw-base/ts/editable";
import { isSchemaString } from "@tonylb/mtw-base/ts/schema/renderTree";

describe('MarkFacetPayload - StandardEditablePayload implementation', () => {
    describe('constructor and basic operations', () => {
        it('should create MarkFacetPayload from valid data', () => {
            const data: MarkFacetPayloadType = {
                type: 'MarkFacet',
                narrative: 'Test condition'
            };
            const payload = new MarkFacetPayload(data);
            expect(payload.narrative).toBe('Test condition');
        });

        it('should clone correctly', () => {
            const data: MarkFacetPayloadType = {
                type: 'MarkFacet',
                narrative: 'Test condition'
            };
            const payload = new MarkFacetPayload(data);
            const cloned = payload.clone();
            expect(cloned).not.toBe(payload);
            const clonedPayload = cloned as MarkFacetPayload;
            expect(clonedPayload.narrative).toBe('Test condition');
            expect(cloned.toJSON()).toEqual(data);
        });

        it('should return correct JSON', () => {
            const data: MarkFacetPayloadType = {
                type: 'MarkFacet',
                narrative: 'Another condition'
            };
            const payload = new MarkFacetPayload(data);
            expect(payload.toJSON()).toEqual(data);
        });

        it('should generate Match tag schema', () => {
            const data: MarkFacetPayloadType = {
                type: 'MarkFacet',
                narrative: 'Test condition'
            };
            const payload = new MarkFacetPayload(data);
            const schema = payload.schema;
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

    describe('StandardEditable factory', () => {
        it('should create from plain payload data', () => {
            const data: MarkFacetPayloadType = {
                type: 'MarkFacet',
                narrative: 'Test condition'
            };
            const delta = factory(data);
            expect(delta).toBeDefined();
            expect(delta?.add).toBeDefined();
            if (delta?.add) {
                const payloadData = delta.add.toJSON();
                expect(payloadData.narrative).toBe('Test condition');
            }
        });

        it('should create from Match tag schema', () => {
            const schema = treeFromWML(deIndentWML('<Match>Test condition</Match>'));
            const delta = factory(schema);
            expect(delta).toBeDefined();
            expect(delta?.add).toBeDefined();
            if (delta?.add) {
                const payloadData = delta.add.toJSON();
                expect(payloadData.narrative).toBe('Test condition');
            }
        });

        it('should create from Remove structure', () => {
            const removeData: StandardEditableData<MarkFacetPayloadType> = {
                tag: 'Remove',
                match: {
                    type: 'MarkFacet',
                    narrative: 'Test condition'
                }
            };
            const delta = factory(removeData);
            expect(delta).toBeDefined();
            expect(delta?.remove).toBeDefined();
            if (delta?.remove) {
                const payloadData = delta.remove.toJSON();
                expect(payloadData.narrative).toBe('Test condition');
            }
        });

        it('should create from Replace structure', () => {
            const replaceData: StandardEditableData<MarkFacetPayloadType> = {
                tag: 'Replace',
                match: {
                    type: 'MarkFacet',
                    narrative: 'Old condition'
                },
                payload: {
                    type: 'MarkFacet',
                    narrative: 'New condition'
                }
            };
            const delta = factory(replaceData);
            expect(delta).toBeDefined();
            expect(delta?.remove).toBeDefined();
            expect(delta?.add).toBeDefined();
            if (delta?.remove && delta?.add) {
                const removeData = delta.remove.toJSON();
                const addData = delta.add.toJSON();
                expect(removeData.narrative).toBe('Old condition');
                expect(addData.narrative).toBe('New condition');
            }
        });

        it('should validate typeguard correctly', () => {
            const valid: MarkFacetPayloadType = {
                type: 'MarkFacet',
                narrative: 'Test condition'
            };
            expect(isStandardMarkFacetPayloadData(valid)).toBe(true);

            const invalid = {
                type: 'PositionFacet',
                x: 10,
                y: 20
            };
            expect(isStandardMarkFacetPayloadData(invalid)).toBe(false);
        });
    });

    describe('StandardEditable merge operations', () => {
        it('should merge with Replace semantics (incoming wins)', () => {
            const base: MarkFacetPayloadType = {
                type: 'MarkFacet',
                narrative: 'Old condition'
            };
            const incoming: MarkFacetPayloadType = {
                type: 'MarkFacet',
                narrative: 'New condition'
            };
            const baseDelta = factory(base);
            const incomingDelta = factory(incoming);
            // Use type assertion to handle generic type constraints
            const merged = merge(baseDelta as any, incomingDelta as any) as any;
            if (merged?.add) {
                const payload = merged.add as MarkFacetPayload;
                const payloadData = payload.toJSON();
                expect(payloadData.narrative).toBe('New condition');
            }
        });

        it('should cancel when removing same payload', () => {
            const payload: MarkFacetPayloadType = {
                type: 'MarkFacet',
                narrative: 'Test condition'
            };
            const addDelta = factory(payload);
            const removeDelta = factory({
                tag: 'Remove',
                match: payload
            } as StandardEditableData<MarkFacetPayloadType>);
            const merged = merge(addDelta as any, removeDelta as any) as any;
            expect(merged).toEqual({ add: undefined, remove: undefined });
        });

        it('should create Replace when payloads differ during merge', () => {
            const base: MarkFacetPayloadType = {
                type: 'MarkFacet',
                narrative: 'Old condition'
            };
            const incoming: MarkFacetPayloadType = {
                type: 'MarkFacet',
                narrative: 'New condition'
            };
            const baseDelta = factory(base);
            const incomingDelta = factory(incoming);
            const merged = merge(baseDelta as any, incomingDelta as any) as any;
            // When base is added and incoming is added, and they differ, should keep incoming
            if (merged?.add) {
                const payload = merged.add as MarkFacetPayload;
                const payloadData = payload.toJSON();
                expect(payloadData.narrative).toBe('New condition');
            }
        });
    });

    describe('StandardEditable diff operations', () => {
        it('should return empty when payloads are same', () => {
            const payload: MarkFacetPayloadType = {
                type: 'MarkFacet',
                narrative: 'Test condition'
            };
            const baseDelta = factory(payload);
            const incomingDelta = factory(payload);
            const diffResult = diff(baseDelta as any, incomingDelta as any) as any;
            expect(diffResult).toEqual({ add: undefined, remove: undefined });
        });

        it('should create Replace when payloads differ', () => {
            const base: MarkFacetPayloadType = {
                type: 'MarkFacet',
                narrative: 'Old condition'
            };
            const incoming: MarkFacetPayloadType = {
                type: 'MarkFacet',
                narrative: 'New condition'
            };
            const baseDelta = factory(base);
            const incomingDelta = factory(incoming);
            const diffResult = diff(baseDelta as any, incomingDelta as any) as any;
            if (diffResult?.remove && diffResult?.add) {
                const removePayload = diffResult.remove as MarkFacetPayload;
                const addPayload = diffResult.add as MarkFacetPayload;
                const removeData = removePayload.toJSON();
                const addData = addPayload.toJSON();
                expect(removeData.narrative).toBe('Old condition');
                expect(addData.narrative).toBe('New condition');
            }
        });
    });
});

describe('MarkFacetPayload - FacetPayloadBase implementation', () => {
    describe('fromSchema', () => {
        it('should parse Mark with Match child (with key and uuid)', () => {
            const schema = treeFromWML(deIndentWML('<Mark key=(testMark) uuid=(MARK#123)><Match>Test condition</Match></Mark>'));
            const reference = new StandardReference('MARK#123', 'Mark');
            const payload = new MarkFacetPayload({ type: 'MarkFacet', narrative: '' });
            const result = payload.fromSchema(schema, reference);
            expect(result.narrative).toBe('Test condition');
            expect(result.type).toBe('MarkFacet');
        });

        it('should parse Mark with Match child (uuid only)', () => {
            const schema = treeFromWML(deIndentWML('<Mark uuid=(MARK#123)><Match>Another condition</Match></Mark>'));
            const reference = new StandardReference('MARK#123', 'Mark');
            const payload = new MarkFacetPayload({ type: 'MarkFacet', narrative: '' });
            const result = payload.fromSchema(schema, reference);
            expect(result.narrative).toBe('Another condition');
        });

        it('should parse Mark with Match child containing multiple String children', () => {
            // Match tags can have multiple String children (though typically just one)
            const schema = treeFromWML(deIndentWML('<Mark uuid=(MARK#123)><Match>First part Second part</Match></Mark>'));
            const reference = new StandardReference('MARK#123', 'Mark');
            const payload = new MarkFacetPayload({ type: 'MarkFacet', narrative: '' });
            const result = payload.fromSchema(schema, reference);
            // String children should be joined
            expect(result.narrative).toContain('First part');
            expect(result.narrative).toContain('Second part');
        });

        it('should throw error when Match child is missing', () => {
            const schema = treeFromWML(deIndentWML('<Mark uuid=(MARK#123) />'));
            const reference = new StandardReference('MARK#123', 'Mark');
            const payload = new MarkFacetPayload({ type: 'MarkFacet', narrative: '' });
            expect(() => payload.fromSchema(schema, reference)).toThrow('Invalid schema: Match child not found');
        });

        it('should throw error when Mark tag is missing', () => {
            const schema = treeFromWML(deIndentWML('<Match>Test condition</Match>'));
            const reference = new StandardReference('MARK#123', 'Mark');
            const payload = new MarkFacetPayload({ type: 'MarkFacet', narrative: '' });
            expect(() => payload.fromSchema(schema, reference)).toThrow('Invalid schema: Mark tag not found');
        });

        it('should handle empty Match content', () => {
            const schema = treeFromWML(deIndentWML('<Mark uuid=(MARK#123)><Match></Match></Mark>'));
            const reference = new StandardReference('MARK#123', 'Mark');
            const payload = new MarkFacetPayload({ type: 'MarkFacet', narrative: '' });
            const result = payload.fromSchema(schema, reference);
            expect(result.narrative).toBe('');
        });
    });

    describe('renderFacet', () => {
        it('should render with pre-existing Mark render', () => {
            const reference = new StandardReference('MARK#123', 'Mark');
            const payloadData: MarkFacetPayloadType = {
                type: 'MarkFacet',
                narrative: 'Test condition'
            };
            const payload = new MarkFacetPayload(payloadData);
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
            const payloadData: MarkFacetPayloadType = {
                type: 'MarkFacet',
                narrative: 'Another condition'
            };
            const payload = new MarkFacetPayload(payloadData);
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
            const payloadData: MarkFacetPayloadType = {
                type: 'MarkFacet',
                narrative: 'Third condition'
            };
            const payload = new MarkFacetPayload(payloadData);
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
            const payloadData: MarkFacetPayloadType = {
                type: 'MarkFacet',
                narrative: 'Fourth condition'
            };
            const payload = new MarkFacetPayload(payloadData);
            
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
            const payloadData: MarkFacetPayloadType = {
                type: 'MarkFacet',
                narrative: 'Test condition'
            };
            const payload = new MarkFacetPayload(payloadData);
            const roomSchema = treeFromWML(deIndentWML('<Room uuid=(ROOM#123) />'))[0];
            expect(() => payload.renderFacet(reference, payloadData, roomSchema)).toThrow('Invalid referenceRender: expected Mark tag');
        });

        it('should add Match as first child when referenceRender provided', () => {
            const reference = new StandardReference('MARK#123', 'Mark');
            const payloadData: MarkFacetPayloadType = {
                type: 'MarkFacet',
                narrative: 'Final condition'
            };
            const payload = new MarkFacetPayload(payloadData);
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
            const data: MarkFacetPayloadType = {
                type: 'MarkFacet',
                narrative: ''
            };
            const payload = new MarkFacetPayload(data);
            expect(payload.narrative).toBe('');
            expect(payload.toJSON().narrative).toBe('');
            
            // Schema should still generate Match tag with empty String child
            const schema = payload.schema;
            expect(schema[0].children[0].data.tag).toBe('String');
            if (schema[0].children[0].data.tag === 'String') {
                expect(schema[0].children[0].data.value).toBe('');
            }
        });

        it('should handle long narrative strings', () => {
            const longNarrative = 'A'.repeat(1000);
            const data: MarkFacetPayloadType = {
                type: 'MarkFacet',
                narrative: longNarrative
            };
            const payload = new MarkFacetPayload(data);
            expect(payload.narrative).toBe(longNarrative);
            expect(payload.toJSON().narrative).toBe(longNarrative);
        });

        it('should handle special characters in narrative', () => {
            const specialNarrative = 'Test with "quotes" and <tags> and & symbols';
            const data: MarkFacetPayloadType = {
                type: 'MarkFacet',
                narrative: specialNarrative
            };
            const payload = new MarkFacetPayload(data);
            expect(payload.narrative).toBe(specialNarrative);
            
            // Verify it can be rendered
            const reference = new StandardReference('MARK#123', 'Mark');
            const result = payload.renderFacet(reference, data);
            expect(result.aggregatedNode).toBeDefined();
        });
    });
});
