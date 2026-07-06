import {
    SemanticEmbedding,
    SEMANTIC_EMBEDDING_V1_DIMENSIONS,
    SEMANTIC_EMBEDDING_V1_ENCODING,
    SEMANTIC_EMBEDDING_V1_SCALE,
    dequantizeInt8BytesToFloat32,
    quantizeFloat32ToInt8Bytes
} from './index'

const TEST_MODEL_ID = 'amazon.titan-embed-text-v2:0'

const makeMetadata = (overrides: Partial<Parameters<typeof SemanticEmbedding.fromFloat32>[1]> = {}) => ({
    modelId: TEST_MODEL_ID,
    ...overrides
})

const zeroVector = (): number[] => Array.from({ length: SEMANTIC_EMBEDDING_V1_DIMENSIONS }, () => 0)

const unitVectorAlongAxis = (axis: number, sign: 1 | -1 = 1): number[] => {
    const values = zeroVector()
    values[axis] = sign
    return values
}

describe('quantizeFloat32ToInt8Bytes', () => {
    it('quantizes edge values -1, 0, and 1', () => {
        const bytes = quantizeFloat32ToInt8Bytes([-1, 0, 1], 3)
        const int8 = new Int8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)
        expect(int8[0]).toBe(-127)
        expect(int8[1]).toBe(0)
        expect(int8[2]).toBe(127)
    })

    it('rejects wrong-length vectors', () => {
        expect(() => quantizeFloat32ToInt8Bytes([0, 1], 3)).toThrow(/length mismatch/)
    })

    it('rejects non-finite values', () => {
        expect(() => quantizeFloat32ToInt8Bytes([Number.NaN], 1)).toThrow(/non-finite/)
    })
})

describe('SemanticEmbedding', () => {
    describe('fromFloat32', () => {
        it('stores only quantized int8 bytes after construction', () => {
            const values = unitVectorAlongAxis(0)
            const embedding = SemanticEmbedding.fromFloat32(values, makeMetadata())
            const bytes = embedding.toBinary()
            const int8 = new Int8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)
            expect(int8[0]).toBe(127)
            expect(bytes.length).toBe(SEMANTIC_EMBEDDING_V1_DIMENSIONS)
            expect((embedding as { _float32?: unknown })._float32).toBeUndefined()
        })

        it('rejects wrong-length float vectors', () => {
            expect(() => SemanticEmbedding.fromFloat32([0, 1], makeMetadata())).toThrow(/length mismatch/)
        })

        it('rejects unsupported dimensions in metadata', () => {
            expect(() =>
                SemanticEmbedding.fromFloat32(zeroVector(), makeMetadata({ dimensions: 128 }))
            ).toThrow(/Unsupported semantic embedding dimensions/)
        })
    })

    describe('binary and Dynamo serde', () => {
        it('round-trips fromFloat32 through toBinary and fromBinary', () => {
            const values = unitVectorAlongAxis(3, -1)
            const original = SemanticEmbedding.fromFloat32(values, makeMetadata())
            const rehydrated = SemanticEmbedding.fromBinary(original.toBinary(), makeMetadata())
            expect(rehydrated.equals(original)).toBe(true)
        })

        it('round-trips through toDynamoRecord and fromDynamoRecord', () => {
            const values = unitVectorAlongAxis(7)
            const original = SemanticEmbedding.fromFloat32(values, makeMetadata())
            const record = original.toDynamoRecord()
            expect(record).toMatchObject({
                modelId: TEST_MODEL_ID,
                dimensions: SEMANTIC_EMBEDDING_V1_DIMENSIONS,
                encoding: SEMANTIC_EMBEDDING_V1_ENCODING
            })
            expect(record.vector).toBeInstanceOf(Uint8Array)
            const rehydrated = SemanticEmbedding.fromDynamoRecord(record)
            expect(rehydrated.equals(original)).toBe(true)
        })

        it('rejects binary vectors with wrong length', () => {
            expect(() =>
                SemanticEmbedding.fromBinary(new Uint8Array(10), makeMetadata())
            ).toThrow(/byte vector length mismatch/)
        })

        it('returns defensive copies from toBinary', () => {
            const embedding = SemanticEmbedding.fromFloat32(zeroVector(), makeMetadata())
            const exported = embedding.toBinary()
            exported[0] = 99
            expect(embedding.toBinary()[0]).toBe(0)
        })
    })

    describe('equals', () => {
        it('compares metadata and bytes', () => {
            const left = SemanticEmbedding.fromFloat32(unitVectorAlongAxis(1), makeMetadata())
            const same = SemanticEmbedding.fromFloat32(unitVectorAlongAxis(1), makeMetadata())
            const differentAxis = SemanticEmbedding.fromFloat32(unitVectorAlongAxis(2), makeMetadata())
            const differentModel = SemanticEmbedding.fromFloat32(
                unitVectorAlongAxis(1),
                makeMetadata({ modelId: 'other-model' })
            )

            expect(left.equals(same)).toBe(true)
            expect(left.equals(differentAxis)).toBe(false)
            expect(left.equals(differentModel)).toBe(false)
        })
    })

    describe('cosineSimilarity', () => {
        it('returns ~1 for identical embeddings', () => {
            const values = unitVectorAlongAxis(4)
            const left = SemanticEmbedding.fromFloat32(values, makeMetadata())
            const right = SemanticEmbedding.fromFloat32([...values], makeMetadata())
            expect(left.cosineSimilarity(right)).toBeCloseTo(1, 5)
        })

        it('returns ~0 for orthogonal unit vectors', () => {
            const left = SemanticEmbedding.fromFloat32(unitVectorAlongAxis(0), makeMetadata())
            const right = SemanticEmbedding.fromFloat32(unitVectorAlongAxis(1), makeMetadata())
            expect(left.cosineSimilarity(right)).toBeCloseTo(0, 5)
        })

        it('matches dequantized float comparison within tolerance after round-trip', () => {
            const values = zeroVector()
            values[0] = 0.6
            values[1] = 0.8
            const left = SemanticEmbedding.fromFloat32(values, makeMetadata())
            const right = SemanticEmbedding.fromFloat32([...values], makeMetadata())

            const leftFloats = dequantizeInt8BytesToFloat32(left.toBinary())
            const rightFloats = dequantizeInt8BytesToFloat32(right.toBinary())
            let dot = 0
            let normLeft = 0
            let normRight = 0
            for (let i = 0; i < leftFloats.length; i++) {
                dot += leftFloats[i] * rightFloats[i]
                normLeft += leftFloats[i] * leftFloats[i]
                normRight += rightFloats[i] * rightFloats[i]
            }
            const expected = dot / (Math.sqrt(normLeft) * Math.sqrt(normRight))

            expect(left.cosineSimilarity(right)).toBeCloseTo(expected, 5)
            expect(leftFloats[0]).toBeCloseTo(values[0], 1 / SEMANTIC_EMBEDDING_V1_SCALE)
        })
    })
})
