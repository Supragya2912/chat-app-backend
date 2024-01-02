const router = require("express").Router();

const authController = require("../controllers/auth");
const userController = require("../controllers/user");


router.post("/update-me",authController.protect, userController.updateUser);
router.post("/get-users", authController.protect, userController.getUser);

module.exports = router;