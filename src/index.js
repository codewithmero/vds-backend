import dotenv from 'dotenv';
import mongoose from 'mongoose';
import express from 'express';
import connectDB from './db/index.js';

dotenv.config({ config: './env' });

connectDB();




/* 
;( async () => {
    try {
        await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);
        app.on("error", (error) => {
            console.log("Application not able to talk to the database:::", error);
            throw error;
        });

        app.listen(process.env.PORT, () => {
            console.log(`Server listening on http://localhost:${process.env.PORT}`);
        });
    } catch(error) {
        console.error("Error (while connecting with database):::", error);
    }   
})();
*/