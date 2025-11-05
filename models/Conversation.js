import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema({
    // The Applicant
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // The Recruiter's Company
    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        required: true
    },
    // A reference to the most recent message for previewing in the chat list
    lastMessage: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message',
    },
}, { timestamps: true });

// This compound index is crucial.
// It ensures that you can't accidentally create MORE THAN ONE
// chat room for the same user and company pair.
conversationSchema.index({ userId: 1, companyId: 1 }, { unique: true });

const Conversation = mongoose.model('Conversation', conversationSchema);
export default Conversation;