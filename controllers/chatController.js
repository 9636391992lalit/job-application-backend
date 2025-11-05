import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import User from '../models/User.js';
import Company from '../models/Company.js';
import jwt from 'jsonwebtoken'; // <-- Make sure to import JWT

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

        // --- UNIVERSAL AUTH CHECK ---
        let userId = null;
        let companyId = null;

        // Check for user or company token
        const authHeader = req.headers.authorization;
        const token = req.headers.token || (authHeader && authHeader.split(' ')[1]);

        if (!token) {
            return res.status(401).json({ success: false, message: "Not authorized, no token" });
        }

        try {
            // Try decoding as a User/Company token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            if (await User.findById(decoded.id)) {
                userId = decoded.id;
            } else if (await Company.findById(decoded.id)) {
                companyId = decoded.id;
            } else {
                throw new Error("Invalid token subject");
            }
        } catch (error) {
             return res.status(401).json({ success: false, message: "Not authorized, token failed" });
        }
        // --- END AUTH CHECK ---


        // 3. Check if conversation exists
        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
            return res.status(404).json({ success: false, message: "Conversation not found" });
        }

        // 4. Security Check: Make sure the logged-in user/company is part of this chat
        const isUserParticipant = userId && conversation.userId.toString() === userId;
        const isCompanyParticipant = companyId && conversation.companyId.toString() === companyId;

        if (!isUserParticipant && !isCompanyParticipant) {
             return res.status(403).json({ success: false, message: "Not authorized" });
        }

        // 5. Get all messages
        const messages = await Message.find({ conversationId: conversationId })
            .sort({ createdAt: 1 }); // Show oldest first

        res.json({ success: true, messages });

    } catch (error) {
        console.error("Error in getMessages:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};