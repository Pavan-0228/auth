import { User } from "../models/user.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const generateAccessTokenAndRefreshToken = async (userId) => {
    try {
        const user = await User.findById(userId);

        // Generate access token and refresh token
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        // Save the refresh token in the database
        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });

        return { accessToken, refreshToken };
    } catch (error) {
        throw new Error(
            500,
            "Something went wrong while generating referesh and access token"
        );
    }
};

const registerUser = asyncHandler(async (req, res) => {
    const { fullName, email, password, username } = req.body;

    // Check if all fields are provided
    if (
        !fullName?.trim() ||
        !email?.trim() ||
        !password?.trim() ||
        !username?.trim()
    ) {
        res.status(400);
        throw new Error("All fields are required");
    }

    // Check if user already exists
    const userExists = await User.findOne({ $or: [{ email }, { username }] });

    if (userExists) {
        res.status(400);
        throw new Error("User already exists");
    }

    // Create the new user
    const user = await User.create({ fullName, email, password, username });

    if (!user) {
        res.status(400);
        throw new Error("Invalid user data");
    }

    // Remove sensitive fields before sending response
    const userData = user.toObject();
    delete userData.password;
    delete userData.refreshToken;

    res.status(201).json({
        message: "User registered successfully",
        user: userData,
    });
});

const loginUser = asyncHandler(async (req, res) => {
    const { email, username, password } = req.body;

    // Check if all fields are provided
    if ((!email && !username) || !password) {
        res.status(400);
        throw new Error("All fields are required");
    }

    // Find user by email or username
    let user;
    if (email) {
        user = await User.findOne({ email });
        if (!user) {
            res.status(404);
            throw new Error("Email not found");
        }
    } else if (username) {
        user = await User.findOne({ username });
        if (!user) {
            res.status(404);
            throw new Error("Username not found");
        }
    }

    // Check if password is correct
    const isPasswordCorrect = await user.checkPassword(password);

    if (!isPasswordCorrect) {
        res.status(401);
        throw new Error("Invalid credentials");
    }

    // Generate access token and refresh token
    const { accessToken, refreshToken } =
        await generateAccessTokenAndRefreshToken(user._id);

    // Remove sensitive fields before sending response
    const userData = user.toObject();
    delete userData.password;
    delete userData.refreshToken;

    const options = {
        httpOnly: true,
        secure: true,
    };

    return res
        .status(200)
        .cookie("refreshToken", refreshToken, options)
        .cookie("accessToken", accessToken, options)
        .json({
            message: "User logged in successfully",
            user: userData,
            accessToken,
        });
});


const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req?.user?._id,
        {
            $unset: {
                refreshToken: 1,
            },
        },
        {
            new: true,
        }
    );

    const options = {
        httpOnly: true,
        secure: true,
    };

    return res
        .status(200)
        .clearCookie("refreshToken", options)
        .clearCookie("accessToken", options)
        .json({
            message: "User logged out successfully",
        });
});

export { registerUser, loginUser, logoutUser };
