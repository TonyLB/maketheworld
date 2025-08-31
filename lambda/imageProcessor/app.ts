import { S3Client, GetObjectCommand, GetObjectTaggingCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import type { Readable } from 'stream'
import jimp from 'jimp'

// Initialize S3 client
const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' })

// Image processing settings based on type
const processingSettings = {
    Map: { width: 1200, height: 800 },
    Character: { width: 300, height: 300 }
}

// Strong typing for S3 object tags
interface ImageProcessingTags {
    imageType: 'Map' | 'Character'
    requestId: string
    sessionId: string
}

// S3 event interface based on the actual event structure
interface S3Event {
    Records: Array<{
        eventName: string;
        s3: {
            bucket: { name: string };
            object: { key: string; size: number; eTag: string };
        };
    }>;
}

// Replicate the existing formatImage pattern for stream handling
const streamToBuffer = async (stream: Readable): Promise<Buffer> => {
    const chunks: Buffer[] = []
    for await (let chunk of stream) {
        chunks.push(chunk)
    }
    return Buffer.concat(chunks)
}

export const getImageFromS3 = async (bucketName: string, objectKey: string): Promise<Buffer> => {
    console.log(`Retrieving image from S3: ${bucketName}/${objectKey}`)
    
    const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: objectKey
    })

    const response = await s3Client.send(command)
    
    if (!response.Body) {
        throw new Error('No response body from S3')
    }

    // Use the existing formatImage pattern: streamToBuffer function
    const contents = await streamToBuffer(response.Body as Readable)
    
    return contents
}

export const getObjectTags = async (bucketName: string, objectKey: string): Promise<ImageProcessingTags> => {
    console.log(`Retrieving object tags from S3: ${bucketName}/${objectKey}`)
    
    try {
        const command = new GetObjectTaggingCommand({
            Bucket: bucketName,
            Key: objectKey
        })

        const response = await s3Client.send(command)
        
        // Convert tag array to key-value object
        const tags: Record<string, string> = response.TagSet
            ? response.TagSet.reduce<Record<string, string>>((acc, tag) => {
                    if (tag.Key && tag.Value) {
                        return { ...acc, [tag.Key]: tag.Value }
                    }
                    return acc
                }, {})
            : {}
        
        // Validate required tags
        if (!tags.imageType || !tags.requestId || !tags.sessionId) {
            throw new Error(`Missing required tags. Found: ${Object.keys(tags).join(', ')}. Required: imageType, requestId, sessionId`)
        }
        
        if (tags.imageType !== 'Map' && tags.imageType !== 'Character') {
            throw new Error(`Invalid imageType: ${tags.imageType}. Must be 'Map' or 'Character'`)
        }
        
        // Return strongly typed tags
        return {
            imageType: tags.imageType as 'Map' | 'Character',
            requestId: tags.requestId,
            sessionId: tags.sessionId
        }
    } catch (error) {
        console.warn(`Could not retrieve object tags for ${objectKey}:`, error)
        throw error // Re-throw validation errors
    }
}

async function processImage(image: any, tags: ImageProcessingTags): Promise<Buffer> {
    const imageType = tags.imageType
    
    if (!imageType || !processingSettings[imageType as keyof typeof processingSettings]) {
        throw new Error(`Invalid or missing imageType: ${imageType}`)
    }
    
    const settings = processingSettings[imageType as keyof typeof processingSettings]
    console.log(`Processing image as ${imageType} with dimensions: ${settings.width}x${settings.height}`)
    
    // Suppress Jimp DEP0005 warning (following formatImage pattern)
    const origWarning = process.emitWarning
    process.emitWarning = function(...args) {
        if (args[2] !== 'DEP0005') {
            return origWarning.apply(process, args as any)
        }
        // Do nothing, eat the DEP0005 warning
    }
    
    try {
        // Transform image using formatImage pattern
        const processedBuffer = await image
            .resize(settings.width, settings.height, jimp.RESIZE_BEZIER)
            .deflateLevel(5)
            .getBufferAsync(jimp.MIME_PNG)
        
        return processedBuffer
    } finally {
        // Restore original warning handler
        process.emitWarning = origWarning
    }
}

export const storeProcessedImage = async (key: string, imageBuffer: Buffer): Promise<void> => {
    const command = new PutObjectCommand({
        Bucket: process.env.IMAGES_BUCKET!,
        Key: key,
        Body: imageBuffer,
        ContentType: 'image/png'
    })
    
    await s3Client.send(command)
    console.log(`Stored processed image: ${key}`)
}

export const processImageUpload = async (record: S3Event['Records'][0]) => {
    const bucketName = record.s3.bucket.name
    const objectKey = record.s3.object.key
    const fileSize = record.s3.object.size

    console.log(`Processing image upload: ${objectKey} (${fileSize} bytes) from bucket: ${bucketName}`)

    try {
        // Parallel calls: get image data and object tags
        const [imageData, objectTags] = await Promise.all([
            // Get the image data from S3 (following formatImage pattern)
            getImageFromS3(bucketName, objectKey),
            // Get the S3 object tags for processing parameters
            getObjectTags(bucketName, objectKey)
        ])

        // Log results for testing
        console.log(`Successfully loaded image data: ${imageData.length} bytes`)
        console.log(`Object tags received:`, objectTags)

        // Read image with Jimp to get resolution
        const image = await jimp.read(imageData)
        console.log(`Image resolution: ${image.getWidth()}x${image.getHeight()}`)

        // Process image based on type from tags
        const processedImage = await processImage(image, objectTags)
        
        // Store processed image to images bucket
        const processedKey = objectKey.replace(/\.[^/.]+$/, '.png') // Replace extension with .png
        await storeProcessedImage(processedKey, processedImage)
        
        console.log(`Successfully processed and stored image: ${processedKey}`)

    } catch (error) {
        console.error(`Error processing image ${objectKey}:`, error)
        throw error
    }
}

export const handler = async (event: S3Event) => {
    console.log(`Image processor called with event: ${JSON.stringify(event)}`)

    try {
        // Process all S3 event records in parallel
        await Promise.all(
            event.Records.map(async (record) => {
                if (record.eventName.startsWith('ObjectCreated:')) {
                    try {
                        await processImageUpload(record)
                    } catch (error) {
                        console.error(`Error processing record ${record.s3.object.key}:`, error)
                        // Don't re-throw - other records process independently
                    }
                }
            })
        )
    } catch (error) {
        console.error('Error in handler:', error)
        throw error
    }
}
