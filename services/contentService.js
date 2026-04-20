const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI);

const SectionContent = mongoose.models.SectionContent ||
  mongoose.model('SectionContent', new mongoose.Schema({
    sectionId: { type: String, required: true, unique: true },
    items: { type: Array, default: [] },
    updatedAt: { type: Date, default: Date.now }
  }), 'section_content');

const getContent = async (sectionId) => {
  const doc = await SectionContent.findOne({ sectionId });
  return doc ? doc.items : [];
};

const updateContent = async (sectionId, items) => {
  await SectionContent.findOneAndUpdate(
    { sectionId },
    { items, updatedAt: new Date() },
    { upsert: true, new: true }
  );
};

const addFileItem = async (sectionId, type, fileId, filename, order) => {
  const doc = await SectionContent.findOne({ sectionId }) || { sectionId, items: [] };
  const items = doc.items || [];
  items.push({ type, fileId: fileId.toString(), filename, order: order || items.length });
  await SectionContent.findOneAndUpdate(
    { sectionId },
    { items, updatedAt: new Date() },
    { upsert: true, new: true }
  );
};

module.exports = { getContent, updateContent, addFileItem };
