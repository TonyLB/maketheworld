# Image Format Processing

## Overview

The Image Format Processing function handles the transformation of uploaded images into standardized formats for Make The World assets. This system has been completely redesigned to use universalKey-based storage with S3 event-driven processing for improved reliability and separation of concerns.

## Current Implementation Details

### Available Code and Libraries

The current system has several useful components that we can leverage for the new architecture:

#### Image Processing Core
```typescript
// Current image processing implementation using Jimp
const beforeBuffer = await jimp.read(contents)
const afterBuffer = await beforeBuffer
    .resize(width, height, jimp.RESIZE_BEZIER)
    .deflateLevel(5)
    .getBufferAsync(jimp.MIME_PNG)
```

**Available Processing Capabilities:**
- **Input Formats**: JPEG, PNG, GIF, BMP, TIFF
- **Output Format**: PNG with deflate compression
- **Quality**: Level 5 deflate compression
- **Resize Algorithm**: Bezier interpolation
- **Dimensions**: Configurable width/height parameters

#### S3 Integration
```typescript
// Current S3 operations
const { Body: contentStream } = await s3Client.send(new GetObjectCommand({
    Bucket: process.env.UPLOAD_BUCKET,
    Key: fromFileName
}))

await s3Client.send(new PutObjectCommand({
    Bucket: process.env.IMAGES_BUCKET,
    Key: `${toFileName}.png`,
    Body: afterBuffer,
    ContentType: 'image/png'
}))
```

**Available Infrastructure:**
- S3 client setup and configuration
- Environment variable configuration for buckets
- Stream-to-buffer conversion utilities
- Error handling patterns

#### WML Integration
```typescript
// Current WML parse integration (to be replaced)
const imageFiles = await Promise.all([
    ...(images.map(async ({ key, fileName }) => {
        const final = await formatImage(s3Client)({ 
            fromFileName: fileName, 
            width: 1200, 
            height: 800 
        })
        return { key, fileName: final }
    }))
])
```

**Available Patterns:**
- Component creation and association
- StandardImage component handling
- Asset workspace integration

#### Upload Endpoint Reference
```typescript
// Existing upload functionality in assets lambda (to be referenced)
// Location: lambda/assets/upload/
// Currently handles presigned URL generation (in wrong place)
// Can be used as reference for our new implementation
```

**Available Infrastructure:**
- Existing presigned URL generation patterns
- Upload bucket configuration
- Client upload flow patterns

## New Architecture

### Processing Pipeline

The new image processing system operates as an independent, event-driven pipeline:

```typescript
// Client requests upload capability
const presignedUrl = await getPresignedUploadUrl({
    imageType: 'map' | 'character' | 'general',
    targetResolution: '1200x800' | '400x300'
})

// Client uploads directly to uploads bucket
// Filename: IMAGE-${universalKey}.${extension}
// S3 tags include: requestId, sessionId, processing parameters

// S3 ObjectCreated event triggers image processing lambda
// Processing lambda reads metadata from S3 object tags
// Stores processed image as IMAGE-${universalKey}.png in images bucket
// Publishes success/error to PubSub for client notification
```

### Key Benefits

1. **End-to-End Control**: Backend generates all universalKey values, preventing abuse
2. **Event-Driven Processing**: S3 events trigger processing, eliminating tight coupling
3. **Guaranteed Consistency**: StandardImage components only created after processing confirms success
4. **Separation of Concerns**: Image processing decoupled from WML lambda
5. **Client Experience**: Immediate in-memory preview, background processing, guaranteed file availability

### S3 Bucket Strategy

- **Uploads Bucket**: Receives raw images with `IMAGE-${universalKey}.${extension}` naming
- **Images Bucket**: Stores processed images as `IMAGE-${universalKey}.png`
- **CloudFront**: Serves processed images with appropriate caching

### Metadata and Processing Parameters

S3 object tags include:
- `requestId`: Links processing back to client request
- `sessionId`: Enables PubSub delivery to specific client session
- `imageType`: Determines processing approach and resolution
  - `"map"`: High resolution (1200x800) for detailed viewing
  - `"character"`: Medium resolution (300x300) for character portraits

**Note**: Resolution is hard-coded per image type, eliminating the need for separate `targetResolution` parameter.

## Implementation Plan

