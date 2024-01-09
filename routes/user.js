const router = require("express").Router();

const authController = require("../controllers/auth");
const userController = require("../controllers/user");


router.post("/update-me",authController.protect, userController.updateUser);
router.post("/get-users", authController.protect, userController.getUser);
router.post("/get-friends", authController.protect, userController.getFriends);
router.post("/get-friendRequest", authController.protect, userController.getFreindRequest);

module.exports = router;