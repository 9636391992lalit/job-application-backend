import Company from '../models/Company.js';
import PendingCompany from '../models/PendingCompany.js'; // Import PendingCompany
import bcrypt from 'bcrypt';
import { v2 as cloudinary } from 'cloudinary';
import generateToken from '../utils/generateToken.js'; // Assuming this utility exists and works
import Job from '../models/Job.js';
import JobApplication from '../models/JobApplication.js';
import { io } from '../server.js';
import sendEmail from '../utils/sendEmail.js';
import moment from 'moment-timezone'; 
import User from '../models/User.js';
import { GoogleGenerativeAI } from "@google/generative-ai";
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

// --- Register a new Company (saves to Pending) ---
export const registerCompany = async (req, res) => {
    const { name, email, password, website, domain, cin } = req.body;
    const imageFile = req.file;

    // Validate all required fields
    if (!name || !email || !password || !website || !domain || !cin || !imageFile) {
        return res.status(400).json({ success: false, message: "Missing required details" });
    }

    // Basic URL validation (optional but recommended)
    try {
        new URL(website);
    } catch (_) {
        return res.status(400).json({ success: false, message: "Invalid website URL format (e.g., https://example.com)" });
    }

    try {
        // Check for duplicates in both main and pending collections
        const existingCompany = await Company.findOne({ $or: [{ email }, { cin }, { domain }] });
        const pendingCompany = await PendingCompany.findOne({ $or: [{ email }, { cin }, { domain }] });

        if (existingCompany || pendingCompany) {
            let message = "Registration failed: ";
            if ((existingCompany?.email === email) || (pendingCompany?.email === email)) message += "Email already exists. ";
            if ((existingCompany?.cin === cin) || (pendingCompany?.cin === cin)) message += "CIN already registered. ";
            if ((existingCompany?.domain === domain) || (pendingCompany?.domain === domain)) message += "Domain already registered. ";
            return res.status(400).json({ success: false, message: message.trim() });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashPassword = await bcrypt.hash(password, salt);

        // Upload image
        const imageUpload = await cloudinary.uploader.upload(imageFile.path, {
            folder: "company_logos", // Optional: organize uploads
            // transformation: [{ width: 200, height: 200, crop: "limit" }] // Optional: resize image
        });

        // Create entry in PendingCompany collection
        await PendingCompany.create({
            name,
            email,
            password: hashPassword,
            image: imageUpload.secure_url,
            website,
            domain,
            cin,
        });

        // Send success message, NO TOKEN
        res.status(201).json({
            success: true,
            message: "Registration successful! Your account is pending admin approval."
        });

    } catch (error) {
        console.error("Error during company registration submission:", error);
        // Handle potential Cloudinary upload errors specifically if needed
        if (error.http_code && error.http_code >= 400) {
            return res.status(500).json({ success: false, message: "Image upload failed. Please try again." });
        }
        res.status(500).json({ success: false, message: "Registration failed due to a server error. Please try again." });
    }
};

// --- Login Company (Checks Status) ---
export const loginCompany = async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ success: false, message: "Email and password are required." });
    }
    try {
        const company = await Company.findOne({ email });

        // Check if company exists in the main collection
        if (!company) {
            // If not found, check if they are still pending approval
            const pending = await PendingCompany.findOne({ email });
            if (pending) {
                return res.status(401).json({ success: false, message: "Account is pending admin approval." });
            }
            // If not in pending either, the email is not registered
            return res.status(404).json({ success: false, message: "Company email not registered." });
        }

        // --- Check Company Status ---
        if (company.status !== 'Approved') {
            if (company.status === 'Pending') { // This case should ideally not happen with the new flow, but good safety check
                return res.status(401).json({ success: false, message: "Account is still pending admin approval." });
            }
            if (company.status === 'Rejected') {
                return res.status(401).json({ success: false, message: "Your account registration was rejected." });
            }
            // Handle any other potential statuses
            return res.status(401).json({ success: false, message: "Account not active or approved." });
        }
        // ---------------------------------

        // Check password
        const isMatch = await bcrypt.compare(password, company.password);
        if (isMatch) {
            // Password matches, status is Approved - generate token
            res.json({
                success: true,
                company: { // Send only necessary, non-sensitive data
                    _id: company._id,
                    name: company.name,
                    email: company.email,
                    image: company.image,
                    isVerified: company.isVerified // Good to send verification status
                },
                token: generateToken(company._id) // Generate JWT token
            });
        } else {
            // Password does not match
            res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
    } catch (error) {
        console.error("Error during company login:", error);
        res.status(500).json({ success: false, message: "Login failed due to a server error. Please try again." });
    }
};


