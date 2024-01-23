import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from '../models/user.model.js';
import { uploadOnCloudinary } from "../utils/fileUpload.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const registerUser = asyncHandler(async (req, res) => {
    // get user details from frontend;
    const {
        email,
        username,
        fullName,
        password
    } = req.body;

    // validation, before saving data to the DB (non-empty);
    let errors = [];
    Object.keys({email, username, fullName, password})?.forEach(item => {
        if(!req?.body?.[item]) {
            errors.push(`${item?.toLowerCase()} cannot be empty`);
        }
    });

    if(errors?.length > 0) {
        throw new ApiError(401, "Data fields cannot be empty!", errors)
    }

    // check if user already exists: username/email;
    let existedUser = await User.findOne({
        $or:[
            {
                username
            },
            {
                email
            }
        ]
    });

    if(existedUser) {
        throw new ApiError(409, "User with email/username already exists!")
    }

    // check if the files are present or not (avatar);
    const avatarLocalPath = req.files?.avatar?.[0]?.path;
    const coverImageLocalPath = req.files?.coverImage?.[0]?.path;

    // upload them to cloudinary;
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    // Check if avatar exists - throw error, if it doesn't;
    if(!avatar) {
        throw new ApiError(400, "Avatar file is required!");
    }

    // create entry in DB;
    // remove password and refresh token field, from response;
    // check for user creation - if created, return response, else send error;
    let user = await User.create({
        fullName,
        avatar: avatar?.url,
        coverImage: coverImage?.url || null,
        email: email?.toLowerCase(),
        username: username.toLowerCase() ,
        password,
    });

    let createdUser = await User.findById(user?._id).select(
        "-password -refreshToken"
    );

    if(!createdUser)
        throw new ApiError(500, "Something went wrong while registering the user!");

    res.status(201).json(
        new ApiResponse(200, createdUser, "User registered successfully.")
    );
});

export { registerUser };