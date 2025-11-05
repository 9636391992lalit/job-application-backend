import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
    conversationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Conversation',
        required: true,
    },
    // The ID of the sender. This could be a User ID or a Company ID.
    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
    },
    // This field is ESSENTIAL. It tells us which model 'senderId' refers to.
    senderModel: {
        type: String,
        required: true,
        enum: ['User', 'Company'] // The sender is either a User or a Company
    },
    content: {
        type: String,
        required: true,
    },
    read: {
        type: Boolean,
        default: false,
    }
}, { timestamps: true });

const Message = mongoose.model('Message', messageSchema);
export default Message;