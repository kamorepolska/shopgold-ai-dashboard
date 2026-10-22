'use strict';

const { notificationOps } = require('../models/localDb');

function addNotification(title, message, type = 'info', module = 'general', recipient_username = null) {
  try {
    return notificationOps.add({ title, message, type, module, recipient_username });
  } catch (err) {
    console.error('[NotificationService] failed to add notification:', err);
    return null;
  }
}

function listNotifications(recipientUsername = null, module = null) {
  return notificationOps.findAll(recipientUsername, module);
}

function markAsRead(id) {
  return notificationOps.markRead(id);
}

function markAllAsRead(recipientUsername = null) {
  return notificationOps.markAllRead(recipientUsername);
}

function deleteNotification(id) {
  return notificationOps.delete(id);
}

function clearAll(recipientUsername = null) {
  return notificationOps.deleteAll(recipientUsername);
}

function getUnreadCount(recipientUsername = null, module = null) {
  return notificationOps.getUnreadCount(recipientUsername, module);
}

module.exports = {
  addNotification,
  listNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearAll,
  getUnreadCount
};
