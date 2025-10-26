/**
 * S3 Storage Tools Tests
 * 
 * Tests for low-level utility functions used across storage operations.
 */

import { buildPrefix, ManifestSuffix } from './tools'

describe('buildPrefix', () => {
    describe('content prefixes', () => {
        it('should build content prefix from asset ID', () => {
            const result = buildPrefix('ASSET#my-room', 'wml')
            expect(result).toBe('my-room.wml/')
        })
        
        it('should strip ASSET# prefix', () => {
            const result = buildPrefix('ASSET#test-123', 'wml')
            expect(result).toBe('test-123.wml/')
        })

    })
    
    describe('authorization prefixes', () => {
        it('should build auth prefix from asset ID', () => {
            const result = buildPrefix('ASSET#my-room', 'auth.wml')
            expect(result).toBe('my-room.auth.wml/')
        })
        
        it('should handle auth suffix correctly', () => {
            const result = buildPrefix('ASSET#test', 'auth.wml')
            expect(result).toBe('test.auth.wml/')
        })
    })
    
    describe('edge cases', () => {
        it('should handle primitives asset', () => {
            const result = buildPrefix('ASSET#primitives', 'wml')
            expect(result).toBe('primitives.wml/')
        })
        
        it('should handle UUIDs with special characters', () => {
            const result = buildPrefix('ASSET#abc-123-def-456', 'wml')
            expect(result).toBe('abc-123-def-456.wml/')
        })
        
        it('should handle asset IDs without ASSET# prefix gracefully', () => {
            // Edge case: what if someone passes a bare UUID?
            const result = buildPrefix('bare-uuid' as any, 'wml')
            // Current implementation will just return the value as-is
            expect(result).toBe('bare-uuid.wml/')
        })
    })
    
})

