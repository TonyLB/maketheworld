/**
 * Semantic embedding value type: canonical int8-quantized storage with explicit serde boundaries.
 *
 * Deep import: @tonylb/mtw-lambda-patterns/ts/semanticEmbedding
 */

export const SEMANTIC_EMBEDDING_V1_DIMENSIONS = 256
export const SEMANTIC_EMBEDDING_V1_ENCODING = 'int8-v1' as const
export const SEMANTIC_EMBEDDING_V1_SCALE = 127

export type SemanticEmbeddingEncoding = typeof SEMANTIC_EMBEDDING_V1_ENCODING

export type SemanticEmbeddingDynamoRecord = {
    modelId: string
    dimensions: number
    encoding: SemanticEmbeddingEncoding
    vector: Uint8Array
    sourceTextHash?: string
}

export type SemanticEmbeddingMetadata = {
    modelId: string
    dimensions?: number
    encoding?: SemanticEmbeddingEncoding
    sourceTextHash?: string
}

type ResolvedMetadata = {
    modelId: string
    dimensions: number
    encoding: SemanticEmbeddingEncoding
    sourceTextHash?: string
}

const copyBytes = (bytes: Uint8Array): Uint8Array => new Uint8Array(bytes)

const resolveMetadata = (metadata: SemanticEmbeddingMetadata): ResolvedMetadata => {
    const dimensions = metadata.dimensions ?? SEMANTIC_EMBEDDING_V1_DIMENSIONS
    const encoding = metadata.encoding ?? SEMANTIC_EMBEDDING_V1_ENCODING
    if (encoding !== SEMANTIC_EMBEDDING_V1_ENCODING) {
        throw new Error(`Unsupported semantic embedding encoding: ${encoding}`)
    }
    if (dimensions !== SEMANTIC_EMBEDDING_V1_DIMENSIONS) {
        throw new Error(
            `Unsupported semantic embedding dimensions: expected ${SEMANTIC_EMBEDDING_V1_DIMENSIONS}, got ${dimensions}`
        )
    }
    return {
        modelId: metadata.modelId,
        dimensions,
        encoding,
        ...(metadata.sourceTextHash !== undefined ? { sourceTextHash: metadata.sourceTextHash } : {})
    }
}

export const quantizeFloat32ToInt8Bytes = (
    values: Float32Array | readonly number[],
    dimensions: number = SEMANTIC_EMBEDDING_V1_DIMENSIONS
): Uint8Array => {
    if (values.length !== dimensions) {
        throw new Error(
            `Semantic embedding float vector length mismatch: expected ${dimensions}, got ${values.length}`
        )
    }
    const int8 = Int8Array.from(
        Array.from(values).map((value, i) => {
            if (!Number.isFinite(value)) {
                throw new Error(`Semantic embedding float vector contains non-finite value at index ${i}`)
            }
            return Math.round(Math.max(-128, Math.min(127, value * SEMANTIC_EMBEDDING_V1_SCALE)))
        })
    )
    return new Uint8Array(int8.buffer, int8.byteOffset, int8.byteLength)
}

export const dequantizeInt8BytesToFloat32 = (bytes: Uint8Array): Float32Array => {
    const int8 = new Int8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    const floats = new Float32Array(bytes.length)
    for (let i = 0; i < bytes.length; i++) {
        floats[i] = int8[i] / SEMANTIC_EMBEDDING_V1_SCALE
    }
    return floats
}

export class SemanticEmbedding {
    private readonly _vector: Uint8Array
    private readonly _modelId: string
    private readonly _dimensions: number
    private readonly _encoding: SemanticEmbeddingEncoding
    private readonly _sourceTextHash?: string

    private constructor(vector: Uint8Array, metadata: ResolvedMetadata) {
        if (vector.length !== metadata.dimensions) {
            throw new Error(
                `Semantic embedding byte vector length mismatch: expected ${metadata.dimensions}, got ${vector.length}`
            )
        }
        this._vector = copyBytes(vector)
        this._modelId = metadata.modelId
        this._dimensions = metadata.dimensions
        this._encoding = metadata.encoding
        this._sourceTextHash = metadata.sourceTextHash
    }

    get modelId(): string {
        return this._modelId
    }

    get dimensions(): number {
        return this._dimensions
    }

    get encoding(): SemanticEmbeddingEncoding {
        return this._encoding
    }

    get sourceTextHash(): string | undefined {
        return this._sourceTextHash
    }

    static fromFloat32(
        values: Float32Array | readonly number[],
        metadata: SemanticEmbeddingMetadata
    ): SemanticEmbedding {
        const resolved = resolveMetadata(metadata)
        const vector = quantizeFloat32ToInt8Bytes(values, resolved.dimensions)
        return new SemanticEmbedding(vector, resolved)
    }

    static fromBinary(bytes: Uint8Array, metadata: SemanticEmbeddingMetadata): SemanticEmbedding {
        const resolved = resolveMetadata(metadata)
        return new SemanticEmbedding(bytes, resolved)
    }

    static fromDynamoRecord(record: SemanticEmbeddingDynamoRecord): SemanticEmbedding {
        const resolved = resolveMetadata({
            modelId: record.modelId,
            dimensions: record.dimensions,
            encoding: record.encoding,
            ...(record.sourceTextHash !== undefined ? { sourceTextHash: record.sourceTextHash } : {})
        })
        return new SemanticEmbedding(record.vector, resolved)
    }

    toBinary(): Uint8Array {
        return copyBytes(this._vector)
    }

    toDynamoRecord(): SemanticEmbeddingDynamoRecord {
        return {
            modelId: this._modelId,
            dimensions: this._dimensions,
            encoding: this._encoding,
            vector: this.toBinary(),
            ...(this._sourceTextHash !== undefined ? { sourceTextHash: this._sourceTextHash } : {})
        }
    }

    cosineSimilarity(other: SemanticEmbedding): number {
        if (
            this._dimensions !== other._dimensions ||
            this._encoding !== other._encoding
        ) {
            throw new Error('Semantic embeddings are not comparable: dimensions or encoding mismatch')
        }
        const left = dequantizeInt8BytesToFloat32(this._vector)
        const right = dequantizeInt8BytesToFloat32(other._vector)
        const { dot, normLeft, normRight } = left.reduce(
            (acc, leftValue, i) => ({
                dot: acc.dot + leftValue * right[i],
                normLeft: acc.normLeft + leftValue * leftValue,
                normRight: acc.normRight + right[i] * right[i]
            }),
            { dot: 0, normLeft: 0, normRight: 0 }
        )
        if (normLeft === 0 || normRight === 0) {
            return 0
        }
        return dot / (Math.sqrt(normLeft) * Math.sqrt(normRight))
    }

    equals(other: SemanticEmbedding): boolean {
        if (
            this._modelId !== other._modelId ||
            this._dimensions !== other._dimensions ||
            this._encoding !== other._encoding ||
            this._sourceTextHash !== other._sourceTextHash
        ) {
            return false
        }
        if (this._vector.length !== other._vector.length) {
            return false
        }
        return !this._vector.some((byte, i) => byte !== other._vector[i])
    }
}
