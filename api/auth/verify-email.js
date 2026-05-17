const { consumeAuthToken, getUserById, saveUser, sendError, sendJson } = require("../_store");

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return sendJson(res, 405, { error: "Method not allowed." });
    }

    const record = await consumeAuthToken(req.body?.token, "verify-email");
    if (!record) return sendJson(res, 400, { error: "Verification link is invalid or expired." });
    const user = await getUserById(record.userId);
    if (!user) return sendJson(res, 404, { error: "User not found." });

    user.emailVerified = true;
    return sendJson(res, 200, { user: await saveUser(user) });
  } catch (error) {
    return sendError(res, error);
  }
};
