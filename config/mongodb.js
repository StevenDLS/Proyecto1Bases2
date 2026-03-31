const mongoose = require('mongoose');
const { GridFSBucket } = require('mongodb');
require('dotenv').config();

let gfsBucket;

const connectMongoDB = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  gfsBucket = new GridFSBucket(mongoose.connection.db, { bucketName: 'uploads' });
  console.log('MongoDB: conectado al Replica Set');
};

const getGridFSBucket = () => gfsBucket;

module.exports = { connectMongoDB, getGridFSBucket };
