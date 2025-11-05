// models/PendingCompany.js
import mongoose from "mongoose";

const pendingCompanySchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true }, // Ensure email is unique even in pending
    image: { type: String, required: true },
    password: { type: String, required: true }, // Store the HASHED password
    website: { type: String, required: true },
    domain: { type: String, required: true }, // Added domain
    cin: { type: String, required: true, unique: true }, // Ensure CIN is unique even in pending
    submittedAt: { type: Date, default: Date.now } // Track submission time
}, { timestamps: true });

// Add index to prevent duplicate submissions if needed (optional but good)



const PendingCompany = mongoose.model('PendingCompany', pendingCompanySchema);
export default PendingCompany;