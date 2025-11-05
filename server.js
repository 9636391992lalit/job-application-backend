import './config/instrument.js'
import express from 'express'
import * as Sentry from '@sentry/node'
import cors from 'cors'
import 'dotenv/config'
import connectDB from './config/db.js'
import userRoutes from './routes/userRoutes.js'
import companyRoutes from './routes/companyRoutes.js'
import jobRoutes from './routes/JobRoutes.js'
import adminRoutes from './routes/adminRoutes.js'
import chatRoutes from './routes/chatRoutes.js'; // Chat routes
import { createServer } from 'http'
import { Server } from 'socket.io'
import connectCloudinary from './config/cloudinary.js'

// --- 1. IMPORT CHAT MODELS ---
import Conversation from './models/Conversation.js';
import Message from './models/Message.js';

const app = express();
const server = createServer(app);
const apiKey = process.env.GEMINI_API_KEY;
console.log("Gemini API Key loaded:", apiKey);

// Initialize Socket.io with CORS
export const io = new Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:5173',
        methods: ['GET', 'POST']
    }
});

// --- 2. UPDATED SOCKET.IO CONNECTION HANDLER ---
io.on('connection', (socket) => {
    console.log(`🔗 User connected: ${socket.id}`);

    // Listen for user to register their ID (for notifications)
    // On frontend, after login: socket.emit('register', userData._id)
    socket.on('register', (userId) => {
        socket.join(userId);
        console.log(`User ${userId} joined their personal room.`);
    });

    // Listen for user to join a specific chat room
    // On frontend, when opening a chat: socket.emit('joinChat', conversationId)
    socket.on('joinChat', (conversationId) => {
        socket.join(conversationId);
        console.log(`User ${socket.id} joined chat room: ${conversationId}`);
    });

    // Listen for a new message from a client
    socket.on('sendMessage', async (messageData, callback) => {
        // messageData = { conversationId, senderId, senderModel, content, recipientId }
        
        try {
            // 1. Save the message to the database
            const newMessage = new Message({
                conversationId: messageData.conversationId,
                senderId: messageData.senderId,
                senderModel: messageData.senderModel, // 'User' or 'Company'
                content: messageData.content
            });
            const savedMessage = await newMessage.save();

            // 2. Update the "lastMessage" in the Conversation model
            await Conversation.findByIdAndUpdate(messageData.conversationId, {
                lastMessage: savedMessage._id
            });
            
            // 3. Emit the message to the specific chat room
            // This sends to everyone *currently looking* at the chat
            io.to(messageData.conversationId).emit('newMessage', savedMessage);

            // 4. Send a notification to the recipient's personal room
            // This sends a "new message" dot even if they are not in the chat
            io.to(messageData.recipientId).emit('chatNotification', savedMessage);

            // 5. Acknowledge message was received
            if (callback) callback({ success: true });

        } catch (error) {
            console.error("Error saving message:", error);
            if (callback) callback({ success: false, error: error.message });
        }
    });

    socket.on('disconnect', () => {
        console.log('🔌 User disconnected');
    });
});
// --- END OF SOCKET.IO LOGIC ---

await connectDB();
await connectCloudinary();

// --- Basic Middleware ---
app.use(cors());
app.use(express.json());

// --- Routes ---
app.get('/', (req, res) => res.send("API Working"));
app.get("/debug-sentry", (req, res) => { throw new Error("My first Sentry error!"); });

// API Routes
app.use('/api/users', userRoutes);
app.use('/api/company', companyRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/chat', chatRoutes); // Your chat API routes

// --- Error Handling & Server Start ---
const PORT = process.env.PORT || 5000;
Sentry.setupExpressErrorHandler(app);
server.listen(PORT, () => {
    console.log(`🚀 Server with Socket.io is running at http://localhost:${PORT}`);
});