import { ExitFacetPayload } from '../exit';
import type { ExitPayload as ExitPayloadType } from './facet';
import { StandardReference } from '../../reference';
import { treeFromWML } from '../../../../schema';
import { deIndentWML } from '../../../../schema/utils';
import { treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree";
import { isSchemaExit } from "@tonylb/mtw-base/ts/schema/components";

describe('ExitFacetPayload - ExitFacetPayload-specific functionality', () => {
    // Note: Basic StandardLiteral functionality (constructor, clone, toJSON, merge, diff, etc.)
    // is tested in StandardLiteral tests. We only test ExitFacetPayload-specific overrides here.

    it('should normalize undefined to empty string for StandardLiteral (toJSON converts back)', () => {
        // ExitFacetPayload normalizes undefined ↔ empty string for StandardLiteral compatibility
        const payloadWithUndefined = new ExitFacetPayload(undefined);
        expect(payloadWithUndefined.toJSON()).toBeUndefined();
        
        const payloadWithString = new ExitFacetPayload('North Exit');
        expect(payloadWithString.toJSON()).toBe('North Exit');
    });
});

describe('ExitFacetPayload - FacetPayloadBase implementation', () => {
    describe('fromSchema', () => {
        it('should parse Exit tag with description (key and uuid)', () => {
            const schema = treeFromWML(deIndentWML('<Exit to=(ROOM#123)>North Exit</Exit>'));
            const reference = new StandardReference('ROOM#123', 'Room');
            const payload = new ExitFacetPayload(undefined);
            const result = payload.fromSchema(schema, reference);
            expect(result).toBe('North Exit');
        });

        it('should parse Exit tag with description (uuid only)', () => {
            const schema = treeFromWML(deIndentWML('<Exit to=(ROOM#456)>South Exit</Exit>'));
            const reference = new StandardReference('ROOM#456', 'Room');
            const payload = new ExitFacetPayload(undefined);
            const result = payload.fromSchema(schema, reference);
            expect(result).toBe('South Exit');
        });

        it('should parse Exit tag without description', () => {
            const schema = treeFromWML(deIndentWML('<Exit to=(ROOM#789) />'));
            const reference = new StandardReference('ROOM#789', 'Room');
            const payload = new ExitFacetPayload(undefined);
            const result = payload.fromSchema(schema, reference);
            expect(result).toBeUndefined();
        });

        it('should parse Exit tag with description containing multiple String children', () => {
            // Exit tags can have multiple String children (though typically just one)
            const schema = treeFromWML(deIndentWML('<Exit to=(ROOM#123)>First part Second part</Exit>'));
            const reference = new StandardReference('ROOM#123', 'Room');
            const payload = new ExitFacetPayload(undefined);
            const result = payload.fromSchema(schema, reference);
            // String children should be joined
            expect(result).toContain('First part');
            expect(result).toContain('Second part');
        });

        it('should throw error when Exit tag is missing', () => {
            const schema = treeFromWML(deIndentWML('<Room uuid=(ROOM#123) />'));
            const reference = new StandardReference('ROOM#123', 'Room');
            const payload = new ExitFacetPayload(undefined);
            expect(() => payload.fromSchema(schema, reference)).toThrow('Invalid schema: Exit tag not found');
        });

        it('should handle empty Exit content', () => {
            const schema = treeFromWML(deIndentWML('<Exit to=(ROOM#123)></Exit>'));
            const reference = new StandardReference('ROOM#123', 'Room');
            const payload = new ExitFacetPayload(undefined);
            const result = payload.fromSchema(schema, reference);
            expect(result).toBeUndefined();
        });
    });

    describe('renderFacet', () => {
        it('should render Exit tag with description (always returns newNode)', () => {
            const reference = new StandardReference({ key: 'testRoom', universalKey: 'ROOM#123', tag: 'Room' });
            const payloadData: ExitPayloadType = 'North Exit';
            const payload = new ExitFacetPayload(payloadData);
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
            const payload = new ExitFacetPayload(payloadData);
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
            const payload = new ExitFacetPayload(payloadData);
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
            const payload = new ExitFacetPayload(payloadData);
            
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
            const payload = new ExitFacetPayload(payloadData);
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
            const payload = new ExitFacetPayload(payloadData);
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
            const payload = new ExitFacetPayload(data);
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
            const payload = new ExitFacetPayload(data);
            expect(payload.toJSON()).toBe(longDescription);
        });

        it('should handle special characters in description', () => {
            const specialDescription = 'Exit with "quotes" and <tags> and & symbols';
            const data: ExitPayloadType = specialDescription;
            const payload = new ExitFacetPayload(data);
            expect(payload.toJSON()).toBe(specialDescription);
            
            // Verify it can be rendered
            const reference = new StandardReference('ROOM#123', 'Room');
            const result = payload.renderFacet(reference, data);
            expect(result.newNode).toBeDefined();
        });

    });
});
