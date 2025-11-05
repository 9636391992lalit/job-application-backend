// server/routes/chatRoutes.js
import express from 'express';
import { protectUser, protectCompany } from '../middleware/authMiddleware.js';
import {
    getOrCreateConversation,
    getUserConversations,
    getCompanyConversations,
    getMessages
} from '../controllers/chatController.js';

const router = express.Router();

// --- For Company ---
// This finds or creates a chat with a user.
router.post('/company/start', protectCompany, getOrCreateConversation);
// This gets the company's list of all chats.
router.get('/company/conversations', protectCompany, getCompanyConversations);

// --- For User ---
// This gets the user's list of all chats.
router.get('/user/conversations', protectUser, getUserConversations);

// --- For Both ---
// This gets all messages for a specific chat.
// We remove the middleware here because the controller handles auth for both users AND companies
router.get('/messages/:conversationId', getMessages);

export default router;