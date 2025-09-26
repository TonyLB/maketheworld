import { jest, describe, it, expect, beforeEach } from '@jest/globals'

// Mock AWS SDK
jest.mock('@aws-sdk/client-s3')
import { CopyObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'

// Mock internal cache
jest.mock('../../internalCache')
import internalCache from '../../internalCache'

// Mock asset workspace
jest.mock('@tonylb/mtw-asset-workspace/ts/readOnly', () => {
    return jest.fn().mockImplementation((address: any) => {
        return {
            address,
            status: {
                json: 'Clean'
            },
            get fileNameBase() {
                if (address.zone === 'Personal') {
                    return `Personal/${address.player}/${address.fileName}`
                } else if (address.zone === 'Archive') {
                    return `Archive/${address.backupId}/${address.fileName}`
                } else {
                    return `${address.zone}/${address.fileName}`
                }
            },
            loadJSON: jest.fn()
        }
    })
})
import ReadOnlyAssetWorkspace from '@tonylb/mtw-asset-workspace/ts/readOnly'

import { moveAsset, MoveAssetResponse } from './index'
import { MoveAssetRequest, isMoveAssetRequest } from '../../messageBus/baseClasses'

const ReadOnlyAssetWorkspaceMock = ReadOnlyAssetWorkspace as jest.Mocked<typeof ReadOnlyAssetWorkspace>
const internalCacheMock = jest.mocked(internalCache, { shallow: false })

describe('moveAsset', () => {
    let mockS3Client: any

    beforeEach(() => {
        jest.clearAllMocks()
        
        // Mock S3 client following assets lambda pattern
        mockS3Client = {
            send: jest.fn()
        }
        internalCacheMock.Connection.get.mockResolvedValue(mockS3Client as any)
        
        
    })

    describe('isMoveAssetRequest', () => {
        it('should validate a proper MoveAssetRequest', () => {
            const validRequest: MoveAssetRequest = {
                assetId: 'test-asset',
                fromZone: 'Personal',
                toZone: 'Library',
                player: 'alice',
                subFolder: 'adventures'
            }
            
            expect(isMoveAssetRequest(validRequest)).toBe(true)
        })

        it('should reject invalid requests', () => {
            expect(isMoveAssetRequest({})).toBe(false)
            expect(isMoveAssetRequest({ assetId: 'test' })).toBe(false)
            expect(isMoveAssetRequest({ assetId: 'test', fromZone: 'Personal' })).toBe(false)
            expect(isMoveAssetRequest({ assetId: 'test', fromZone: 'Personal', toZone: 'Library' })).toBe(true)
        })

        it('should handle optional fields correctly', () => {
            const minimalRequest = {
                assetId: 'test-asset',
                fromZone: 'Personal',
                toZone: 'Library'
            }
            
            expect(isMoveAssetRequest(minimalRequest)).toBe(true)
        })
    })

    describe('moveAsset', () => {
        it('should successfully move asset between zones', async () => {
            const request: MoveAssetRequest = {
                assetId: 'test-asset',
                fromZone: 'Personal',
                toZone: 'Library',
                player: 'alice'
            }
            
            const result = await moveAsset(request)
            
            expect(result.success).toBe(true)
            expect(result.message).toContain('Files successfully moved')
            expect(result.newLocation).toBe('Library/test-asset')
            
            // Verify S3 operations were called (4 calls: 2 copy + 2 delete)
            expect(mockS3Client.send).toHaveBeenCalledTimes(4)
            
            // Verify CopyObjectCommand was called with correct parameters
            expect(CopyObjectCommand).toHaveBeenCalledWith({
                Bucket: undefined,
                CopySource: 'undefined/Personal/alice/test-asset.ndjson',
                Key: 'Library/test-asset.ndjson'
            })
            
            expect(CopyObjectCommand).toHaveBeenCalledWith({
                Bucket: undefined,
                CopySource: 'undefined/Personal/alice/test-asset.wml',
                Key: 'Library/test-asset.wml'
            })
            
            // Verify DeleteObjectCommand was called with correct parameters
            expect(DeleteObjectCommand).toHaveBeenCalledWith({
                Bucket: undefined,
                Key: 'Personal/alice/test-asset.wml'
            })
            
            expect(DeleteObjectCommand).toHaveBeenCalledWith({
                Bucket: undefined,
                Key: 'Personal/alice/test-asset.ndjson'
            })
        })

        it('should handle Archive zone correctly', async () => {
            const request: MoveAssetRequest = {
                assetId: 'test-asset',
                fromZone: 'Library',
                toZone: 'Archive'
            }
            
            const result = await moveAsset(request)
            
            expect(result.success).toBe(true)
            expect(result.message).toContain('Asset archived (files deleted from source location)')
            
            // Verify only delete operations were called (no copy for Archive)
            const copyCalls = mockS3Client.send.mock.calls.filter(call => 
                call[0].constructor.name === 'CopyObjectCommand'
            )
            expect(copyCalls).toHaveLength(0)
            
            // Verify delete operations
            expect(DeleteObjectCommand).toHaveBeenCalledWith({
                Bucket: undefined,
                Key: 'Library/test-asset.wml'
            })
            
            expect(DeleteObjectCommand).toHaveBeenCalledWith({
                Bucket: undefined,
                Key: 'Library/test-asset.ndjson'
            })
        })

        it('should handle dirty asset state', async () => {
            // Mock asset workspace to return dirty state
            const mockWorkspace = {
                address: { zone: 'Personal', player: 'alice', fileName: 'test-asset' },
                status: { json: 'Dirty' },
                fileNameBase: 'Personal/alice/test-asset',
                loadJSON: jest.fn()
            }
            ReadOnlyAssetWorkspaceMock.mockImplementation(() => mockWorkspace as any)
            
            const request: MoveAssetRequest = {
                assetId: 'test-asset',
                fromZone: 'Personal',
                toZone: 'Library',
                player: 'alice'
            }
            
            const result = await moveAsset(request)
            
            expect(result.success).toBe(false)
            expect(result.message).toContain('not in a clean state')
            expect(result.message).toContain('Dirty')
        })

        it('should handle S3 errors gracefully', async () => {
            // Mock workspace to return Clean status for this test
            ReadOnlyAssetWorkspaceMock.mockImplementation((address) => ({
                address,
                status: {
                    json: 'Clean',
                    wml: 'Clean'
                },
                get fileNameBase() {
                    if (address.zone === 'Personal') {
                        return 'Personal/alice/test-asset'
                    } else if (address.zone === 'Archive') {
                        return 'Archive/BACKUP#123/test-asset'
                    } else {
                        return `${address.zone}/test-asset`
                    }
                },
                loadJSON: jest.fn(),
                authStatus: {
                    json: 'Clean',
                    wml: 'Clean'
                },
                _isGlobal: false,
                filePath: '',
                fileName: 'test-asset',
                normal: {},
                namespaceIdToDB: [],
                rootNodes: [],
                forceDefault: jest.fn(),
                presignedURL: jest.fn(),
                setWorkspaceLookup: jest.fn(),
                loadAuthorizationJSON: jest.fn()
            }))
            
            // Mock S3 client to throw error on copy operations
            mockS3Client.send.mockImplementation((command: any) => {
                if (command.constructor.name === 'CopyObjectCommand') {
                    return Promise.reject(new Error('S3 operation failed'))
                }
                return Promise.resolve({})
            })
            
            const request: MoveAssetRequest = {
                assetId: 'test-asset',
                fromZone: 'Personal',
                toZone: 'Library',
                player: 'alice'
            }
            
            const result = await moveAsset(request)
            
            expect(result.success).toBe(false)
            expect(result.message).toContain('S3 operation failed')
        })

        it('should handle requests without optional fields', async () => {
            // Reset mock to default Clean status
            ReadOnlyAssetWorkspaceMock.mockImplementation((address) => ({
                address,
                status: {
                    json: 'Clean',
                    wml: 'Clean'
                },
                get fileNameBase() {
                    if (address.zone === 'Personal') {
                        return 'Personal/alice/test-asset'
                    } else if (address.zone === 'Archive') {
                        return 'Archive/BACKUP#123/test-asset'
                    } else {
                        return `${address.zone}/test-asset`
                    }
                },
                loadJSON: jest.fn(),
                authStatus: {
                    json: 'Clean',
                    wml: 'Clean'
                },
                _isGlobal: false,
                filePath: '',
                fileName: 'test-asset',
                normal: {},
                namespaceIdToDB: [],
                rootNodes: [],
                forceDefault: jest.fn(),
                presignedURL: jest.fn(),
                setWorkspaceLookup: jest.fn(),
                loadAuthorizationJSON: jest.fn()
            }))
            
            const request: MoveAssetRequest = {
                assetId: 'test-asset',
                fromZone: 'Library',
                toZone: 'Canon'
            }
            
            const result = await moveAsset(request)
            
            expect(result.success).toBe(true)
            expect(result.newLocation).toBe('Canon/test-asset')
        })

        it('should extract fileName from AssetId with ASSET# prefix', async () => {
            // Reset mock to default Clean status
            ReadOnlyAssetWorkspaceMock.mockImplementation((address) => ({
                address,
                status: {
                    json: 'Clean',
                    wml: 'Clean'
                },
                get fileNameBase() {
                    if (address.zone === 'Personal') {
                        return 'Personal/alice/test-asset'
                    } else if (address.zone === 'Archive') {
                        return 'Archive/BACKUP#123/test-asset'
                    } else {
                        return `${address.zone}/test-asset`
                    }
                },
                loadJSON: jest.fn(),
                authStatus: {
                    json: 'Clean',
                    wml: 'Clean'
                },
                _isGlobal: false,
                filePath: '',
                fileName: 'test-asset',
                normal: {},
                namespaceIdToDB: [],
                rootNodes: [],
                forceDefault: jest.fn(),
                presignedURL: jest.fn(),
                setWorkspaceLookup: jest.fn(),
                loadAuthorizationJSON: jest.fn()
            }))
            
            const request: MoveAssetRequest = {
                assetId: 'ASSET#test-asset',
                fromZone: 'Personal',
                toZone: 'Library',
                player: 'alice'
            }
            
            const result = await moveAsset(request)
            
            expect(result.success).toBe(true)
            expect(result.newLocation).toBe('Library/test-asset')
        })
    })
})
