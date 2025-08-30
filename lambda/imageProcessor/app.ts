import { S3Client, GetObjectCommand, GetObjectTaggingCommand } from '@aws-sdk/client-s3'
import type { Readable } from 'stream'

// Initialize S3 client
const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' })

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
    
    // For now, just return the contents as-is for testing
    // Later we'll process this with Jimp following the existing pattern
    return contents
}

export const getObjectTags = async (bucketName: string, objectKey: string): Promise<Record<string, string>> => {
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
        
        return tags
    } catch (error) {
        console.warn(`Could not retrieve object tags for ${objectKey}:`, error)
        return {} // Return empty object if no tags or error
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
            // Get the image data from S3 (following formatImage pattern)
            getImageFromS3(bucketName, objectKey),
            // Get the S3 object tags for processing parameters
            getObjectTags(bucketName, objectKey)
        ])

        // Log results for testing
        console.log(`Successfully loaded image data: ${imageData.length} bytes`)
        console.log(`Object tags received:`, objectTags)

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
  
  