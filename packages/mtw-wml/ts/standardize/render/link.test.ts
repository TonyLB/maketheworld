import { StandardRenderLink } from './link';
import { GenericTreeNode, GenericTreeNodeFiltered } from '@tonylb/mtw-base/ts/GenericTree';
import { SchemaLinkTag, SchemaOutputTag } from '../../schema/baseClasses';

describe('StandardRenderLink', () => {
    it('should create an instance with valid arguments', () => {
        const arg = {
            data: { to: 'Room1', text: 'Example', tag: 'Link' },
            children: []
        };
        const link = new StandardRenderLink(arg);
        expect(link._to).toBe('Room1');
        expect(link._text).toBe('Example');
    });

    it('should throw an error with invalid arguments', () => {
        const invalidArg = { data: { to: 'Room1', text: 'Example' }, children: ['child'] };
        expect(() => new StandardRenderLink(invalidArg)).toThrow('Invalid argument to StandardRenderLink constructor');
    });

    it('should return plain string', () => {
        const arg = {
            data: { to: 'Room1', text: 'Example', tag: 'Link' },
            children: []
        };
        const link = new StandardRenderLink(arg);
        expect(link.plainString).toBe('Example');
    });

    it('should round-trip JSON representation', () => {
        const arg: GenericTreeNodeFiltered<SchemaLinkTag, SchemaOutputTag> = {
            data: { to: 'Room1', text: 'Example', tag: 'Link' },
            children: [{ data: { tag: 'String', value: 'Example' }, children: [] }]
        };
        const link = new StandardRenderLink(arg);
        expect(link.toJSON()).toEqual(arg);
    });

    it('should round-trip NDJSON representation', () => {
        const arg: GenericTreeNode<SchemaLinkTag> = {
            data: { to: 'Room1', text: 'Example', tag: 'Link' },
            children: []
        };
        const link = new StandardRenderLink(arg);
        expect(link.toNDJSON()).toEqual(arg);
    });
});