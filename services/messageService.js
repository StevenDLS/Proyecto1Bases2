const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  threadId: { type: String, required: true, unique: true },
  participants: [String],
  subject: String,
  messages: [{
    messageId: String,
    senderId: String,
    content: String,
    sentAt: { type: Date, default: Date.now },
    readBy: [String]
  }],
  lastMessageAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

const MessageThread = mongoose.models.MessageThread ||
  mongoose.model('MessageThread', messageSchema, 'message_threads');

const createThread = async (senderId, recipientIds, subject, content) => {
  const threadId = uuidv4();
  const messageId = uuidv4();
  const participants = [senderId, ...recipientIds.filter(id => id !== senderId)];
  const now = new Date();

  const thread = await MessageThread.create({
    threadId,
    participants,
    subject,
    messages: [{
      messageId,
      senderId,
      content,
      sentAt: now,
      readBy: [senderId]
    }],
    lastMessageAt: now
  });
  return thread.toObject();
};

const replyToThread = async (threadId, senderId, content) => {
  const thread = await MessageThread.findOne({ threadId });
  if (!thread) {
    const err = new Error('Hilo no encontrado');
    err.status = 404;
    throw err;
  }
  if (!thread.participants.includes(senderId)) {
    const err = new Error('No autorizado');
    err.status = 403;
    throw err;
  }

  const messageId = uuidv4();
  const now = new Date();
  thread.messages.push({ messageId, senderId, content, sentAt: now, readBy: [senderId] });
  thread.lastMessageAt = now;
  await thread.save();
  return thread.toObject();
};

const getThreads = async (userId) => {
  return MessageThread.find({ participants: userId })
    .sort({ lastMessageAt: -1 })
    .lean();
};

const getThread = async (threadId, userId) => {
  const thread = await MessageThread.findOne({ threadId });
  if (!thread) {
    const err = new Error('Hilo no encontrado');
    err.status = 404;
    throw err;
  }
  if (!thread.participants.includes(userId)) {
    const err = new Error('No autorizado');
    err.status = 403;
    throw err;
  }

  // Marcar mensajes como leídos
  for (const msg of thread.messages) {
    if (!msg.readBy.includes(userId)) {
      msg.readBy.push(userId);
    }
  }
  await thread.save();
  return thread.toObject();
};

const getUnreadCount = async (userId) => {
  const threads = await MessageThread.find({ participants: userId }).lean();
  let count = 0;
  for (const thread of threads) {
    const hasUnread = thread.messages.some(m => !m.readBy.includes(userId));
    if (hasUnread) count++;
  }
  return count;
};

module.exports = { createThread, replyToThread, getThreads, getThread, getUnreadCount };
