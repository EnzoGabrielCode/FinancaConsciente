class AuthController {
  constructor({ registerUser, authenticateUser }) {
    this.registerUser = registerUser;
    this.authenticateUser = authenticateUser;
  }

  register = async (req, res) => {
    const user = await this.registerUser.execute(req.body);
    res.status(201).json({ user });
  };

  login = async (req, res) => {
    const result = await this.authenticateUser.execute(req.body);
    res.status(200).json(result);
  };
}

module.exports = { AuthController };
