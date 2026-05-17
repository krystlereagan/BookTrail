const {
  createAuthToken,
  getBaseUrl,
  getUserById,
  requireUser,
  sendEmail,
  sendError,
  sendJson,
} = require("../_store");

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return sendJson(res, 405, { error: "Method not allowed." });
    }

    const sessionUser = await requireUser(req);
    const user = await getUserById(sessionUser.id);
    if (user.emailVerified) return sendJson(res, 200, { ok: true, alreadyVerified: true });

    const token = await createAuthToken(user, "verify-email");
    const verificationUrl = `${getBaseUrl(req)}/verify-email?token=${encodeURIComponent(token)}`;
    const emailSent = await sendEmail({
      to: user.email,
      subject: "Verify your BookTrail email",
      html: `<p>Verify your BookTrail email here:</p><p><a href="${verificationUrl}">${verificationUrl}</a></p>`,
    });

    return sendJson(res, 200, { ok: true, emailSent, verificationUrl: emailSent ? undefined : verificationUrl });
  } catch (error) {
    return sendError(res, error);
  }
};
