
---
---

# uploadImage

This function accepts an S3 event in the `/uploads/images` directory of the Assets S3
bucket, and if possible interprets it as an upload associated with a specific
image. 

---

## Needs Addressed

---

- Front-end client needs to be able to send an image in multiple formats and resolutions
and have it converted to PNG 800x600.
- Asset manager needs to be able, at some point, to garbage collect images which have
had their references removed (presumably by cross-checking last modified date against
the current date, then checking anything older than an hour or so against existing
image tags in the Asset DB)
- Must be able to read an image tag from the AssetDB and find its associated file in
CloudFront
- Front-end client needs to be able to upload an image, upload a WML separately, and
have the Image tags in that WML refer to the right place to find that image file

---

## Usage

---

```js
    await uploadImage({ s3Client })({ bucket, key })
```

---
---

## Behaviors

### File locations

Files are removed from the `uploads/images/` subfolder, and their resized (and perhaps reformatted)
transforms are placed in the `images/` subfolder.  A CloudFront distribution is already created
in the CloudFormation stack pointing to that image:  Clients should access uploaded images from
that CloudFront distribution.

### UploadResponse message

Delivers a message in the following format to any client that has an `UPLOAD#` subscription
entry in the Assets DB table:

```ts
    interface ImageUploadResponse {
        messageType: 'Success',
        operation: 'ImageUpload',
        uploadId: string;
        destinationURL: string;
    }
```

Destination URL will be the CloudFront URL to reach to access the resized and cached image.