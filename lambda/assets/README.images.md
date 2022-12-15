---
---

# Image Storage

The Assets Lambda stores Image files separately from the asset files in which they are
referenced.  They are associated in the JSON mapping files, as described below.

---

## Needs Addressed

---

***Dynamically assigning images***
- Assets can be created as a single WML file which is fairly static in the absence of
a *structural* change to the data.
- Ideally, updating an image should be a data change, not a structural change, and
should happen by associating the Image in the WML file with an external file, without
editing that WML.

---

## Asset Properties

---

The Asset JSON file has a "properties" subsection which allows the attachment of external
data to namespaced items in the WML file.  In the case of Images, the data assigned
includes a `fileName` property.

---

## Outlets

- ***setImageURL***: Accepts an AssetID, image scopedID, and fileURL.  Updates the
properties in the Asset JSON file to associate the image with the fileURL.

---
