// Import required AWS SDK clients and commands for Node.js
import { S3Client, ListObjectsCommand, DeleteObjectsCommand, PutObjectCommand } from "@aws-sdk/client-s3"
import { EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge"
import { readdir, stat, readFile } from 'node:fs/promises'
import { v4 as uuidv4 } from 'uuid'
import { DiagnosticsEventSerializer, DiagnosticsEventUpdate } from '@tonylb/mtw-interfaces/ts/eventBridge/diagnostics'
import { createNodeDataSourceEnvironment } from '@tonylb/mtw-lambda-patterns/ts/dataSource/nodeEnvironment'
import { publishStreamEvent, StreamEventPublisherSerializer } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
// Note: primitivesData import removed - WML lambda now handles primitives content

const params = { region: process.env.AWS_REGION }
const s3Client = new S3Client(params)
const eventBridgeClient = new EventBridgeClient(params)

const contentTypeMapping = {
    ico: 'image/vnd.microsoft.icon',
    json: 'application/json',
    html: 'text/html',
    txt: 'text/plain',
    png: 'image/png',
    svg: 'image/svg+xml',
    js: 'text/javascript',
    css: 'text/css',
    map: 'plain/text'
}

const clearClientBucket = async (): Promise<void> => {
    const objectList = await s3Client.send(new ListObjectsCommand({
        Bucket: process.env.CLIENT_BUCKET
    }))
    if (objectList.Contents) {
        await s3Client.send(new DeleteObjectsCommand({
            Bucket: process.env.CLIENT_BUCKET,
            Delete: {
                Objects: objectList.Contents.map(({ Key }) => ({ Key }))
            }
        }))
    }
}

const initializeClientData = async (subDir: string = ''): Promise<void> => {
    const baseDir = `/opt${subDir}`
    const dirContents = await readdir(baseDir)
    await Promise.all(
        dirContents.map(async (item) => {
            if ((await stat(`${baseDir}/${item}`)).isDirectory()) {
                await initializeClientData(`${subDir}/${item}`)
            }
            else {
                if (subDir || !(item === 'config.json')) {
                    const fileExtension = item.split('.').slice(-1)[0]
                    const contentType = contentTypeMapping[fileExtension]
                    const data = await readFile(`${baseDir}/${item}`)
                    await s3Client.send(new PutObjectCommand({
                        Bucket: process.env.CLIENT_BUCKET,
                        Key: subDir ? `${subDir.slice(1)}/${item}` : item,
                        Body: data,
                        ContentType: contentType || 'application/octet-stream'
                    }))
                }
            }
        })
    )
}

const initializePrimitivesData = async (): Promise<void> => {
    // Emit S3 Structure Finding event for primitives.wml
    // The WML lambda will respond by checking and initializing if needed
    const diagnosticRunId = uuidv4()
    const now = Date.now()
    const nowISO = new Date(now).toISOString()
    
    // Create internal event format
    const internalEvent: DiagnosticsEventUpdate = {
        type: 'S3 Structure Finding',
        source: 'primitives.wml',
        status: 'missing',
        diagnosticRunId,
        timestamp: nowISO
    }
    
    const serializer = new DiagnosticsEventSerializer(createNodeDataSourceEnvironment())
    const header = {
        dataSourceKey: 'mtw.diagnostics',
        streamKey: 'global',
        timestamp: now,
        type: internalEvent.type
    }
    const { eventBridgeEvent } = publishStreamEvent({
        header,
        content: internalEvent,
        serializer: serializer as StreamEventPublisherSerializer<typeof header>
    })

    // Send to EventBridge (PutEventsCommand expects capitalized Source/DetailType)
    await eventBridgeClient.send(new PutEventsCommand({
        Entries: [{
            Source: eventBridgeEvent.Source,
            DetailType: eventBridgeEvent.DetailType,
            EventBusName: process.env.EVENT_BUS_NAME,
            Detail: JSON.stringify(eventBridgeEvent.Detail)
        }]
    }))
    
    console.log(`Initialize: Emitted S3 Structure Finding event for primitives.wml (runId: ${diagnosticRunId})`)
}

export const handler = async (event, context) => {

    // Handle EventBridge messages
    if (event?.source === 'mtw.diagnostics') {
        if (event["detail-type"] === 'Initialize') {
            await clearClientBucket()
            await Promise.all([
                initializeClientData(),
                initializePrimitivesData(),
                s3Client.send(new PutObjectCommand({
                    Bucket: process.env.CLIENT_BUCKET,
                    Key: 'config.json',
                    Body: JSON.stringify(Object.entries({
                        UserPoolClient: process.env.USER_POOL_CLIENT,
                        UserPoolId: process.env.USER_POOL_ID,
                        WebSocketURI: process.env.WEB_SOCKET_URI,
                        AnonymousApiURI: process.env.ANONYMOUS_API_URI
                    }).map(([key, value]) => ({
                        OutputKey: key,
                        OutputValue: value
                    })), null, 4),
                    ContentType: 'application/json'
                }))
            ])
            return JSON.stringify(`Success`)
        }
    }

}
