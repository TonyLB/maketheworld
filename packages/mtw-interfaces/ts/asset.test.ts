import { isAssetClientMessage } from './asset'

describe('AssetClientMessage typeguard', () => {

    it('should reject non-object entry', () => {
        expect(isAssetClientMessage([{
            messageType: 'Player',
            PlayerName: 'TestPlayer',
            CodeOfConductConsent: true,
            Assets: [],
            Characters: [],
            Settings: { onboardCompleteTags: [] },
            SessionId: 'session123'
        }])).toBe(false)
    })

    it('should reject object without messageType field', () => {
        expect(isAssetClientMessage({
            massageType: 'Player',
            PlayerName: 'TestPlayer',
            CodeOfConductConsent: true,
            Assets: [],
            Characters: [],
            Settings: { onboardCompleteTags: [] },
            SessionId: 'session123'
        })).toBe(false)
    })

    describe('Player', () => {

        it('should reject when no PlayerName', () => {
            expect(isAssetClientMessage({
                messageType: 'Player',
                CodeOfConductConsent: true,
                Assets: [],
                Characters: [],
                Settings: { onboardCompleteTags: [] },
                SessionId: 'session123'
            })).toBe(false)
        })

        it('should reject when wrong type PlayerName', () => {
            expect(isAssetClientMessage({
                messageType: 'Player',
                PlayerName: 1234,
                CodeOfConductConsent: true,
                Assets: [],
                Characters: [],
                Settings: { onboardCompleteTags: [] },
                SessionId: 'session123'
            })).toBe(false)
        })

        it('should accept correct entry', () => {
            expect(isAssetClientMessage({
                messageType: 'Player',
                PlayerName: 'TestPlayer',
                CodeOfConductConsent: true,
                Assets: [],
                Characters: [],
                Settings: { onboardCompleteTags: [] },
                SessionId: 'session123'
            })).toBe(true)
        })

    })

    describe('Library', () => {

        it('should reject when no Assets field', () => {
            expect(isAssetClientMessage({
                messageType: 'Library',
                Characters: []
            })).toBe(false)
        })

        it('should reject when wrong type Assets field', () => {
            expect(isAssetClientMessage({
                messageType: 'Library',
                Assets: 'not an array',
                Characters: []
            })).toBe(false)
        })

        it('should accept correct entry', () => {
            expect(isAssetClientMessage({
                messageType: 'Library',
                Assets: [],
                Characters: []
            })).toBe(true)
        })

    })

    describe('MetaData', () => {

        it('should reject when no AssetId', () => {
            expect(isAssetClientMessage({
                messageType: 'MetaData',
                zone: 'Canon'
            })).toBe(false)
        })

        it('should reject when wrong type AssetId', () => {
            expect(isAssetClientMessage({
                messageType: 'MetaData',
                AssetId: 1234,
                zone: 'Canon'
            })).toBe(false)
        })

        it('should accept correct entry', () => {
            expect(isAssetClientMessage({
                messageType: 'MetaData',
                AssetId: 'ASSET#TestABC',
                zone: 'Canon'
            })).toBe(true)
        })

    })

    describe('FetchURL', () => {

        it('should reject when no url', () => {
            expect(isAssetClientMessage({
                messageType: 'FetchURL',
                properties: {}
            })).toBe(false)
        })

        it('should reject when wrong type url', () => {
            expect(isAssetClientMessage({
                messageType: 'FetchURL',
                url: 1234,
                properties: {}
            })).toBe(false)
        })

        it('should accept correct entry', () => {
            expect(isAssetClientMessage({
                messageType: 'FetchURL',
                url: 'http://example.com',
                properties: {}
            })).toBe(true)
        })

    })

    describe('UploadURL', () => {

        it('should reject when no url', () => {
            expect(isAssetClientMessage({
                messageType: 'UploadURL',
                s3Object: 's3://example'
            })).toBe(false)
        })

        it('should reject when wrong type url', () => {
            expect(isAssetClientMessage({
                messageType: 'UploadURL',
                url: 1234,
                s3Object: 's3://example'
            })).toBe(false)
        })

        it('should accept correct entry', () => {
            expect(isAssetClientMessage({
                messageType: 'UploadURL',
                url: 'http://example.com',
                s3Object: 's3://example'
            })).toBe(true)
        })

    })

    describe('FetchImports', () => {

        it('should reject when no importsByAsset', () => {
            expect(isAssetClientMessage({
                messageType: 'FetchImports'
            })).toBe(false)
        })

        it('should reject when wrong type importsByAsset', () => {
            expect(isAssetClientMessage({
                messageType: 'FetchImports',
                importsByAsset: 'not an array'
            })).toBe(false)
        })

        it('should accept correct entry', () => {
            expect(isAssetClientMessage({
                messageType: 'FetchImports',
                importsByAsset: []
            })).toBe(true)
        })

    })

    describe('ParseWML', () => {

        it('should reject when no images', () => {
            expect(isAssetClientMessage({
                messageType: 'ParseWML'
            })).toBe(false)
        })

        it('should reject when wrong type images', () => {
            expect(isAssetClientMessage({
                messageType: 'ParseWML',
                images: 'not an array'
            })).toBe(false)
        })

        it('should accept correct entry', () => {
            expect(isAssetClientMessage({
                messageType: 'ParseWML',
                images: []
            })).toBe(true)
        })

    })

    describe('LLMGenerate', () => {

        it('should reject when no description', () => {
            expect(isAssetClientMessage({
                messageType: 'LLMGenerate',
                summary: 'Test summary'
            })).toBe(false)
        })

        it('should reject when wrong type description', () => {
            expect(isAssetClientMessage({
                messageType: 'LLMGenerate',
                description: 1234,
                summary: 'Test summary'
            })).toBe(false)
        })

        it('should accept correct entry', () => {
            expect(isAssetClientMessage({
                messageType: 'LLMGenerate',
                description: 'Test description',
                summary: 'Test summary'
            })).toBe(true)
        })

    })

})