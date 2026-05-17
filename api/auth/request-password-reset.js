const {
  clean,
  createAuthToken,
  getBaseUrl,
  getUserByEmail,
  sendEmail,
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

    validateRequired(req.body?.email, "Email");
    const user = await getUserByEmail(clean(req.body.email, 180).toLowerCase());
    if (!user) return sendJson(res, 200, { ok: true });

    const token = await createAuthToken(user, "password-reset");
    const resetUrl = `${getBaseUrl(req)}/reset-password?token=${encodeURIComponent(token)}`;
    const emailSent = await sendEmail({
      to: user.email,
      subject: "Reset your BookTrail password",
      html: `<p>Reset your BookTrail password here:</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
    });

    return sendJson(res, 200, { ok: true, emailSent, resetUrl: emailSent ? undefined : resetUrl });
  } catch (error) {
    return sendError(res, error);
  }
};
