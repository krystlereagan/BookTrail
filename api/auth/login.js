const {
  clean,
  createSession,
  getUserByEmail,
  sendError,
  sendJson,
  setSessionCookie,
  sanitizeUser,
  validateRequired,
  verifyPassword,
} = require("../_store");

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return sendJson(res, 405, { error: "Method not allowed." });
    }

    const input = req.body || {};
    validateRequired(input.email, "Email");
    validateRequired(input.password, "Password");
    const user = await getUserByEmail(clean(input.email, 180).toLowerCase());
    if (!user || !verifyPassword(input.password, user.passwordHash)) {
      return sendJson(res, 401, { error: "Email or password is incorrect." });
    }

    setSessionCookie(res, await createSession(user));
    return sendJson(res, 200, { user: sanitizeUser(user) });
  } catch (error) {
    return sendError(res, error);
  }
};
