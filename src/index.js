import dotenv from 'dotenv';
import connectDB from './db/index.js';
import { app } from './app.js';

dotenv.config({ config: './.env' });
connectDB()
    .then(() => {
        app.listen(process.env.PORT || 8000, () => {
            console.log(`Server listening on http://localhost/${process.env.PORT || 8000}`)
        })
    })
    .catch(err => console.log("MONGODB CONNECTION FAILED!!!", err));