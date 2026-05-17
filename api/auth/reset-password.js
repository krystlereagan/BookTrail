const {
  consumeAuthToken,
  getUserById,
  hashPassword,
  saveUser,
  sendError,
  sendJson,
  validateRequired,
} = require("../_store");

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return sendJson(res, 405, { error: "Method not allowed." });
    }

    validateRequired(req.body?.token, "Reset token");
    validateRequired(req.body?.password, "Password");
    if (String(req.body.password).length < 8) return sendJson(res, 400, { error: "Password must be at least 8 characters." });

    const record = await consumeAuthToken(req.body.token, "password-reset");
    if (!record) return sendJson(res, 400, { error: "Reset link is invalid or expired." });
    const user = await getUserById(record.userId);
    if (!user) return sendJson(res, 404, { error: "User not found." });

    user.passwordHash = hashPassword(req.body.password);
    await saveUser(user);
    return sendJson(res, 200, { ok: true });
  } catch (error) {
    return sendError(res, error);
  }
};
