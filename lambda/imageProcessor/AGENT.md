# Image Processor Lambda

## Overview

The Image Processor Lambda is an event-driven service that automatically processes uploaded images from the `uploads` S3 bucket and transforms them into standardized formats for the Make The World platform. It serves as the bridge between raw user uploads and the production `images` bucket.

### Purpose
This lambda handles the automatic transformation of user-uploaded images into platform-standard formats, ensuring consistency and quality across all Make The World assets.

### Context
The Image Processor Lambda is part of the broader asset management system, working alongside the WML lambda for asset processing and the client system for user interactions. It decouples image processing from WML operations, enabling better scalability and reliability.

### Key Concepts
- **Event-Driven Processing**: S3 ObjectCreated events trigger automatic image processing
- **Image Standardization**: All images converted to consistent PNG format with type-specific dimensions
- **UniversalKey Association**: Images linked to assets via unique universalKey identifiers
- **Processing Pipeline**: Raw upload → validation → transformation → storage → notification

## Core Purpose

### Primary Function
Automatically process uploaded images to meet platform standards and store them in the production images bucket for immediate use by the WML system and client applications.

### Key Responsibilities
- **Image Processing Pipeline**: Transform raw uploads to standardized formats
- **Event-Driven Architecture**: Respond to S3 upload events automatically
- **Image Standardization**: Apply consistent formatting and quality standards
- **Notification System**: Provide real-time feedback on processing results
- **Error Handling**: Gracefully handle processing failures with detailed reporting

## Technical Details

### S3 Upload Tagging Requirements
Images uploaded to the `uploads` bucket must include specific S3 object tags:
- `imageType`: Determines processing approach and resolution (map, character)
- `requestId`: Links processing back to client request
- `sessionId`: Enables PubSub delivery to specific client session

### Image Validation and Transformation
The lambda validates uploaded images and transforms them to guarantee that all images in the `images` bucket are properly formed PNG files with specified resolutions:
- **Map Images**: High resolution (1200x800) for detailed viewing
- **Character Portraits**: Medium resolution (300x300) for UI elements


### SNS Feedback Purpose
SNS notifications inform the uploading client of processing results, including the resulting `IMAGE#${uuid}` ComponentUUID universalKey that can be safely used in WML assets after processing confirmation.

## Integration Points

### Dependencies
- **S3 Service**: Source and destination storage for images
- **SNS Service**: Notification delivery for processing results
- **Jimp Library**: Image processing and transformation
- **AWS SDK**: S3 and SNS client operations

### Cross-References
- **[WML Lambda](../wml/AGENT.md)**: Integration with asset processing system
- **[Asset System](../assets/AGENT.md)**: Content management and version control
- **[Client System](../../charcoal-client/AGENT.md)**: Frontend image handling and display
- **[Upload System](../assets/upload/AGENT.md)**: Legacy upload functionality being replaced
- **[WML Components](../../packages/mtw-wml/ts/standardize/components/AGENT.md)**: StandardImage component implementation

### API Contracts
- **Input**: S3 ObjectCreated events with processing parameters in object tags
- **Output**: Processed images in images bucket with success/error notifications via SNS
- **Error Handling**: Comprehensive error reporting with client-friendly messages

### System Relationships
The Image Processor Lambda sits between the upload system and the WML processing system:
1. **Upload System** → Places raw images in uploads bucket with metadata
2. **Image Processor** → Transforms images and stores in images bucket
3. **WML System** → Creates StandardImage components using processed images
4. **Client System** → Displays processed images with guaranteed availability

## Usage Patterns

### Common Scenarios
- **Map Image Processing**: High-resolution images for detailed world maps and locations
- **Character Portrait Processing**: Medium-resolution images for character avatars and portraits

### Best Practices
- **Error Handling**: Always include detailed error information in SNS notifications
- **Logging**: Log processing steps for debugging and monitoring
- **Validation**: Validate image format and size before processing
- **Resource Management**: Properly handle S3 streams and buffers
- **Timeout Handling**: Set appropriate lambda timeout for large image processing

## Development Notes

### Current State
- **✅ Fully Functional**: Complete image processing pipeline implemented and tested
- **✅ Core Processing**: Jimp integration with type-specific image transformation
- **✅ S3 Operations**: GetObject from uploads bucket, PutObject to images bucket
- **✅ Notification System**: SNS integration with success/error notifications
- **✅ Error Handling**: Comprehensive error handling with client-friendly messages
- **✅ Event-Driven**: S3 ObjectCreated events trigger automatic processing

### Environment Configuration
- **✅ UPLOADS_BUCKET**: Source bucket for raw images
- **✅ IMAGES_BUCKET**: Destination bucket for processed images  
- **✅ FEEDBACK_TOPIC**: SNS topic for processing notifications
- **✅ AWS_REGION**: AWS region for service configuration

## Navigation Tips

### Getting Started
1. **Begin with Overview**: Understand the lambda's role in the asset processing pipeline
2. **Review Technical Details**: Examine S3 tagging requirements and processing specifications
3. **Check Integration Points**: Understand how this lambda connects to other systems
4. **Study Usage Patterns**: Review common scenarios and best practices

### Key Files
- **`app.ts`**: Main lambda handler with complete image processing pipeline
- **`package.json`**: Dependencies and build configuration

### Related Documentation
- **[WML System](../../packages/mtw-wml/ts/AGENT.md)**: Core markup language and component system
- **[Asset Workspace](../../packages/mtw-asset-workspace/AGENT.md)**: Asset processing and management
- **[Lambda Functions](../README.md)**: Overview of all lambda services
- **[Client Architecture](../../charcoal-client/AGENT.md)**: Frontend system and image display
