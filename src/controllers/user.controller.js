import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from '../models/user.model.js';
import { uploadOnCloudinary } from "../utils/fileUpload.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { generateAccessAndRefreshTokens } from "../utils/tokenHandler.js";
import jwt from 'jsonwebtoken';

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

const loginUser = asyncHandler(async (req, res) => {
    // fetch data from body - email/user & password;
    let { email, username, password } = req.body;
    if(!email)
        email = "";

    if(!username)
        username = "";

    if(!username && !email) {
        throw new ApiError(400, "username or email is required!");
    }

    // check if a user with the said email or username exists;
    // throw error if it doesn't: user with the said email/username doesn't exist;
    let user = await User.findOne({
        $or: [
            {email},
            {username}
        ]
    }).select("_id password email username");

    if(!user)
        throw new ApiError(404, "User with email/username doesn't exist!");

    // if it does, check if the password that has been entered is correct
    // throw error, if it doesn't: email/passord is incorrect;
    let isPasswordValid = await user.isPasswordCorrect(password);

    if(!isPasswordValid)
        throw new ApiError(401, "Invalid user credentials!");

    // generate access and refresh token and send them to user
    // send cookies & login success response
    let { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user?._id);
    let loggedInUser = await User.findById(user?._id).select("-password -refreshToken");

    const cookieOptions = {
        httpOnly: true,
        secure: true
    };

    return res
            .status(200)
            .cookie("accessToken", accessToken, cookieOptions)
            .cookie("refreshToken", refreshToken, cookieOptions)
            .json(
                new ApiResponse(
                    200,
                    {
                        user: loggedInUser, accessToken, refreshToken
                    },
                    "User logged In Successfully."
                )
            )
});

const logoutUser = asyncHandler(async (req, res) => {
    let user = req?.user;

    // updating and nullyfying the refresh token;
    await User.findByIdAndUpdate(
        user?._id,
        {
            $set: {
                refreshToken: null
            }
        },
        {
            new: true // gives the new and updated value;
        }
    );

    let cookieOptions = {
        httpOnly: true,
        secure: true
    }

    return res
        .status(200)
        .clearCookie("accessToken", cookieOptions)
        .clearCookie("refreshToken", cookieOptions)
        .json(
            new ApiResponse(
                200,
                {},
                "User logged Out Successfully."
            )
        );
});

const refreshAccessToken = asyncHandler(async (req, res) => {
    let incomingRefreshToken = req.body.refreshToken || req.cookies.refreshToken;

    if(!incomingRefreshToken) 
        throw new ApiError(401, "Unauthorized request!");

    try {
        let decodedRefreshToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);
        let user = await User.findById(decodedRefreshToken?._id).select("-password");
        if(!user) 
            throw new Error(401, "Invalid refresh token!");
    
        if(incomingRefreshToken !== user?.refreshToken)
            throw new ApiError(401, "Refresh token has expired or used!");
    
        let { accessToken, refreshToken } = generateAccessAndRefreshTokens(user?._id);
    
        let cookieOptions = {
            httpOnly: true,
            secure: true
        };
    
        return res
            .status(200)
            .cookie("accessToken", accessToken, cookieOptions)
            .cookie("refreshToken", refreshToken, cookieOptions)
            .json(
                new ApiResponse(
                    200,
                    {
                        accessToken, refreshToken
                    },
                    "Access token refreshed successfully"
                )
            )
    } catch (error) {
        throw new ApiError(
            401,
            error?.message || "Invalid refresh token!"
        )
    }

});

const changeCurrentPassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;

    const user = await User.findById(req.user?._id);
    const isPasswordValid = await user.isPasswordCorrect(oldPassword);
    if(!isPasswordValid)
        throw new ApiError(400, "Invalid old password!");

    user.password = newPassword;
    await user.save({ validateBeforeSave: false });

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                {},
                "Password changed successfully."
            )
        )

});

const getCurrentUser = asyncHandler(async (req, res) => {
    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                req.user,
                "Current user fetched successfully."
            )
        )
});

const updateAccountDetails = asyncHandler(async (req, res) => {
    const {
        fullName,
        email,
    } = req.body;

    if(!fullName || !email) {
        throw new ApiError(400, "All Fields are required!");
    }

    const user =  await User.findByIdAndUpdate(req.user?.id, {
        $set: {
            fullName,
            email
        }
    }, {new: true}).select("-password -refreshToken");

    return res  
        .status(200)
        .json(
            new ApiResponse(
                200,
                user,
                "Account details updated successfully."
            )
        )
});

const updateUserAvatar = asyncHandler(async (req, res) => {
    let avatarLocalPath = req.file?.avatar?.[0]?.path || null;
    if(!avatarLocalPath)
        throw new ApiError(400, "No avatar image found!");

    let avatar = await uploadOnCloudinary(avatarLocalPath);
    if(!avatar?.url)
        throw new ApiError(400, "Error while uploading the avatar!");

    await User.findByIdAndUpdate(req.user?._id, {
        $set: {
            avatar: avatar?.url
        }
    });

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                {},
                "Avatar updated successfully"
            )
        )
});

const updateUserCoverImage = asyncHandler(async (req, res) => {
    let coverImageLocalPath = req.file?.coverImage?.[0]?.path || null;
    if(!coverImageLocalPath)
        throw new ApiError(400, "No cover image found!");

    let coverImage = await uploadOnCloudinary(coverImageLocalPath);
    if(!coverImage?.url)
        throw new ApiError(400, "Error while uploading the cover image!");

    await User.findByIdAndUpdate(req.user?._id, {
        $set: {
            coverImage: coverImage?.url
        }
    });

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                {},
                "Cover Image updated successfully"
            )
        )
});

const getUserChannelProfile = asyncHandler(async (req, res) => {
    const { username } = req.params;

    if(!username?.trim())
        throw new ApiError(
            400,
            "Username is required!"
        )

    let channel = await User.aggregate([
        {
            $match: {
                username: username?.toLowerCase()
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields: {
                subscribersCount: {
                    $size: "$subscribers"
                },
                channelsSubscribedToCount: {
                    $size: "$subscribedTo"
                },
                isSubscribed: {
                    $cond: {
                        if: {$in: [req.user?._id, "$subscribers.subscriber"]},
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                fullName: 1,
                username: 1,
                email: 1,
                subscribersCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
            }
        }
    ]);

    if(!channel?.length)
        throw new ApiError(
                404,
                "Channel does not exist!"
            );

    return res
            .status(200)
            .json(
                new ApiResponse(
                    200,
                    channel?.[0],
                    "User channel fetched successfully!"
                )
            );
});

export { 
    registerUser, 
    loginUser, 
    logoutUser, 
    refreshAccessToken, 
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile     
};