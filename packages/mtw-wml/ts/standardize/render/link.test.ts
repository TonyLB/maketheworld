import { StandardRenderLink } from './link';
import { GenericTreeNode, GenericTreeNodeFiltered } from '@tonylb/mtw-base/ts/genericTree';
import StandardReference, { StandardKey } from '../components/reference';
import { SchemaLinkTag } from '@tonylb/mtw-base/ts/schema/renderTree';
import { SchemaOutputTag } from '@tonylb/mtw-base/ts/schema';

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

    it('should remap a reference to key format', () => {
        const arg = {
            data: { to: 'ROOM#Room1', text: 'Example', tag: 'Link' },
            children: []
        };
        const link = new StandardRenderLink(arg);
        const mapping = [new StandardReference({ key: 'Room1', tag: 'Room', universalKey: 'ROOM#Room1' })];
        const remappedLink = link.remapReferences({ mapping, mapTo: 'key' });
        expect(remappedLink._to).toBeInstanceOf(StandardKey);
        expect((remappedLink._to as StandardKey).key).toBe('Room1');
    })

    it('should remap a reference to universal format', () => {
        const arg = {
            data: { to: 'Room1', text: 'Example', tag: 'Link' },
            children: []
        };
        const link = new StandardRenderLink(arg);
        const mapping = [new StandardReference({ key: 'Room1', tag: 'Room', universalKey: 'ROOM#Room1' })];
        const remappedLink = link.remapReferences({ mapping, mapTo: 'universal' });
        expect(remappedLink._to).toBeInstanceOf(StandardKey);
        expect((remappedLink._to as StandardKey).universalKey).toBe('ROOM#Room1');
    })

    it('should remap a reference to both format', () => {
        const arg = {
            data: { to: 'Room1', text: 'Example', tag: 'Link' },
            children: []
        };
        const link = new StandardRenderLink(arg);
        const mapping = [new StandardReference({ key: 'Room1', tag: 'Room', universalKey: 'ROOM#Room1' })];
        const remappedLink = link.remapReferences({ mapping, mapTo: 'both' });
        expect(remappedLink._to).toBeInstanceOf(StandardKey);
        expect((remappedLink._to as StandardKey).universalKey).toBe('ROOM#Room1');
        expect((remappedLink._to as StandardKey).key).toBe('Room1');
    })

    it('should remap from StandardKey', () => {
        const arg = new StandardRenderLink({
            data: { to: 'Room1', text: 'Example', tag: 'Link' },
            children: []
        });
        const mapping = [new StandardReference({ key: 'Room1', tag: 'Room', universalKey: 'ROOM#Room1' })];
        const firstRemap = arg.remapReferences({ mapping, mapTo: 'universal' });
        const remappedLink = firstRemap.remapReferences({ mapping, mapTo: 'key' });
        expect(remappedLink._to).toBeInstanceOf(StandardKey);
        expect((remappedLink._to as StandardKey).key).toBe('Room1');
    })
});