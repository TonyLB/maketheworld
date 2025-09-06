import { S3Client, GetObjectCommand, GetObjectTaggingCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns'
import type { Readable } from 'stream'
import jimp from 'jimp'
import { enforceTypedKey, SessionKey } from '@tonylb/mtw-utilities/ts/types'
import { eventBridgeClient } from '@tonylb/mtw-utilities/ts/eventBridge'
import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'

// Initialize S3 client
const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' })
const snsClient = new SNSClient({ region: process.env.AWS_REGION || 'us-east-1' })

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
    
    // Suppress Jimp DEP0005 warning
    const origWarning = process.emitWarning
    process.emitWarning = function(...args) {
        if (args[2] !== 'DEP0005') {
            return origWarning.apply(process, args as any)
        }
        // Do nothing, eat the DEP0005 warning
    }
    
    try {
        // Transform image using Jimp
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

export const sendSuccessNotification = async ({ requestId, sessionId, processedKey, originalKey, componentUUID }: {
    requestId: string
    sessionId: string
    processedKey: string
    originalKey: string
    componentUUID: ComponentUUID
}): Promise<void> => {
    if (!process.env.FEEDBACK_TOPIC) {
        console.warn('FEEDBACK_TOPIC not configured, skipping success notification')
        return
    }

    try {
        await snsClient.send(new PublishCommand({
            TopicArn: process.env.FEEDBACK_TOPIC,
            Message: JSON.stringify({
                messageType: 'ImageProcessing',
                processedKey,
                originalKey,
                componentUUID,
                status: 'Success'
            }),
            MessageAttributes: {
                RequestId: { DataType: 'String', StringValue: requestId },
                Targets: { DataType: 'String.Array', StringValue: JSON.stringify([SessionKey(sessionId)]) },
                Type: { DataType: 'String', StringValue: 'Success' }
            }
        }))
        console.log(`Sent success notification for request ${requestId} to session ${sessionId}`)
    } catch (error) {
        console.error('Failed to send success notification:', error)
        // Don't throw - notification failure shouldn't break the main flow
    }
}

export const sendErrorNotification = async ({ requestId, sessionId, originalKey, error }: {
    requestId: string
    sessionId: string
    originalKey: string
    error: Error
}): Promise<void> => {
    if (!process.env.FEEDBACK_TOPIC) {
        console.warn('FEEDBACK_TOPIC not configured, skipping error notification')
        return
    }

    try {
        await snsClient.send(new PublishCommand({
            TopicArn: process.env.FEEDBACK_TOPIC,
            Message: '{}',
            MessageAttributes: {
                RequestId: { DataType: 'String', StringValue: requestId },
                Targets: { DataType: 'String.Array', StringValue: JSON.stringify([SessionKey(sessionId)]) },
                Type: { DataType: 'String', StringValue: 'Error' },
                Error: { DataType: 'String', StringValue: `Image processing failed: ${error.message}` }
            }
        }))
        console.log(`Sent error notification for request ${requestId} to session ${sessionId}`)
    } catch (notificationError) {
        console.error('Failed to send error notification:', notificationError)
        // Don't throw - notification failure shouldn't break the main flow
    }
}

export const processImageUpload = async (record: S3Event['Records'][0]) => {
    const bucketName = record.s3.bucket.name
    const objectKey = record.s3.object.key
    const fileSize = record.s3.object.size

    console.log(`Processing image upload: ${objectKey} (${fileSize} bytes) from bucket: ${bucketName}`)

    try {
        // Parallel calls: get image data and object tags
        const [imageData, objectTags] = await Promise.all([
            // Get the image data from S3
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
        const componentUUID = enforceTypedKey('IMAGE')((processedKey.endsWith('.png') ? processedKey.slice(0, -4) : processedKey).replace(/^IMAGE-/, 'IMAGE#'))
        await storeProcessedImage(processedKey, processedImage)
        
        console.log(`Successfully processed and stored image: ${processedKey}`)

        // Publish EventBridge event for the added image
        try {
            await eventBridgeClient.send([{
                DetailType: 'Image Added',
                Detail: {
                    ComponentUUID: componentUUID,
                    imageType: objectTags.imageType
                }
            }])
            console.log(`Published EventBridge event: Image Added for ${processedKey}`)
        } catch (eventError) {
            console.error('Failed to publish EventBridge event:', eventError)
            // Don't throw - event publishing failure shouldn't break the main flow
        }

        // Send success notification
        await sendSuccessNotification({
            requestId: objectTags.requestId,
            sessionId: objectTags.sessionId,
            componentUUID,
            processedKey,
            originalKey: objectKey
        })

    } catch (error) {
        console.error(`Error processing image ${objectKey}:`, error)
        
        // Try to get object tags for error notification (if we have them)
        try {
            const objectTags = await getObjectTags(bucketName, objectKey)
            await sendErrorNotification({
                requestId: objectTags.requestId,
                sessionId: objectTags.sessionId,
                originalKey: objectKey,
                error: error as Error
            })
        } catch (tagError) {
            console.warn(`Could not send error notification for ${objectKey}:`, tagError)
        }
        
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
                        
                        // Try to send error notification for this record
                        try {
                            const objectTags = await getObjectTags(record.s3.bucket.name, record.s3.object.key)
                            await sendErrorNotification({
                                requestId: objectTags.requestId,
                                sessionId: objectTags.sessionId,
                                originalKey: record.s3.object.key,
                                error: error as Error
                            })
                        } catch (tagError) {
                            console.warn(`Could not send error notification for ${record.s3.object.key}:`, tagError)
                        }
                        
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
