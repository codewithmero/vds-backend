import { User } from "../models/user.model.js"

export const generateAccessAndRefreshTokens = async (userId) => {
    try {

        const user =  await User.findById(userId)
        let accessToken = user.generateAccessToken();
        let refreshToken = user.generateRefreshToken();

        // setting the refresh token in user record;
        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });

        return { accessToken, refreshToken };
    } catch(error) {
        throw new ApiError(500, "Something went wrong while generating refresh and access tokens!")
    }
}