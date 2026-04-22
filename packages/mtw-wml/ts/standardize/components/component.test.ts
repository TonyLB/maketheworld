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
import StandardReference from '../keys/reference'
import { deIndentWML } from '../../schema/utils'

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

describe('componentClassFactory removeReferences delegation (via StandardRoom)', () => {
    it('should delegate removeReferences to payload', () => {
        const room = new StandardRoom(deIndentWML(`
            <Room key=(test)>
                <Feature key=(feat1) />
                <Situation uuid=(DEFAULT)>
                    <DisplayName>Prose facet</DisplayName>
                </Situation>
            </Room>
        `))
        const featureRef = new StandardReference({ tag: 'Feature', key: 'feat1' })

        expect(room.features!.payload.length).toBe(1)
        expect(room.situations.length).toBe(1)
        expect(room.situations.items[0].reference.universalKey).toBe('SITUATION#DEFAULT')
        expect(room.examples!.payload.length).toBe(0)

        const result = room.removeReferences([featureRef]) as StandardRoom

        expect(result._payload.features.payload.length).toBe(0)
        expect(result._payload.examples.payload.length).toBe(0)
        expect(result.situations.length).toBe(1)
        expect(result.situations.items[0].reference.universalKey).toBe('SITUATION#DEFAULT')
        expect(result.situations.items[0].payload.toJSON()).toMatchObject({ displayName: 'Prose facet' })

        expect(result.features.payload.length).toBe(0)
        expect(room.features.payload.length).toBe(1)
        expect(room.situations.length).toBe(1)
    })
    
    it('should return unchanged component when payload does not implement removeReferences', () => {
        // Components without reference lists should return unchanged
        const room = new StandardRoom({ tag: 'Room', key: 'test' })
        const original = room.clone()
        
        const result = room.removeReferences([new StandardReference({ tag: 'Feature', key: 'feat1' })])
        
        // Should return a clone (not mutate original)
        expect(result).not.toBe(room)
        expect(result).not.toBe(original)
    })
})
