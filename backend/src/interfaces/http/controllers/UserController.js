class UserController {
  constructor({ getCurrentUser }) {
    this.getCurrentUser = getCurrentUser;
  }

  me = async (req, res) => {
    const user = await this.getCurrentUser.execute({ userId: req.auth.userId });
    res.status(200).json({ user });
  };
}

module.exports = { UserController };
