const { Readable } = require('stream');
const { getGridFSBucket } = require('../config/mongodb');

const uploadFile = async (buffer, filename, mimeType) => {
  const bucket = getGridFSBucket();
  const readableStream = Readable.from(buffer);
  return new Promise((resolve, reject) => {
    const uploadStream = bucket.openUploadStream(filename, {
      contentType: mimeType
    });
    readableStream.pipe(uploadStream);
    uploadStream.on('finish', () => resolve(uploadStream.id));
    uploadStream.on('error', reject);
  });
};

const getFile = async (fileId, res) => {
  const { ObjectId } = require('mongodb');
  const bucket = getGridFSBucket();
  const id = new ObjectId(fileId);

  const files = await bucket.find({ _id: id }).toArray();
  if (!files || files.length === 0) {
    const err = new Error('Archivo no encontrado');
    err.status = 404;
    throw err;
  }

  const file = files[0];
  res.set('Content-Type', file.contentType || 'application/octet-stream');
  res.set('Content-Disposition', `inline; filename="${file.filename}"`);

  const downloadStream = bucket.openDownloadStream(id);
  downloadStream.pipe(res);
  downloadStream.on('error', () => res.status(500).end());
};

const deleteFile = async (fileId) => {
  const { ObjectId } = require('mongodb');
  const bucket = getGridFSBucket();
  await bucket.delete(new ObjectId(fileId));
};

module.exports = { uploadFile, getFile, deleteFile };
