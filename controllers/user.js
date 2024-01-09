const User = require("../models/user");
const FriendRequest = require("../models/friendRequest");


exports.updateUser = async (req, res, next) => {

    const {user} = req;
    const filteredBody = filterObj(req.body, "firstName", "lastName", "about", "avatar");
    const updated_user = await User.findByIdAndUpdate(user._id, filteredBody, { new: true, validateModifiedOnly: true });

    res.status(200).json({
        status:"success",
        data: updated_user,
        message: "User updated successfully"
    })
}

exports.getUser = async (req, res, next) => {

    const all_user = await User.find({
        verified: true,
    }).select("firstName", "lastName", "_id");

    const this_user = req.user;

    const remaining_user = all_user.filter((user) => 
    !this_user.friends.includes(user._id) &&
    user._id.toString() !== req.user._id.toString()
    );

    res.status(200).json({
        status:"success",
        data: remaining_user,
        message: "User fetched successfully"
    })
    
}

exports.getFreindRequest = async (req, res, next) => {

    const requests = FriendRequest.find({recepient: req.user._id}).populate("sender","_id firstName lastName")
    res.status(200).json({
        status:"success",
        data: requests,
        message: "Friends request  fetched successfully"
    })
}

exports.getFriends = async (req, res, next) => {

    const friends = await User.findById(req.user._id).populate("friends","_id firstName lastName");
    res.status(200).json({
        status:"success",
        data: friends,
        message: "Friends fetched successfully"
    })
    
}