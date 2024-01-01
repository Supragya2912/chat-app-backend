const router = require("express").Router();

const authController = require("../controllers/auth");
const userController = require("../controllers/user");


router.post("/update-me",authController.protect, userController.updateUser);

module.exports = router;