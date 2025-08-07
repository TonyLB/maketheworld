# Image Format Processing

## Overview

The Image Format Processing function handles the transformation of uploaded images into standardized formats for Make The World assets. It currently uses UUID-based naming but is planned for migration to universalKey-based storage for improved system elegance.

## Current Architecture

### Processing Pipeline

The format image function operates as part of the WML parsing pipeline:

```typescript
export const formatImage = (s3Client: S3Client) => async ({ 
    fromFileName, 
    width, 
    height 
}): Promise<string | undefined>
```

**Process Flow**:
1. **Input Retrieval**: Reads uploaded image from `UPLOAD_BUCKET`
2. **Image Processing**: Resizes and converts using Jimp library
3. **Output Storage**: Saves processed image to `IMAGES_BUCKET`
4. **Filename Return**: Returns processed filename for WML association

### Current Implementation

```typescript
// Current UUID-based naming
const toFileName = `IMAGE-${uuidv4()}`

// Processing steps
const beforeBuffer = await jimp.read(contents)
const afterBuffer = await beforeBuffer
    .resize(width, height, jimp.RESIZE_BEZIER)
    .deflateLevel(5)
    .getBufferAsync(jimp.MIME_PNG)

// Storage
await s3Client.send(new PutObjectCommand({
    Bucket: process.env.IMAGES_BUCKET,
    Key: `${toFileName}.png`,
    Body: afterBuffer,
    ContentType: 'image/png'
}))
```

### Integration Points

#### WML Parse Integration
```typescript
// In parseWML.ts
const imageFiles = await Promise.all([
    // ... WML loading
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

#### StandardImage Association
```typescript
// Update WML component with processed filename
imageFiles.forEach(({ key, fileName }) => {
    const imageComponent = newStandard.byId[key]
    if (imageComponent instanceof StandardImage) {
        newStandard.byUniversalId[key] = imageComponent.withFileName(fileName)
    }
})
```

## Proposed Universal Key Solution

### Architecture Overview

The system can be simplified by using the component's `universalKey` as the filename:

```typescript
// Current: IMAGE-${uuidv4()}.png
// Proposed: ${universalKey}.png
```

### Benefits

1. **Direct Association**: File name directly corresponds to component identity
2. **Eliminated Properties**: No need for separate fileName property storage
3. **Automatic Cleanup**: File deletion when component is removed
4. **Predictable URLs**: Client can construct URLs directly from universalKey
5. **Reduced Complexity**: Single source of truth for image location

### Implementation Plan

#### Phase 1: Universal Key Integration
```typescript
// Proposed implementation
export const formatImage = (s3Client: S3Client) => async ({ 
    fromFileName, 
    universalKey,  // New parameter
    width, 
    height 
}): Promise<string | undefined> => {
    const toFileName = universalKey // Use universalKey directly
    
    // ... processing logic ...
    
    await s3Client.send(new PutObjectCommand({
        Bucket: process.env.IMAGES_BUCKET,
        Key: `${toFileName}.png`,
        Body: afterBuffer,
        ContentType: 'image/png'
    }))
    
    return toFileName
}
```

#### Phase 2: WML Integration Update
```typescript
// Updated WML parse integration
const imageFiles = await Promise.all([
    // ... WML loading
    ...(images.map(async ({ key, fileName, universalKey }) => {
        const final = await formatImage(s3Client)({ 
            fromFileName: fileName,
            universalKey,  // Pass universalKey
            width: 1200, 
            height: 800 
        })
        return { key, fileName: final }
    }))
])
```

#### Phase 3: Property Elimination
```typescript
// No longer need to update fileName properties
// Component can access image directly via universalKey
const imageComponent = newStandard.byId[key]
if (imageComponent instanceof StandardImage) {
    // No property update needed - image accessible via universalKey
    newStandard.byUniversalId[key] = imageComponent
}
```

## Technical Details

### Current Processing Parameters

- **Input Formats**: JPEG, PNG, GIF, BMP, TIFF
- **Output Format**: PNG with deflate compression
- **Dimensions**: 1200x800 pixels (configurable)
- **Quality**: Level 5 deflate compression
- **Resize Algorithm**: Bezier interpolation

### Proposed Enhancements

#### Universal Key Validation
```typescript
const validateUniversalKey = (universalKey: string): boolean => {
    // Validate universalKey format
    // Ensure it's safe for S3 object names
    // Check for conflicts
}
```

#### URL Safety
```typescript
const sanitizeUniversalKey = (universalKey: string): string => {
    // Convert to URL-safe format
    // Handle special characters
    // Ensure uniqueness
}
```

#### Error Handling
```typescript
const handleProcessingError = (error: Error, universalKey: string) => {
    // Log error with universalKey context
    // Clean up partial files
    // Notify monitoring systems
}
```

## Integration Points

### Dependencies
- **S3**: File storage for uploaded and processed images
- **Jimp**: Image processing library
- **WML System**: Component universalKey generation
- **Asset Cache**: Component data storage

### Cross-References
- **[Upload System](../assets/upload/)**: Image upload process
- **[WML Parse](../parseWML.ts)**: Integration with WML processing
- **[Client Display](../../charcoal-client/)**: Image serving
- **[Asset Properties](../assets/README.images.md)**: Current image association

## Usage Patterns

### Current Usage
```typescript
// Process uploaded image
const processedFileName = await formatImage(s3Client)({
    fromFileName: 'IMAGE-abc123.jpg',
    width: 1200,
    height: 800
})

// Result: 'IMAGE-def456' (stored as IMAGE-def456.png)
```

### Proposed Usage
```typescript
// Process uploaded image with universalKey
const processedFileName = await formatImage(s3Client)({
    fromFileName: 'IMAGE-abc123.jpg',
    universalKey: 'component-uuid-123',
    width: 1200,
    height: 800
})

// Result: 'component-uuid-123' (stored as component-uuid-123.png)
```

## Error Handling

### Current Issues
- **UUID Collisions**: Rare but possible UUID conflicts
- **Orphaned Files**: Processed files without associated components
- **Property Mismatches**: fileName properties pointing to non-existent files

### Proposed Improvements
- **Universal Key Validation**: Validate universalKey before processing
- **Automatic Cleanup**: File deletion with component removal
- **Conflict Resolution**: Clear strategy for universal key conflicts
- **Error Recovery**: Better error handling and recovery mechanisms

## Development Notes

### Current State
- **UUID-Based System**: Functional but complex
- **Property Dependencies**: Requires fileName property updates
- **Manual Cleanup**: Orphaned file cleanup needed

### Future State
- **Universal Key System**: Simplified and elegant
- **Direct Associations**: No separate property tracking
- **Automatic Management**: Self-maintaining system

### Migration Strategy
1. **Dual System Support**: Support both UUID and universalKey systems
2. **Gradual Migration**: Migrate assets one by one
3. **Backward Compatibility**: Maintain existing functionality
4. **Cleanup Phase**: Remove old system after migration

## Navigation Tips

### Key Files
- `index.ts`: Main image processing implementation
- `parseWML.ts`: WML integration
- `upload/index.ts`: Upload system integration

### Related Systems
- **[Upload System](../assets/upload/)**: Image upload process
- **[WML Parse](../parseWML.ts)**: WML processing integration
- **[Client Display](../../charcoal-client/)**: Image serving
- **[Asset Cache](../assets/cacheAsset/)**: Component storage
