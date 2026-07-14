// ================================================================
// ASRE Property Management Dashboard
// Vercel Serverless Function — Send Email Reminder via Resend
// ================================================================

module.exports = async function handler(req, res) {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Handle preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Check API key exists
  if (!process.env.RESEND_API_KEY) {
    console.error("RESEND_API_KEY is not set");
    return res.status(500).json({ error: "Email service not configured" });
  }

  const {
    tenantName,
    tenantEmail,
    unitNumber,
    buildingName,
    floorName,
    endDate,
    daysRemaining,
    stage,
  } = req.body;

  // Validate required fields
  if (!tenantEmail || !tenantName || !unitNumber || !buildingName) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // Subject line based on stage
  const subjects = {
    "90d": `Lease Renewal Notice — Unit ${unitNumber}, ${buildingName}`,
    "60d": `Lease Renewal Reminder — Unit ${unitNumber}, ${buildingName}`,
    "30d": `Urgent: Lease Expiry — Unit ${unitNumber}, ${buildingName}`,
  };

  const subject =
    subjects[stage] ||
    `Lease Renewal Notice — Unit ${unitNumber}, ${buildingName}`;

  // Format end date
  const formattedDate = new Date(endDate).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  // Stage colors and labels
  const stageColors = {
    "90d": "#3ead82",
    "60d": "#f0a500",
    "30d": "#e55353",
  };

  const stageLabels = {
    "90d": "90 Days Notice",
    "60d": "60 Days Reminder",
    "30d": "Final 30 Days Notice",
  };

  const stageColor = stageColors[stage] || "#3ead82";
  const stageLabel = stageLabels[stage] || "Lease Notice";

  // HTML email body
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

              <!-- Logo -->
              <img
                src="https://raw.githubusercontent.com/ahmadncheema/asre-property-management-dashboard/main/assets/logo/logo.png"
                alt="Ahmed Al Sheebani Real Estate"
                width="200"
                style="display:block;margin:0 auto 16px;
                max-width:200px;height:auto;"
              />

              <!-- Company Name -->
              <div style="font-size:18px;font-weight:800;color:#ffffff;
                letter-spacing:1px;margin-bottom:8px;">
                AHMED AL SHEEBANI REAL ESTATE
              </div>

              <!-- Green Divider -->
              <div style="width:50px;height:3px;background:#3ead82;
                margin:0 auto 14px;border-radius:2px;"></div>

              <!-- Dept Label -->
              <div style="font-size:12px;color:rgba(255,255,255,0.7);
                letter-spacing:1px;text-transform:uppercase;">
                Property Management Department
              </div>

            </td>
          </tr>

          <!-- Stage Badge -->
          <tr>
            <td style="background:#2a5590;padding:0 40px 28px;
              text-align:center;">
              <div style="display:inline-block;background:${stageColor};
                color:#ffffff;font-size:13px;font-weight:700;
                letter-spacing:1px;padding:10px 32px;
                border-radius:25px;">
                ${stageLabel}
              </div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px 28px;">

              <p style="font-size:16px;color:#1a1a2e;margin:0 0 16px;">
                Dear <strong>${tenantName}</strong>,
              </p>

              <p style="font-size:15px;color:#555;line-height:1.7;
                margin:0 0 28px;">
                This is a friendly reminder that your lease agreement for
                the property detailed below is approaching its expiry date.
                Please contact our leasing team at your earliest convenience
                to discuss renewal options.
              </p>

              <!-- Property Details -->
              <table width="100%" cellpadding="0" cellspacing="0"
                style="border:1px solid #e0e8f5;border-radius:10px;
                overflow:hidden;margin-bottom:24px;">
                <tr>
                  <td style="background:#2a5590;padding:12px 20px;">
                    <span style="font-size:11px;font-weight:700;
                      color:#ffffff;letter-spacing:1px;
                      text-transform:uppercase;">
                      Property Details
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:12px 0;border-bottom:
                          1px solid #f0f4fa;width:40%;">
                          <span style="font-size:12px;color:#8896a8;
                            text-transform:uppercase;letter-spacing:0.5px;">
                            Building
                          </span>
                        </td>
                        <td style="padding:12px 0;border-bottom:
                          1px solid #f0f4fa;">
                          <strong style="font-size:14px;color:#1a1a2e;">
                            ${buildingName}
                          </strong>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:12px 0;border-bottom:
                          1px solid #f0f4fa;">
                          <span style="font-size:12px;color:#8896a8;
                            text-transform:uppercase;letter-spacing:0.5px;">
                            Floor
                          </span>
                        </td>
                        <td style="padding:12px 0;border-bottom:
                          1px solid #f0f4fa;">
                          <strong style="font-size:14px;color:#1a1a2e;">
                            ${floorName}
                          </strong>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:12px 0;border-bottom:
                          1px solid #f0f4fa;">
                          <span style="font-size:12px;color:#8896a8;
                            text-transform:uppercase;letter-spacing:0.5px;">
                            Unit Number
                          </span>
                        </td>
                        <td style="padding:12px 0;border-bottom:
                          1px solid #f0f4fa;">
                          <strong style="font-size:14px;color:#1a1a2e;">
                            ${unitNumber}
                          </strong>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:12px 0;">
                          <span style="font-size:12px;color:#8896a8;
                            text-transform:uppercase;letter-spacing:0.5px;">
                            Lease Expiry Date
                          </span>
                        </td>
                        <td style="padding:12px 0;">
                          <strong style="font-size:14px;color:#1a1a2e;">
                            ${formattedDate}
                          </strong>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Days Remaining Box -->
              <table width="100%" cellpadding="0" cellspacing="0"
                style="background:${stageColor}15;
                border:2px solid ${stageColor};
                border-radius:10px;margin-bottom:28px;">
                <tr>
                  <td style="padding:24px;text-align:center;">
                    <div style="font-size:48px;font-weight:800;
                      color:${stageColor};line-height:1;
                      margin-bottom:8px;">
                      ${daysRemaining}
                    </div>
                    <div style="font-size:13px;color:#888;
                      text-transform:uppercase;letter-spacing:1px;">
                      days remaining on your lease
                    </div>
                  </td>
                </tr>
              </table>

              <p style="font-size:15px;color:#555;line-height:1.7;
                margin:0 0 28px;">
                Please do not hesitate to reach out to our leasing team
                using the contact details below. We look forward to
                assisting you with your renewal.
              </p>

              <!-- Contact Section -->
              <table width="100%" cellpadding="0" cellspacing="0"
                style="background:#1a1a2e;border-radius:10px;
                margin-bottom:28px;overflow:hidden;">
                <tr>
                  <td style="padding:14px 24px;
                    border-bottom:1px solid rgba(255,255,255,0.08);">
                    <span style="font-size:11px;font-weight:700;
                      color:rgba(255,255,255,0.5);letter-spacing:1px;
                      text-transform:uppercase;">
                      Contact Our Leasing Team
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:20px 24px;">
                    <table width="100%" cellpadding="0" cellspacing="0">

                      <!-- Email -->
                      <tr>
                        <td style="padding:10px 0;width:36px;
                          vertical-align:middle;">
                          <span style="font-size:18px;">📧</span>
                        </td>
                        <td style="padding:10px 0;
                          border-bottom:1px solid rgba(255,255,255,0.06);
                          vertical-align:middle;">
                          <div style="font-size:11px;
                            color:rgba(255,255,255,0.4);
                            text-transform:uppercase;letter-spacing:0.5px;
                            margin-bottom:3px;">Email</div>
                          <a href="mailto:leasing@alsheebanirealestate.ae"
                            style="font-size:14px;color:#3ead82;
                            text-decoration:none;font-weight:600;">
                            leasing@alsheebanirealestate.ae
                          </a>
                        </td>
                      </tr>

                      <!-- Phone -->
                      <tr>
                        <td style="padding:10px 0;width:36px;
                          vertical-align:middle;">
                          <span style="font-size:18px;">📞</span>
                        </td>
                        <td style="padding:10px 0;
                          border-bottom:1px solid rgba(255,255,255,0.06);
                          vertical-align:middle;">
                          <div style="font-size:11px;
                            color:rgba(255,255,255,0.4);
                            text-transform:uppercase;letter-spacing:0.5px;
                            margin-bottom:3px;">Phone</div>
                          <a href="tel:+97142945001"
                            style="font-size:14px;color:#3ead82;
                            text-decoration:none;font-weight:600;">
                            +971 4 294 5001
                          </a>
                        </td>
                      </tr>

                      <!-- Website -->
                      <tr>
                        <td style="padding:10px 0;width:36px;
                          vertical-align:middle;">
                          <span style="font-size:18px;">🌐</span>
                        </td>
                        <td style="padding:10px 0;
                          border-bottom:1px solid rgba(255,255,255,0.06);
                          vertical-align:middle;">
                          <div style="font-size:11px;
                            color:rgba(255,255,255,0.4);
                            text-transform:uppercase;letter-spacing:0.5px;
                            margin-bottom:3px;">Website</div>
                          <a href="https://www.alsheebani-realestate.com"
                            style="font-size:14px;color:#3ead82;
                            text-decoration:none;font-weight:600;">
                            www.alsheebani-realestate.com
                          </a>
                        </td>
                      </tr>

                      <!-- Address -->
                      <tr>
                        <td style="padding:10px 0;width:36px;
                          vertical-align:middle;">
                          <span style="font-size:18px;">📍</span>
                        </td>
                        <td style="padding:10px 0;vertical-align:middle;">
                          <div style="font-size:11px;
                            color:rgba(255,255,255,0.4);
                            text-transform:uppercase;letter-spacing:0.5px;
                            margin-bottom:3px;">Address</div>
                          <span style="font-size:14px;color:#ffffff;
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
                This is an automated reminder sent by the Ahmed Al Sheebani
                Real Estate Property Management System. Please do not reply
                to this email directly — contact us using the details above.
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

  // Plain text fallback
  const textBody = `
Dear ${tenantName},

This is a reminder that your lease for Unit ${unitNumber} at ${buildingName}
(Floor ${floorName}) expires on ${formattedDate} — ${daysRemaining} days remaining.

Please contact our leasing team to discuss renewal:
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
