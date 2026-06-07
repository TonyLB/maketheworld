import { isRenderTreeNode, isRenderTree, renderTreeToString } from './renderTree';
import { SchemaOutputTag } from './schema';

describe('renderTree tests', () => {
    describe('isRenderTreeNode', () => {
        it('should return true for valid string RenderTreeNode', () => {
            const node = "valid string node";
            expect(isRenderTreeNode(node)).toBe(true);
        });

        it('should return true for valid object RenderTreeNode', () => {
            const node = {
                data: { tag: 'Link', to: 'url', text: 'text' },
                children: ["text"]
            };
            expect(isRenderTreeNode(node)).toBe(true);
        });

        it('should return false for invalid object RenderTreeNode', () => {
            const node = {
                data: { tag: 'Invalid' },
                children: ["child1", "child2"]
            };
            expect(isRenderTreeNode(node)).toBe(false);
        });

        it('should return false for object RenderTreeNode with invalid children', () => {
            const node = {
                data: { tag: 'Link', to: 'url', text: 'text' },
                children: [123]
            };
            expect(isRenderTreeNode(node)).toBe(false);
        });
    });

    describe('isRenderTree', () => {
        it('should return true for valid RenderTree', () => {
            const tree = [
                "valid string node",
                {
                    data: { tag: 'Link', to: 'url', text: 'text' },
                    children: []
                },
                {
                    data: { tag: 'Space' },
                    children: []
                }
            ];
            expect(isRenderTree(tree)).toBe(true);
        });

        it('should return false for invalid RenderTree', () => {
            const tree = [
                "valid string node",
                {
                    data: { tag: 'Invalid' },
                    children: ["child1", "child2"]
                }
            ];
            expect(isRenderTree(tree)).toBe(false);
        });

        it('should return false for RenderTree with invalid children', () => {
            const tree = [
                "valid string node",
                {
                    data: { tag: 'Link', to: 'url', text: 'text' },
                    children: [{
                        data: { tag: 'Space' },
                        children: ["child1", 123]
                    }]
                }
            ];
            expect(isRenderTree(tree)).toBe(false);
        });
    });

    describe('renderTreeToString', () => {
        it('should map DoubleSpace and DoubleBR to plain string representation', () => {
            expect(renderTreeToString([
                'Hello',
                { data: { tag: 'DoubleSpace' }, children: [] },
                'world',
                { data: { tag: 'DoubleBR' }, children: [] },
                'Last'
            ])).toBe('Hello  world\n\nLast')
        });
    });
});