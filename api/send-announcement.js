// ================================================================
// ASRE Property Management Dashboard
// Vercel Serverless Function — Send Announcement via Resend
// ================================================================

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.RESEND_API_KEY) {
    return res.status(500).json({ error: "Email service not configured" });
  }

  const {
    tenantName,
    tenantEmail,
    buildingName,
    announcementType,
    subject,
    message,
    senderName,
  } = req.body;

  if (!tenantEmail || !subject || !message || !buildingName) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // Type colors and icons
  const typeStyles = {
    "Routine Maintenance": { color: "#2a5590", icon: "🔧" },
    "Pest Control": { color: "#6b4e9e", icon: "🐛" },
    "Water Interruption": { color: "#0ea5e9", icon: "💧" },
    "Electricity Interruption": { color: "#f0a500", icon: "⚡" },
    "Building Inspection": { color: "#3ead82", icon: "🔍" },
    "General Notice": { color: "#2a5590", icon: "📢" },
    "Holiday Greetings": { color: "#e55353", icon: "🎉" },
    "Parking Notice": { color: "#64748b", icon: "🚗" },
    Custom: { color: "#2a5590", icon: "📝" },
  };

  const style = typeStyles[announcementType] || typeStyles["General Notice"];
  const today = new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const htmlBody = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f0f2f5;
  font-family:'Segoe UI',Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0"
    style="background:#f0f2f5;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0"
          style="max-width:600px;width:100%;background:#ffffff;
          border-radius:16px;overflow:hidden;
          box-shadow:0 4px 24px rgba(0,0,0,0.10);">

          <!-- Header -->
          <tr>
            <td style="background:#2a5590;padding:36px 40px 28px;
              text-align:center;">
              <img
                src="https://raw.githubusercontent.com/ahmadncheema/asre-property-management-dashboard/main/assets/logo/logo.png"
                alt="Ahmed Al Sheebani Real Estate"
                width="200"
                style="display:block;margin:0 auto 16px;
                max-width:200px;height:auto;"
              />
              <div style="font-size:18px;font-weight:800;color:#ffffff;
                letter-spacing:1px;margin-bottom:8px;">
                AHMED AL SHEEBANI REAL ESTATE
              </div>
              <div style="width:50px;height:3px;background:#3ead82;
                margin:0 auto 14px;border-radius:2px;"></div>
              <div style="font-size:12px;color:rgba(255,255,255,0.7);
                letter-spacing:1px;text-transform:uppercase;">
                Property Management Department
              </div>
            </td>
          </tr>

          <!-- Announcement Type Badge -->
          <tr>
            <td style="background:#2a5590;padding:0 40px 28px;
              text-align:center;">
              <div style="display:inline-block;
                background:${style.color};
                color:#ffffff;font-size:13px;font-weight:700;
                letter-spacing:1px;padding:10px 32px;
                border-radius:25px;">
                ${style.icon} ${announcementType}
              </div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px 28px;">

              <p style="font-size:16px;color:#1a1a2e;margin:0 0 16px;">
                Dear <strong>${tenantName || "Valued Tenant"}</strong>,
              </p>

              <!-- Building + Date Info -->
              <table width="100%" cellpadding="0" cellspacing="0"
                style="background:#f0f4ff;border:1px solid #d0ddf0;
                border-radius:10px;margin-bottom:24px;overflow:hidden;">
                <tr>
                  <td style="background:#2a5590;padding:12px 20px;">
                    <span style="font-size:11px;font-weight:700;
                      color:#ffffff;letter-spacing:1px;
                      text-transform:uppercase;">
                      Notice Details
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:12px 0;
                          border-bottom:1px solid #e8eef8;width:40%;">
                          <span style="font-size:12px;color:#8896a8;
                            text-transform:uppercase;letter-spacing:0.5px;">
                            Building
                          </span>
                        </td>
                        <td style="padding:12px 0;
                          border-bottom:1px solid #e8eef8;">
                          <strong style="font-size:14px;color:#1a1a2e;">
                            ${buildingName}
                          </strong>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:12px 0;width:40%;">
                          <span style="font-size:12px;color:#8896a8;
                            text-transform:uppercase;letter-spacing:0.5px;">
                            Date Issued
                          </span>
                        </td>
                        <td style="padding:12px 0;">
                          <strong style="font-size:14px;color:#1a1a2e;">
                            ${today}
                          </strong>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Announcement Message -->
              <table width="100%" cellpadding="0" cellspacing="0"
                style="background:#f8f9fa;border-left:4px solid ${style.color};
                border-radius:0 10px 10px 0;margin-bottom:28px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <div style="font-size:15px;color:#333;
                      line-height:1.8;white-space:pre-line;">
                      ${message.replace(/\n/g, "<br>")}
                    </div>
                  </td>
                </tr>
              </table>

              <p style="font-size:15px;color:#555;line-height:1.7;
                margin:0 0 28px;">
                If you have any questions regarding this notice, please
                do not hesitate to contact our team using the details below.
              </p>

              <!-- Contact Section -->
              <table width="100%" cellpadding="0" cellspacing="0"
                style="background:#f0f4ff;border:1px solid #d0ddf0;
                border-radius:10px;margin-bottom:28px;overflow:hidden;">
                <tr>
                  <td style="padding:14px 24px;background:#2a5590;
                    border-bottom:1px solid #d0ddf0;">
                    <span style="font-size:11px;font-weight:700;
                      color:#ffffff;letter-spacing:1px;
                      text-transform:uppercase;">
                      Contact Us
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:20px 24px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:10px 0;width:36px;
                          vertical-align:middle;">
                          <span style="font-size:18px;">📧</span>
                        </td>
                        <td style="padding:10px 0;
                          border-bottom:1px solid #e0e8f5;
                          vertical-align:middle;">
                          <div style="font-size:11px;color:#8896a8;
                            text-transform:uppercase;letter-spacing:0.5px;
                            margin-bottom:3px;">Email</div>
                          <a href="mailto:leasing@alsheebanirealestate.ae"
                            style="font-size:14px;color:#2a5590;
                            text-decoration:none;font-weight:600;">
                            leasing@alsheebanirealestate.ae
                          </a>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:10px 0;width:36px;
                          vertical-align:middle;">
                          <span style="font-size:18px;">📞</span>
                        </td>
                        <td style="padding:10px 0;
                          border-bottom:1px solid #e0e8f5;
                          vertical-align:middle;">
                          <div style="font-size:11px;color:#8896a8;
                            text-transform:uppercase;letter-spacing:0.5px;
                            margin-bottom:3px;">Phone</div>
                          <a href="tel:+97142945001"
                            style="font-size:14px;color:#2a5590;
                            text-decoration:none;font-weight:600;">
                            +971 4 294 5001
                          </a>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:10px 0;width:36px;
                          vertical-align:middle;">
                          <span style="font-size:18px;">📍</span>
                        </td>
                        <td style="padding:10px 0;vertical-align:middle;">
                          <div style="font-size:11px;color:#8896a8;
                            text-transform:uppercase;letter-spacing:0.5px;
                            margin-bottom:3px;">Address</div>
                          <span style="font-size:14px;color:#1a1a2e;
                            font-weight:600;line-height:1.5;">
                            Office 502, Ithraa Tower,
                            Al Garhoud, Dubai, UAE
                          </span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Disclaimer -->
              <p style="font-size:12px;color:#aaa;line-height:1.6;
                border-top:1px solid #eee;padding-top:20px;margin:0;">
                This is an official notice from Ahmed Al Sheebani Real
                Estate Property Management. Please do not reply to this
                email directly — contact us using the details above.
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8f9fa;padding:20px 40px;
              border-top:1px solid #eee;text-align:center;">
              <div style="font-size:12px;color:#999;line-height:1.8;">
                <strong style="color:#2a5590;font-size:13px;">
                  Ahmed Al Sheebani Real Estate L.L.C
                </strong><br>
                Office 502, Ithraa Tower, Al Garhoud, Dubai, UAE<br>
                TRN: 104488244500003
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;

  const textBody = `
Dear ${tenantName || "Valued Tenant"},

${announcementType} — ${buildingName}
Date: ${today}

${message}

For queries contact:
Email: leasing@alsheebanirealestate.ae
Phone: +971 4 294 5001
Address: Office 502, Ithraa Tower, Al Garhoud, Dubai, UAE

Ahmed Al Sheebani Real Estate L.L.C
TRN: 104488244500003
  `.trim();

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Ahmed Al Sheebani Real Estate <noreply@alsheebanirealestate.ae>",
        reply_to: "leasing@alsheebanirealestate.ae",
        to: [tenantEmail],
        subject,
        html: htmlBody,
        text: textBody,
      }),
    });

    const responseText = await response.text();
    let data = {};

    try {
      data = JSON.parse(responseText);
    } catch {
      console.error("Resend non-JSON response:", responseText);
      return res.status(500).json({
        error: "Invalid response from email service",
      });
    }

    if (!response.ok) {
      console.error("Resend API error:", data);
      return res.status(500).json({
        error: data.message || data.name || "Failed to send email",
      });
    }

    return res.status(200).json({ success: true, id: data.id });
  } catch (err) {
    console.error("Send error:", err);
    return res.status(500).json({ error: err.message });
  }
};
