import {v2 as cloudinary} from 'cloudinary';
import fs from 'fs';
          
cloudinary.config({ 
  cloud_name: 'djfn3o7ms', 
  api_key: '125386579943317', 
  api_secret: 'IGCJ_Wkyrp38ErfsLFa4EQ9wDWo' 
});

const uploadOnCloudinary = async (localFilePath) => {
    try {
        if(!localFilePath) return null; 
        // upload the file on cloudinary;
        const uploadResponse = await cloudinary.uploader.upload(localFilePath, {
            resource_type: 'auto'
        })

        fs.unlinkSync(localFilePath);
        return uploadResponse;
    } catch(error) {
        console.log("Unlinking file:::", error)
        fs.unlinkSync(localFilePath); // remove the locally saved temporary file;
    }
}

export { uploadOnCloudinary };