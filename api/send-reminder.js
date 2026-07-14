// ================================================================
// ASRE Property Management Dashboard
// Serverless Function — Send Lease Reminder Email via Resend
// ================================================================

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
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
  if (!tenantEmail || !tenantName || !unitNumber) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // Subject line per stage
  const subjects = {
    "90d": `Lease Renewal Notice — Unit ${unitNumber}, ${buildingName}`,
    "60d": `Lease Renewal Reminder — Unit ${unitNumber}, ${buildingName}`,
    "30d": `Urgent: Lease Expiry — Unit ${unitNumber}, ${buildingName}`,
  };

  const subject =
    subjects[stage] ||
    `Lease Renewal Notice — Unit ${unitNumber}, ${buildingName}`;

  // Format date nicely
  const formattedDate = new Date(endDate).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  // Urgency color per stage
  const urgencyColor =
    {
      "90d": "#3ead82",
      "60d": "#f0a500",
      "30d": "#e55353",
    }[stage] || "#3ead82";

  const urgencyLabel =
    {
      "90d": "90-Day Notice",
      "60d": "60-Day Reminder",
      "30d": "30-Day Urgent Notice",
    }[stage] || "Lease Notice";

  // HTML Email Template
  const htmlBody = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Lease Renewal Notice</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:'Segoe UI',Arial,sans-serif;">

  <div style="max-width:600px;margin:40px auto;background:#ffffff;
    border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.1);">

    <!-- Header -->
    <div style="background:#2a5590;padding:32px 40px;text-align:center;">
      <div style="font-size:1.4rem;font-weight:800;color:#ffffff;
        letter-spacing:1px;margin-bottom:4px;">
        AHMED AL SHEEBANI REAL ESTATE
      </div>
      <div style="font-size:0.85rem;color:rgba(255,255,255,0.7);">
        Property Management Department
      </div>
      <div style="margin-top:16px;display:inline-block;
        background:${urgencyColor};color:#ffffff;
        padding:6px 20px;border-radius:20px;
        font-size:0.82rem;font-weight:700;letter-spacing:0.5px;">
        ${urgencyLabel}
      </div>
    </div>

    <!-- Green accent bar -->
    <div style="height:4px;background:#3ead82;"></div>

    <!-- Body -->
    <div style="padding:40px;">

      <p style="font-size:1rem;color:#1a1a2e;margin-bottom:8px;">
        Dear <strong>${tenantName}</strong>,
      </p>

      <p style="font-size:0.95rem;color:#444;line-height:1.7;margin-bottom:24px;">
        This is a friendly reminder that your lease agreement for the property
        detailed below is approaching its expiry date.
      </p>

      <!-- Property Details Box -->
      <div style="background:#f8f9fc;border:1px solid #e0e6ef;
        border-left:4px solid #2a5590;border-radius:8px;
        padding:20px 24px;margin-bottom:28px;">
        <div style="font-size:0.75rem;font-weight:700;color:#8896a8;
          text-transform:uppercase;letter-spacing:0.5px;margin-bottom:14px;">
          Property Details
        </div>
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:6px 0;font-size:0.88rem;color:#8896a8;width:40%;">
              Building
            </td>
            <td style="padding:6px 0;font-size:0.88rem;font-weight:600;color:#1a1a2e;">
              ${buildingName}
            </td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:0.88rem;color:#8896a8;">
              Floor
            </td>
            <td style="padding:6px 0;font-size:0.88rem;font-weight:600;color:#1a1a2e;">
              ${floorName || "—"}
            </td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:0.88rem;color:#8896a8;">
              Unit Number
            </td>
            <td style="padding:6px 0;font-size:0.88rem;font-weight:600;color:#1a1a2e;">
              ${unitNumber}
            </td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:0.88rem;color:#8896a8;">
              Lease Expiry Date
            </td>
            <td style="padding:6px 0;font-size:0.88rem;font-weight:600;color:#1a1a2e;">
              ${formattedDate}
            </td>
          </tr>
        </table>
      </div>

      <!-- Days Remaining Banner -->
      <div style="background:${urgencyColor}15;border:1px solid ${urgencyColor}40;
        border-radius:8px;padding:16px 24px;margin-bottom:28px;text-align:center;">
        <div style="font-size:2rem;font-weight:800;color:${urgencyColor};line-height:1;">
          ${daysRemaining}
        </div>
        <div style="font-size:0.85rem;color:#666;margin-top:4px;">
          days remaining on your lease
        </div>
      </div>

      <p style="font-size:0.95rem;color:#444;line-height:1.7;margin-bottom:28px;">
        Please contact our leasing team at your earliest convenience to discuss
        your renewal options and avoid any disruption to your tenancy.
      </p>

      <!-- Contact Box -->
      <div style="background:#2a5590;border-radius:8px;
        padding:20px 24px;margin-bottom:28px;">
        <div style="font-size:0.75rem;font-weight:700;color:rgba(255,255,255,0.6);
          text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px;">
          Contact Our Leasing Team
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          <div style="font-size:0.9rem;color:#ffffff;">
            📧 <a href="mailto:leasing@alsheebanirealestate.ae"
              style="color:#3ead82;text-decoration:none;">
              leasing@alsheebanirealestate.ae
            </a>
          </div>
          <div style="font-size:0.9rem;color:#ffffff;">
            📞 +971 4 294 5001
          </div>
          <div style="font-size:0.9rem;color:#ffffff;">
            🌐 <a href="http://www.alsheebani-realestate.com"
              style="color:#3ead82;text-decoration:none;">
              www.alsheebani-realestate.com
            </a>
          </div>
          <div style="font-size:0.9rem;color:#ffffff;">
            📍 502 Ithraa Tower, P.O. Box 20190, Dubai, UAE
          </div>
        </div>
      </div>

      <p style="font-size:0.82rem;color:#999;line-height:1.6;
        border-top:1px solid #eee;padding-top:20px;">
        This is an automated reminder sent by the Ahmed Al Sheebani Real Estate
        Property Management System. Please do not reply to this email directly —
        contact us using the details above.
      </p>

    </div>

    <!-- Footer -->
    <div style="background:#f8f9fc;border-top:1px solid #e0e6ef;
      padding:20px 40px;text-align:center;">
      <div style="font-size:0.82rem;color:#8896a8;">
        Ahmed Al Sheebani Real Estate L.L.C · Dubai, UAE
      </div>
      <div style="font-size:0.78rem;color:#b0b8c4;margin-top:4px;">
        TRN: 104488244500003
      </div>
    </div>

  </div>

</body>
</html>`;

  // Plain text fallback
  const textBody = `
Dear ${tenantName},

This is a ${urgencyLabel} for your lease at Unit ${unitNumber}, ${buildingName}.

Your lease expires on ${formattedDate} — ${daysRemaining} days remaining.

Please contact our leasing team:
Email: leasing@alsheebanirealestate.ae
Phone: +971 4 294 5001

This is an automated message. Please do not reply to this email.

Ahmed Al Sheebani Real Estate
Property Management Department
502 Ithraa Tower, P.O. Box 20190, Dubai, UAE
  `.trim();

  // Send via Resend
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

    const result = await response.json();

    if (!response.ok) {
      console.error("Resend error:", result);
      return res.status(500).json({
        error: result.message || "Failed to send email",
      });
    }

    return res.status(200).json({
      success: true,
      id: result.id,
    });
  } catch (err) {
    console.error("Send error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
