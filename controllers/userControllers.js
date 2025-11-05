// controllers/userControllers.js

// --- ALL IMPORTS AT THE TOP (ONCE EACH) ---
import User from "../models/User.js";
import JobApplication from "../models/JobApplication.js";
import { v2 as cloudinary } from "cloudinary";
import Job from "../models/Job.js";
import bcrypt from "bcrypt";
import generateToken from "../utils/generateToken.js";
// --- END IMPORTS ---


// --- CONTROLLER FUNCTIONS ---

// Register a new user
export const registerUser = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // Validate input
        if (!name || !email || !password) {
            return res.status(400).json({ success: false, message: 'All fields are required' });
        }

        // Check if user already exists
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ success: false, message: 'User already exists with this email' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create user
        const user = await User.create({
            name,
            email,
            password: hashedPassword,
            image: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`
        });

        // Generate token
        const token = generateToken(user._id);

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            token,
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                image: user.image
            }
        });
    } catch (error) {
        console.error("Error in registerUser:", error);
        res.status(500).json({ success: false, message: "Server error during registration." });
    }
};

// Login user
export const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email and password are required' });
        }

        // Check if user exists
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid email or password' });
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ success: false, message: 'Invalid email or password' });
        }

        // Generate token
        const token = generateToken(user._id);

        res.json({
            success: true,
            message: 'Login successful',
            token,
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                image: user.image
            }
        });
    } catch (error) {
        console.error("Error in loginUser:", error);
        res.status(500).json({ success: false, message: "Server error during login." });
    }
};

// Get user data for the logged-in user
export const getUserData = async (req, res) => {
    try {
        // Get userId from req.auth populated by authentication middleware
        const userId = req.auth.userId; 
        if (!userId) {
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }
        console.log('User Id from authenticated user:', userId);
        
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found in database' });
        }
        res.json({ success: true, user });
    } catch (error) {
        console.error("Error in getUserData:", error);
        res.status(500).json({ success: false, message: "Server error fetching user data." });
    }
};

// Apply for a job
export const applyForJob = async (req, res) => {
    try {
        const { jobId } = req.body;
        const userId = req.auth.userId; // Get userId from authenticated request
        
        if (!userId) {
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }
        if (!jobId) {
             return res.status(400).json({ success: false, message: 'Job ID is required' });
        }

        // Check if job exists and is visible
        const jobData = await Job.findOne({ _id: jobId, visible: true });
        if (!jobData) {
            return res.status(404).json({ success: false, message: 'Job not found or is no longer available' });
        }

        // Check if already applied
        const isAlreadyApplied = await JobApplication.findOne({ jobId, userId });
        if (isAlreadyApplied) {
            return res.status(400).json({ success: false, message: 'You have already applied for this job' });
        }

        // Create the application
        await JobApplication.create({
            companyId: jobData.companyId,
            userId,
            jobId,
            date: Date.now()
        });
        res.status(201).json({ success: true, message: 'Applied Successfully' }); // Use 201 for creation
    } catch (error) {
        console.error("Error in applyForJob:", error);
        res.status(500).json({ success: false, message: "Server error applying for job." });
    }
};

// Get user applied applications
export const getUserJobApplication = async (req, res) => {
    try { 
        const userId = req.auth.userId;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }
        
        // Find applications and populate related data
        const applications = await JobApplication.find({ userId })
            .populate('companyId', 'name image') // Populate specific company fields
            .populate('jobId', 'title location') // Populate specific job fields
            .sort({ date: -1 }) // Sort by newest first
            .exec();
            
        // No need to check !applications, an empty array is valid
        res.json({ success: true, applications });
    } catch (error) {
        console.error("Error in getUserJobApplication:", error);
        res.status(500).json({ success: false, message: "Server error fetching applications." });
    }
};

// Update user profile (resume)


export const updateUserResume = async (req, res) => {
    try {
        const userId = req.auth.userId
        const resumeFile = req.file
       
        const userData = await User.findById(userId)
        if (resumeFile) {
            const resumeUpload = await cloudinary.uploader.upload(resumeFile.path)
            console.log(resumeUpload.secure_url)
            userData.resume = resumeUpload.secure_url
        }
        await userData.save()
        return res.json({ success: true, message: 'Resume Updated' })
    }
    catch (error) {
        res.json({ success: false, message: error.message })
    }
}
// Toggle saving/unsaving a job
export const toggleSaveJob = async (req, res) => {
    try {
        const { jobId } = req.body;
        const userId = req.auth.userId;

        if (!userId) {
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }
        if (!jobId) {
            return res.status(400).json({ success: false, message: 'Job ID is required' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        
        // Ensure job exists (optional but good practice)
        const jobExists = await Job.findById(jobId);
        if (!jobExists) {
             return res.status(404).json({ success: false, message: 'Job not found' });
        }

        const jobIndex = user.savedJobs.indexOf(jobId);

        if (jobIndex > -1) {
            // Unsave
            user.savedJobs.pull(jobId);
            await user.save();
            res.json({ success: true, message: 'Job removed from saved list' });
        } else {
            // Save
            user.savedJobs.push(jobId);
            await user.save();
            res.json({ success: true, message: 'Job saved successfully!' });
        }

    } catch (error) {
        console.error("Error in toggleSaveJob:", error);
        res.status(500).json({ success: false, message: "Server error saving/unsaving job." });
    }
};

// Get user's saved jobs
export const getSavedJobs = async (req, res) => {
    try {
        const userId = req.auth.userId;
         if (!userId) {
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }

        // Find user and populate saved jobs with company details
        const user = await User.findById(userId).populate({
            path: 'savedJobs',
            match: { visible: true }, // Only populate jobs that are still visible
            populate: {
                path: 'companyId',
                select: 'name image' // Select specific company fields
            }
        });

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Filter out any null entries from savedJobs if a job was deleted/became invisible
        const validSavedJobs = user.savedJobs.filter(job => job !== null);

        res.json({ success: true, savedJobs: validSavedJobs.reverse() }); // Newest first

    } catch (error) {
        console.error("Error in getSavedJobs:", error);
        res.status(500).json({ success: false, message: "Server error fetching saved jobs." });
    }
};

// Update user profile details (headline, location, skills, etc.)
export const updateUserProfile = async (req, res) => {
    try {
        const userId = req.auth.userId;
        const { headline, location, skills, experience, education, portfolioLink, linkedinLink } = req.body;

         if (!userId) {
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // Update fields using nullish coalescing to preserve existing data if not provided
        user.headline = headline ?? user.headline;
        user.location = location ?? user.location;
        user.skills = skills ?? user.skills;
        user.experience = experience ?? user.experience;
        user.education = education ?? user.education;
        user.portfolioLink = portfolioLink ?? user.portfolioLink;
        user.linkedinLink = linkedinLink ?? user.linkedinLink;

        await user.save();

        // Send back updated user data
        res.json({ success: true, message: "Profile updated successfully!", user });

    } catch (error) {
        console.error("Error updating user profile:", error);
        res.status(500).json({ success: false, message: "Server error updating profile." });
    }
};

// Get profile completion progress
export const getProfileProgress = async (req, res) => {
    try {
        const userId = req.auth.userId;
        const user = await User.findById(userId);
        
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: "User not found" 
            });
        }

        // Update completion status
        user.updateProfileCompletion();
        await user.save();

        // Get missing sections
        const missingSections = Object.entries(user.profileCompletion)
            .filter(([_, isComplete]) => !isComplete)
            .map(([section]) => {
                // Convert to user-friendly messages
                const messages = {
                    basics: "Complete your basic information",
                    resume: "Upload your resume",
                    image: "Add a profile picture",
                    headline: "Add a professional headline",
                    location: "Add your location",
                    skills: "Add your skills",
                    experience: "Add work experience",
                    education: "Add education details",
                    links: "Add portfolio or LinkedIn links"
                };
                return messages[section];
            });

        res.json({
            success: true,
            progress: {
                percentage: user.calculateProfileCompletion(),
                completed: Object.entries(user.profileCompletion)
                    .filter(([_, isComplete]) => isComplete)
                    .map(([section]) => section),
                missingSections,
                badges: user.badges,
                nextMilestone: missingSections[0] || "Profile is complete! 🎉"
            }
        });
    } catch (error) {
        console.error("Error in getProfileProgress:", error);
        res.status(500).json({ 
            success: false, 
            message: "Server error getting profile progress" 
        });
    }
};

// Get public profile data for a user
export const getPublicUserProfile = async (req, res) => {
    try {
        const userId = req.params.id; // Get user ID from URL

        // Find user and select only public fields
        const user = await User.findById(userId)
            .select('name image email resume headline location skills experience education portfolioLink linkedinLink'); 

        if (!user) {
            return res.status(404).json({ success: false, message: "User profile not found." });
        }
        
        res.json({ success: true, user });

    } catch (error) {
        console.error("Error fetching public user profile:", error);
        if (error.kind === 'ObjectId') {
             return res.status(400).json({ success: false, message: "Invalid user ID format." });
        }
        res.status(500).json({ success: false, message: "Server Error fetching profile." });
    }
};

// --- END CONTROLLER FUNCTIONS ---