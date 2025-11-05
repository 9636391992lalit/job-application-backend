// models/JobApplication.js
import mongoose from 'mongoose';

const jobApplicationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Corrected type
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
    status: { type: String, default: 'Pending' },
    date: { type: Number, required: true },

    // --- ADD THESE FIELDS ---
    interviewRoundsPlanned: { type: Number, default: null },
    interviewRoundTypes: { type: String, default: '' },
    firstInterviewDateTime: { type: Date, default: null },
    // --- END NEW FIELDS ---

}, { timestamps: true }); // Add timestamps if not already present

const JobApplication = mongoose.model('JobApplication', jobApplicationSchema);
export default JobApplication;