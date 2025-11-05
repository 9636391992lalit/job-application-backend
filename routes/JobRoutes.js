import express from 'express'
import {getJobs,getJobById} from '../controllers/JobController.js'
const router= express.Router()

// Routes to get all joob data 
router.get('/',getJobs)


// Route to get single job by Id
router.get('/:id',getJobById)



export default router;