export const updateCompanyProfile = async (req, res) => {
    try {
        // 1. Get company ID from the token (provided by protectCompany middleware)
        console.log(req);
        const companyId = req.company._id;

        // 2. Get the new data from the request body
        const { description, industry, location, companySize } = req.body;

        // 3. Find the company
        const company = await Company.findById(companyId);

        if (!company) {
            return res.status(404).json({ success: false, message: "Company not found." });
        }

        // 4. Update the fields
        if (description !== undefined) company.description = description;
        if (industry !== undefined) company.industry = industry;
        if (location !== undefined) company.location = location;
        if (companySize !== undefined) company.companySize = companySize;

        // 5. Save the updated company
        await company.save();

        // 6. Send back the updated company data (this updates the frontend context)
        const updatedCompanyData = {
            _id: company._id,
            name: company.name,
            email: company.email,
            image: company.image,
            website: company.website,
            domain: company.domain,
            isVerified: company.isVerified,
            status: company.status,
            description: company.description,
            industry: company.industry,
            location: company.location,
            companySize: company.companySize
        };

        res.json({
            success: true,
            message: "Profile updated successfully!",
            company: updatedCompanyData
        });

    } catch (error) {
        console.error("Error updating company profile:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};
// --- Get Logged-in Company Data ---
export const getPublicCompanyProfile = async (req, res) => {
    try {
        const { id } = req.params;

        // 1. Fetch Company Public Details
        // We use .select() to EXCLUDE sensitive data
        const company = await Company.findById(id)
            .select('name image website description industry location companySize');

        if (!company) {
            return res.json({ success: false, message: "Company not found." });
        }

        // 2. Fetch all VISIBLE jobs for this company
        const jobs = await Job.find({ companyId: id, visible: true })
            .populate('companyId', 'name image') // We still need companyId for JobCard
            .sort({ date: -1 });

        // 3. Calculate Hiring & Activity Stats (Your Unique Feature!)
        const totalApplications = await JobApplication.countDocuments({ companyId: id });
        const totalHires = await JobApplication.countDocuments({
            companyId: id,
            status: 'Interview Scheduled'
        });

        // This stat is great for users: it shows if the company is active
        const totalResponded = await JobApplication.countDocuments({
            companyId: id,
            status: { $in: ['Interview Scheduled', 'Rejected'] } // Count all "final" decisions
        });

        const responseRate = (totalApplications > 0)
            ? Math.round((totalResponded / totalApplications) * 100)
            : 0; // Avoid dividing by zero

        // Send all the data back
        res.json({
            success: true,
            company: company,
            jobs: jobs,
            stats: {
                totalJobs: jobs.length,
                totalHires: totalHires, // "how much of the people get hired"
                responseRate: responseRate  // "Application Response Rate"
            }
        });

    } catch (error) {
        console.error("Error fetching public company profile:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};
export const getCompanyData = async (req, res) => {
    try {
        // req.company is attached by the protectCompany middleware
        const company = req.company;

        if (!company) {
            // This case might happen if the token is valid but the company was deleted
            return res.status(404).json({ success: false, message: "Company data not found for this token." });
        }

        // Return relevant, non-sensitive company details
        res.json({
            success: true,
            company: {
                _id: company._id,
                name: company.name,
                email: company.email,
                image: company.image,
                website: company.website,
                domain: company.domain,
                // Maybe add description, industry, companySize, hqLocation later
                isVerified: company.isVerified,
                status: company.status, // Good to know the status
                createdAt: company.createdAt, // Timestamps can be useful
                updatedAt: company.updatedAt
            }
        });
    } catch (error) {
        console.error("Error fetching company data:", error);
        res.status(500).json({ success: false, message: "Failed to fetch company data." });
    }
};

// --- Post a new Job (Checks Status) ---
export const postJob = async (req, res) => {
    // --- Check Company Status ---
    if (req.company?.status !== 'Approved') {
        return res.status(403).json({ success: false, message: "Your company account is not approved to post jobs." });
    }
    // ---------------------------------

    const {
        title, description, location, salary, level, category,
        employmentType, workModel, requiredSkills, experienceYears
    } = req.body;
    const companyId = req.company._id;

    // --- Declare parsed values here ---
    let parsedSalary;
    let parsedExperienceYears;
    let finalRequiredSkills = []; // Initialize skills array

    // --- Enhanced Validation ---
    if (!title || !description || !location || salary === undefined || !level || !category) {
        return res.status(400).json({ success: false, message: "Missing required core job details (title, description, location, salary, level, category)." });
    }
    if (!employmentType || !workModel || experienceYears === undefined) {
        return res.status(400).json({ success: false, message: "Missing required job details (employment type, work model, experience years)." });
    }

    // Salary validation
    parsedSalary = parseInt(salary, 10);
    if (isNaN(parsedSalary) || parsedSalary < 0) {
        return res.status(400).json({ success: false, message: "Invalid salary amount. Must be a non-negative number." });
    }
    // Experience years validation
    parsedExperienceYears = parseFloat(experienceYears); // Use parseFloat if allowing half years
    if (isNaN(parsedExperienceYears) || parsedExperienceYears < 0) {
        return res.status(400).json({ success: false, message: "Invalid experience years. Must be a non-negative number." });
    }
    // Validate and process requiredSkills
    if (requiredSkills === undefined || requiredSkills === null) {
        finalRequiredSkills = []; // Default to empty array if not provided
    } else if (Array.isArray(requiredSkills)) {
        finalRequiredSkills = requiredSkills.map(skill => skill.trim()).filter(skill => skill !== ''); // Ensure cleanup even if already array
    } else if (typeof requiredSkills === 'string') {
        // Handle if it was accidentally sent as a string (though frontend processes it)
        finalRequiredSkills = requiredSkills.split(',')
                                         .map(skill => skill.trim())
                                         .filter(skill => skill !== '');
        console.warn("Received requiredSkills as string, converting to array:", finalRequiredSkills);
    } else {
        // If it's some other type, reject or default
        console.error("Received requiredSkills in unexpected format:", requiredSkills);
        // Option 1: Reject
         // return res.status(400).json({ success: false, message: "Required skills format is invalid." });
        // Option 2: Default to empty array (safer for create)
         finalRequiredSkills = [];
    }
    // --- End Validation ---

    try {
        console.log("Attempting to create job with data:", { // Log right before creation
             title, description, location, salary: parsedSalary, level, category,
             employmentType, workModel, requiredSkills: finalRequiredSkills, experienceYears: parsedExperienceYears, companyId
         });

        const newJob = await Job.create({
            title,
            description,
            location,
            salary: parsedSalary, // Use parsed number
            companyId,
            date: Date.now(),
            level,
            category,
            employmentType,
            workModel,
            requiredSkills: finalRequiredSkills, // Use processed array
            experienceYears: parsedExperienceYears, // Use parsed number
            // 'visible' defaults to true
        });

        console.log("Job created successfully:", newJob._id); // Log success

        // Populate company details for socket emission
        const jobToSend = await Job.findById(newJob._id).populate('companyId', 'name image isVerified');
        if (jobToSend) {
            io.emit('newJobPosted', jobToSend);
            console.log(`🚀 Emitted newJobPosted: ${jobToSend.title}`);
        } else {
            console.warn("Could not find newly created job to emit:", newJob._id); // Add warning if population fails
        }


        res.status(201).json({ success: true, message: "Job posted successfully!", job: jobToSend });

    } catch (error) {
        console.error("Error during Job.create:", error); // Log the specific error during creation
        if (error.name === 'ValidationError') {
            return res.status(400).json({ success: false, message: "Validation Error: " + error.message });
        }
        // Send back a more specific error message if possible
        res.status(500).json({ success: false, message: "Server error while creating job: " + error.message });
    }
};
// --- Get Company Job Applicants ---
export const getCompanyJobApplicants = async (req, res) => {
    // Ensure company is approved before showing applicants
    if (req.company?.status !== 'Approved') {
        return res.status(403).json({ success: false, message: "Account not approved to view applicants." });
    }
    try {
        const companyId = req.company._id;
        // Find job applications linked to this company
        // Populate user details (select only needed fields) and job details
        const applications = await JobApplication.find({ companyId })
            .populate('userId', 'name image email resume headline location skills experience education portfolioLink linkedinLink') // Select specific user fields
            .populate('jobId', 'title location') // Select specific job fields
            .sort({ date: -1 }) // Show newest applications first
            .exec();

        // It's okay if applications is an empty array, not an error
        return res.json({ success: true, applications });
    } catch (error) {
        console.error("Error fetching job applicants:", error);
        res.status(500).json({ success: false, message: "Failed to fetch applicants." });
    }
};

// --- Get Company Posted Jobs ---
export const getCompanyPostedJobs = async (req, res) => {
    // Ensure company is approved
    if (req.company?.status !== 'Approved') {
        return res.status(403).json({ success: false, message: "Account not approved to view jobs." });
    }
    try {
        const companyId = req.company._id;
        // Find jobs posted by this company
        const jobs = await Job.find({ companyId }).sort({ date: -1 }); // Sort by newest first

        // Add applicant count to each job
        // Using Promise.all is good for performance if applicant count logic is complex,
        // but can be simplified if counts are not strictly needed immediately or are large.
        // Consider a more optimized approach for large numbers of jobs/applicants later.
        const jobsData = await Promise.all(jobs.map(async (job) => {
            const applicantsCount = await JobApplication.countDocuments({ jobId: job._id });
            return { ...job.toObject(), applicants: applicantsCount }; // Use countDocuments
        }));

        res.json({ success: true, jobsData });
    } catch (error) {
        console.error("Error fetching company posted jobs:", error);
        res.status(500).json({ success: false, message: "Failed to fetch posted jobs." });
    }
};

// --- Change Job Application Status ---
export const ChangeJobApplicationsStatus = async (req, res) => {
    // Ensure company is approved
    if (req.company?.status !== 'Approved') {
        return res.status(403).json({ success: false, message: "Account not approved to change status." });
    }
    try {
        const { id, status } = req.body; // id is the JobApplication _id
        const companyId = req.company._id;

        if (!id || !status) {
            return res.status(400).json({ success: false, message: "Application ID and status are required." });
        }

        // Validate the status value
        const validStatuses = ['Pending', 'Viewed', 'Under Review', 'Shortlisted', 'Accepted', 'Rejected']; // Add more as needed
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: "Invalid status value provided." });
        }

        // Find the application and ensure it belongs to the logged-in company
        const updatedApplication = await JobApplication.findOneAndUpdate(
            { _id: id, companyId: companyId }, // Match both ID and companyId for security
            { status: status },
            { new: true } // Return the updated document
        );

        if (!updatedApplication) {
            return res.status(404).json({ success: false, message: 'Application not found or you do not have permission to modify it.' });
        }

        // Optional: Notify the user about the status change via email or notification system

        res.json({ success: true, message: 'Application status updated successfully.' });

    } catch (error) {
        console.error("Error changing application status:", error);
        res.status(500).json({ success: false, message: "Failed to change status." });
    }
};

// --- Change Job Visibility ---
export const changeVisiblity = async (req, res) => {
    // Ensure company is approved
    if (req.company?.status !== 'Approved') {
        return res.status(403).json({ success: false, message: "Account not approved to change job visibility." });
    }
    try {
        const { id } = req.body; // id is the Job _id
        const companyId = req.company._id;

        if (!id) {
            return res.status(400).json({ success: false, message: "Job ID is required." });
        }

        // Find the job and ensure it belongs to the logged-in company
        const job = await Job.findOne({ _id: id, companyId: companyId });

        if (!job) {
            return res.status(404).json({ success: false, message: 'Job not found or you do not have permission to modify it.' });
        }

        // Toggle visibility
        job.visible = !job.visible;
        await job.save();

        res.json({ success: true, message: `Job visibility set to ${job.visible}.`, job });

    } catch (error) {
        console.error("Error changing job visibility:", error);
        res.status(500).json({ success: false, message: "Failed to change visibility." });
    }
}; 
export const scheduleInterview = async (req, res) => {
    // Ensure company is approved
    if (req.company?.status !== 'Approved') {
        return res.status(403).json({ success: false, message: "Account not approved." });
    }
    try {
        const { applicationId } = req.params;
        const { numRounds, roundTypes, firstRoundDateTime } = req.body;
        const companyId = req.company._id;

        // Basic validation
        if (!numRounds || !firstRoundDateTime) {
            return res.status(400).json({ success: false, message: "Number of rounds and first interview date/time are required." });
        }

        let parsedDate;
        try {
            parsedDate = new Date(firstRoundDateTime);
            if (isNaN(parsedDate)) throw new Error("Invalid Date");
        } catch (dateError) {
             return res.status(400).json({ success: false, message: "Invalid date/time format provided." });
        }


        // Find the application, ensure it belongs to the company, and populate necessary details
        const application = await JobApplication.findOne({ _id: applicationId, companyId: companyId })
            .populate('userId', 'name email') // Get user name and email
            .populate('jobId', 'title');     // Get job title

        if (!application) {
            return res.status(404).json({ success: false, message: 'Application not found or access denied.' });
        }

        // Optional: Warn if already processed, but allow update
        if (application.status !== 'Pending') {
           console.warn(`Application ${applicationId} status is already ${application.status}. Proceeding with interview schedule update.`);
        }

        // Update application details
        application.status = 'Interview Scheduled'; // Set status
        application.interviewRoundsPlanned = numRounds;
        application.interviewRoundTypes = roundTypes || ''; // Handle empty string
        application.firstInterviewDateTime = parsedDate;

        await application.save();

        // --- Send Email to Candidate ---
        if (application.userId && application.userId.email) {
            const candidateName = application.userId.name;
            const jobTitle = application.jobId.title;
            const companyName = req.company.name; // Get company name from authenticated request

             // Format date/time nicely (Set your desired timezone)
            const formattedDateTime = moment(parsedDate).tz('Asia/Kolkata').format('MMMM Do YYYY, h:mm a z'); // Example: October 30th 2025, 2:30 PM IST

            const subject = `Interview Invitation: ${jobTitle} at ${companyName}`;
            const textBody = `Hello ${candidateName},\n\nCongratulations! We were impressed with your application for the ${jobTitle} position at ${companyName} and would like to invite you for the first round of interviews.\n\nYour first interview is scheduled for:\nDate & Time: ${formattedDateTime}\n\n[Optional: Add details here about the interview format, duration, video call link, or location.]\n\nPlanned Interview Stages:\n${roundTypes || 'Details to follow.'}\n\nTotal Rounds Expected: ${numRounds}\n\nPlease confirm your availability or let us know if you need to reschedule by replying to this email or contacting [Your Contact Person/Email].\n\nWe look forward to speaking with you!\n\nBest regards,\nThe Hiring Team at ${companyName}`;
            // Optional: Create an HTML version (htmlBody)

            sendEmail(application.userId.email, subject, textBody /*, htmlBody */)
              .then(emailResult => {
                 if (!emailResult.success) {
                    console.error(`Failed to send interview email to ${application.userId.email}: ${emailResult.error}`);
                 } else {
                     console.log(`Interview email sent successfully to ${application.userId.email}`);
                 }
              });
        } else {
             console.error(`Could not send email: User details not found for application ${applicationId}`);
        }
        // --- End Email Sending ---

        res.json({ success: true, message: 'Interview scheduled and candidate notified.' });

    } catch (error) {
        console.error("Error scheduling interview:", error);
        res.status(500).json({ success: false, message: "Server error while scheduling interview." });
    }
};
export const generateJobDescription = async (req, res) => {
    // Ensure company is approved
    if (req.company?.status !== 'Approved') {
        return res.status(403).json({ success: false, message: "Account not approved." });
    }

    const { title, skills } = req.body;

    if (!title) {
        return res.status(400).json({ success: false, message: "Job title is required." });
    }

    try {
        const skillsList = Array.isArray(skills) ? skills.join(', ') : 'any relevant skills';
        
        // Create a detailed prompt for the AI
        const prompt = `
            Act as an expert technical recruiter.
            Write a professional and engaging job description for a "${title}" position.
            The description must be formatted in HTML for a rich-text editor.
            
            The ideal candidate must have experience with the following skills: ${skillsList}.

            The description should include the following sections:
            1.  **Job Summary:** A brief, engaging overview of the role.
            2.  **Key Responsibilities:** A bulleted list of 3-5 core duties.
            3.  **Required Qualifications:** A bulleted list that includes the skills provided (${skillsList}) and any other typical requirements for this role.
            4.  **Preferred Qualifications:** (Optional) A short bulleted list of "nice-to-have" skills.
            5.  **Why Join Us?:** A brief paragraph about company culture (you can invent a generic positive one).

            Return *only* the HTML content for the description. Do not include any text before or after the HTML.
        `;
        const aiModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const result = await aiModel.generateContent(prompt);
        const response = await result.response;
        const generatedText = response.text();
        
        // Send the AI-generated HTML back to the frontend
        res.json({ success: true, description: generatedText });

    } catch (error) {
        console.error("Error generating job description:", error);
        res.status(500).json({ success: false, message: "Failed to generate description due to server error." });
    }
};