import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import User from '../models/User.js';
import Company from '../models/Company.js';

// @desc    Find or create a conversation (for a company)
// @route   POST /api/chat/company/start
// @access  Private (Company)
export const getOrCreateConversation = async (req, res) => {
    const companyId = req.company._id; // From protectCompany middleware
    const { userId } = req.body; // The applicant ID

    if (!userId) {
        return res.status(400).json({ success: false, message: "User ID is required" });
    }

    try {
        // Find if a chat already exists
        let conversation = await Conversation.findOne({
            companyId: companyId,
            userId: userId
        });

        if (conversation) {
            // Chat already exists
            return res.json({ success: true, conversation });
        }

        // Chat doesn't exist, create a new one
        const newConversation = await Conversation.create({
            companyId: companyId,
            userId: userId
        });

        res.status(201).json({ success: true, conversation: newConversation });

    } catch (error) {
        console.error("Error finding or creating conversation:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

// @desc    Get all of a company's conversations
// @route   GET /api/chat/company/conversations
// @access  Private (Company)
export const getCompanyConversations = async (req, res) => {
    try {
        const conversations = await Conversation.find({ companyId: req.company._id })
            .populate('userId', 'name image headline') // Get user details
            .populate('lastMessage') // Get the last message
            .sort({ updatedAt: -1 }); // Show most recent first

        res.json({ success: true, conversations });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

// @desc    Get all of a user's conversations
// @route   GET /api/chat/user/conversations
// @access  Private (User)
export const getUserConversations = async (req, res) => {
    try {
        const conversations = await Conversation.find({ userId: req.auth.userId })
            .populate('companyId', 'name image') // Get company details
            .populate('lastMessage')
            .sort({ updatedAt: -1 });

        res.json({ success: true, conversations });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

// @desc    Get all messages for a single conversation
// @route   GET /api/chat/messages/:conversationId
// @access  Private (User or Company)
export const getMessages = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const userId = req.auth.userId; // Assuming user is logged in
        
        // 1. Check if conversation exists
        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
            return res.status(404).json({ success: false, message: "Conversation not found" });
        }

        // 2. Security Check: Make sure the logged-in user is part of this chat
        // (We'll expand this to check for company ID later)
        if (conversation.userId.toString() !== userId) {
             return res.status(403).json({ success: false, message: "Not authorized" });
        }

        // 3. Get all messages
        const messages = await Message.find({ conversationId: conversationId })
            .sort({ createdAt: 1 }); // Show oldest first

        res.json({ success: true, messages });

    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error" });
    }
};