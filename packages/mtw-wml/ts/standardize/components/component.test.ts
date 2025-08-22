/**
 * Test file for componentClassFactory general functionality
 * 
 * NOTE: Because componentClassFactory generates abstract classes that need to be extended,
 * we test its general features using StandardRoom as a proxy. StandardRoom extends
 * componentClassFactory and provides a concrete implementation that allows us to test
 * the factory's behavior without creating mock classes.
 * 
 * This approach allows us to test the actual componentClassFactory behavior in a real
 * component context, ensuring that our tests reflect how the factory actually works
 * in production code.
 * 
 * We will address the question of whether there are existing tests currently in 
 * room.test.ts that belong in component.test.ts at a later time.
 */

import { StandardRoom } from './room'
import { GenericTreeNode } from '@tonylb/mtw-base/ts/genericTree'
import { SchemaTag } from '@tonylb/mtw-base/ts/schema'
import { ComponentConstructorMethods, v2ComponentClassFactory } from './component'

// Type for schema data that includes origin property
type SchemaWithOrigin = SchemaTag & {
    origin?: string[]
}

describe('componentClassFactory origin handling (via StandardRoom)', () => {
    it('should set origin when constructing from schema with origin', () => {
        const schemaNode: GenericTreeNode<SchemaWithOrigin> = {
            data: {
                tag: 'Room',
                key: 'testRoom',
                origin: ['ASSET#123', 'ASSET#456']
            },
            children: []
        }
        
        const room = new StandardRoom(schemaNode)
        expect(room['_origin']).toEqual(['ASSET#123', 'ASSET#456'])
    })

    it('should include origin in toJSON output', () => {
        const room = new StandardRoom('testRoom')
        room['_origin'] = ['ASSET#123', 'ASSET#456']
        
        const json = room.toJSON() as any
        expect(json.origin).toEqual(['ASSET#123', 'ASSET#456'])
    })

    it('should include origin in schema output', () => {
        const room = new StandardRoom('testRoom')
        room['_origin'] = ['ASSET#123', 'ASSET#456']
        
        const schema = room.schema
        expect((schema.data as SchemaWithOrigin).origin).toEqual(['ASSET#123', 'ASSET#456'])
    })

    it('should merge origin properties correctly', () => {
        const room1 = new StandardRoom('testRoom')
        room1['_origin'] = ['ASSET#123']
        
        const room2 = new StandardRoom('testRoom')
        room2['_origin'] = ['ASSET#456']
        
        const merged = room1.merge(room2)
        expect(merged['_origin']).toEqual(['ASSET#123'])
    })

    it('should copy origin when cloning', () => {
        const room = new StandardRoom('testRoom')
        room['_origin'] = ['ASSET#123', 'ASSET#456']
        
        const cloned = room.clone()
        expect(cloned['_origin']).toEqual(['ASSET#123', 'ASSET#456'])
    })

    it('should set origin using withOrigin method', () => {
        const room = new StandardRoom('testRoom')
        const withOrigin = room.withOrigin(['ASSET#123', 'ASSET#456'])
        
        expect(withOrigin['_origin']).toEqual(['ASSET#123', 'ASSET#456'])
        expect(room['_origin']).toBeUndefined() // Original should be unchanged
    })

    it('should handle undefined origin correctly in all methods', () => {
        const room = new StandardRoom('testRoom')
        // _origin should be undefined by default
        
        const json = room.toJSON() as any
        expect(json.origin).toBeUndefined()
        
        const schema = room.schema
        expect((schema.data as SchemaWithOrigin).origin).toBeUndefined()
    })

    it('should handle empty origin array correctly', () => {
        const room = new StandardRoom('testRoom')
        room['_origin'] = []
        
        const json = room.toJSON() as any
        expect(json.origin).toEqual([])
        
        const schema = room.schema
        expect((schema.data as SchemaWithOrigin).origin).toEqual([])
    })
})

describe('v2ComponentClassFactory', () => {
    describe('create method', () => {
        // Simple test class for Image tag
        class StandardTestPayload implements ComponentConstructorMethods<{ tag: 'Image' }> {
            tag = 'Image' as const;
            
            fromJSON(data: any): void {}
            fromSchema(node: any): void {}
            subset(options: any): this { return this; }
            merge(incoming: any): this { return this; }
            toJSON(): any { return {}; }
            schema(): any { return { data: { tag: 'ShortName' }, children: [] }; }
            referencedKeys(): any[] { return []; }
            mapContents(callback: any): this { return this; }
        }
        
        const { GeneratedV2ComponentClass, GeneratedV2ComponentPlainClass, GeneratedV2ComponentRemoveClass, GeneratedV2ComponentReplaceClass } = v2ComponentClassFactory(StandardTestPayload, 'StandardTest');
        
        it('should create StandardTestContent for simple <Image /> tag', () => {
            const component = GeneratedV2ComponentClass.create('<Image />');
            expect(component).toBeDefined();
            expect(component).toBeInstanceOf(GeneratedV2ComponentPlainClass);
        });
        
        it('should create StandardTestRemove for <Remove> tag', () => {
            const component = GeneratedV2ComponentClass.create('<Remove><Image /></Remove>');
            expect(component).toBeDefined();
            expect(component).toBeInstanceOf(GeneratedV2ComponentRemoveClass);
        });
        
        it('should create StandardTestReplace for <Replace> tag', () => {
            const component = GeneratedV2ComponentClass.create('<Replace><Image /></Replace><With><Image /></With>');
            expect(component).toBeDefined();
            expect(component).toBeInstanceOf(GeneratedV2ComponentReplaceClass);
        });
    });
});
