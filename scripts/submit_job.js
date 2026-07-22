const catalyst = require('zcatalyst-sdk-node');

async function triggerCreateTablesJob(req) {
    // 1. Initialize Catalyst with the provided OAuth credentials
    const app = catalyst.initialize({
        type: 'basic',
        project_id: '53405000000013048', // Argus project ID
        client_id: '1000.8J1LGFK3U0I77EK6UX8M83IPHS5EIF',
        client_secret: '2a84be2ad318302a877ca4f446d22522838818264e'
    }); 
    
    // 2. Create job scheduling instance
    const jobScheduling = app.jobScheduling(); 
    
    try {
        console.log("Submitting create_tables_job...");
        
        // 3. Create function job
        const functionJob = await jobScheduling.JOB.submitJob({
            job_name: 'init_datastore_tables', // A unique name for this execution
            target_type: 'Function', // Target type is Function
            target_name: 'create_tables_job', // The name of our deployment folder
            
            // Note: By default, Catalyst creates a 'Default' job pool for you.
            // If you created a specific pool in the console, replace this:
            jobpool_name: 'Default', 
            
            params: {
                action: 'create_all',
            }, // Optional parameters to pass to the job
            
            job_config: {
                number_of_retries: 0, // No retries needed for table creation
            } 
        });

        console.log("Job submitted successfully!", functionJob);
        return functionJob;

    } catch (error) {
        console.error("Error submitting job:", error);
        throw error;
    }
}

module.exports = { triggerCreateTablesJob };

// If run directly via node, execute it
if (require.main === module) {
    triggerCreateTablesJob().catch(console.error);
}
