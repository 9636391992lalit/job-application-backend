// models/Company.js
import mongoose from "mongoose";

const companySchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    image: { type: String, required: true },
    password: { type: String, required: true },
    website: { type: String, required: true }, // Added from PendingCompany logic
    domain: { type: String, required: true },   // Added from PendingCompany logic
    cin: { type: String, required: true, unique: true }, // Added from PendingCompany logic

    // --- FIX: Add these fields ---
    isVerified: { type: Boolean, default: false },
    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected'],
        default: 'Pending' // Or set default based on your logic, but 'Approved' makes sense here
    },
    description: {
        type: String,
        default: '' // Default to an empty string
    },
    industry: {
        type: String,
        default: '' // Default to an empty string
    },
    location: {
        type: String,
        default: '' // Default to an empty string
    },
    companySize: {
        type: String,
        default: '' // e.g., "1-50", "51-200"
    }
    // ---------------------------

}, { timestamps: true }); // Good practice to add timestamps

// Add indexes for faster lookups



const Company = mongoose.model('Company', companySchema);
export default Company;