### Phase 1: Core Infrastructure
1. **Presigned URL Generation**: Backend endpoint for secure upload requests
2. **S3 Event Handling**: Lambda triggered by ObjectCreated events
3. **Image Processing**: Core image transformation logic (leveraging existing Jimp code)
4. **PubSub Integration**: Success/error notification system

### Phase 2: Client Integration
1. **Upload Flow**: Client-side drag-and-drop with immediate preview
2. **Processing Status**: Real-time feedback during image processing
3. **WML Integration**: Safe addition of Image tags after processing confirmation

### Phase 3: Advanced Features
1. **Multiple Resolutions**: Support for different image types and sizes
2. **Format Optimization**: Automatic format selection based on content
3. **Error Recovery**: Retry mechanisms and user feedback

## Technical Details

### Processing Parameters

- **Map Images**: High resolution (1200x800) for detailed viewing
- **Character Portraits**: Medium resolution (400x300) for UI elements
- **Image Types**: Limited to "map" and "character" contexts only
- **Resolution Strategy**: Hard-coded per image type, no dynamic resolution selection

### Security Considerations

- **UniversalKey Generation**: Backend controls all key generation
- **Upload Restrictions**: Uploads bucket only accessible via presigned URLs
- **Processing Validation**: All processing parameters validated from S3 tags

### Error Handling

- **Processing Failures**: Detailed error messages via PubSub
- **Format Issues**: Automatic fallback to supported formats
- **Client Notification**: Real-time feedback for user experience
- **Error Investigation**: Leverage Jimp's error information as we implement
- **SNS Integration**: Use existing lightweight SNS client for PubSub delivery

### Lambda Architecture

- **Separate Lambda**: New image processing lambda in `lambda/imageProcessor/` directory
- **SNS Integration**: Leverage existing SNS setup for lightweight PubSub
- **Event-Driven**: Triggered by S3 ObjectCreated events from uploads bucket
- **Independent Scaling**: Separate from WML lambda for better resource utilization

## Integration Points

### Dependencies
- **S3**: File storage and event triggering
- **Lambda**: Image processing and PubSub publishing
- **CloudFront**: Image serving and caching
- **WML System**: StandardImage component creation

### Cross-References
- **[Upload System](../assets/upload/)**: Legacy system being replaced
- **[WML Parse](../parseWML.ts)**: Integration with WML processing
- **[Client Display](../../charcoal-client/)**: Image serving and display
- **[PubSub System](../subscriptions/)**: Client notification delivery

## Migration Notes

### Current State
- **Image Processing**: Completely disabled in current system
- **fileName Properties**: Stubbed out and non-functional
- **WML Integration**: No active image processing during parsing

### Target State
- **Event-Driven Processing**: S3 events trigger independent processing
- **UniversalKey Association**: Direct file association via component universalKey
- **Client-Driven Workflow**: Images added to WML only after processing confirmation

### No Backward Compatibility Required
- Previous image system thoroughly disabled
- No existing image data to migrate
- Clean slate for new architecture implementation

## Development Notes

### Key Files to Create/Modify
- `presignedUrl/index.ts`: Generate secure upload URLs
- `imageProcessor/index.ts`: S3 event-driven image processing (leveraging existing Jimp code)
- `notifications/index.ts`: PubSub integration for client feedback

### Lambda Separation Benefits
- **WML Lambda**: Lighter build (no image processing libraries)
- **Image Lambda**: Focused on image processing and optimization
- **Better Resource Utilization**: Independent scaling and deployment

### Code Reuse Strategy
- **Leverage Existing**: Jimp processing logic, S3 operations, error handling
- **Refactor**: Extract reusable image processing functions
- **Replace**: WML integration patterns with new event-driven approach

## Navigation Tips

### Key Systems
- **Upload Management**: Presigned URL generation and S3 upload handling
- **Image Processing**: S3 event-driven transformation pipeline
- **Client Notification**: PubSub-based status updates
- **WML Integration**: Safe component creation after processing

### Related Documentation
- **[WML Components](../../packages/mtw-wml/ts/standardize/components/)**: StandardImage implementation
- **[Asset Workspace](../../packages/mtw-asset-workspace/)**: WML processing integration
- **[Client Architecture](../../charcoal-client/)**: Frontend image handling
