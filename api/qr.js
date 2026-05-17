const QRCode = require("qrcode");

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      res.statusCode = 405;
      return res.end("Method not allowed");
    }

    const data = String(req.query.data || "").slice(0, 500);
    if (!data) {
      res.statusCode = 400;
      return res.end("Missing QR data");
    }

    const svg = await QRCode.toString(data, {
      type: "svg",
      margin: 1,
      width: 180,
      errorCorrectionLevel: "M",
    });

    res.statusCode = 200;
    res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.end(svg);
  } catch (error) {
    res.statusCode = 500;
    res.end("Could not generate QR code");
  }
};
