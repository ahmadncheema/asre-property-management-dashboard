# ASRE Property Management Dashboard

A secure, multi-page internal web application for the Property Management Team of **Ahmed Al Sheebani Real Estate**. Built to centralise all property management operations in one platform.

---

## 🏢 About

This dashboard is an internal tool for the Al Sheebani Real Estate property management team. It covers vacancy tracking, lease expiry alerts, maintenance management, bounced cheque recording, invoice generation, and team user management.

---

## ✨ Features

- **Our Properties** — Manage buildings, floors, and units with full CRUD
- **Vacancy List** — Auto-detected vacant units (no tenant assigned)
- **Upcoming Vacancy** — Leases expiring within 90 days, with 30/60/90 day stage badges
- **Bounce Check Tracker** — Log and resolve bounced cheque incidents per unit
- **Maintenance Tracker** — Track open and completed maintenance requests by category
- **Invoice Generator** — Generate VAT-compliant PDF invoices for 9 fee types with auto-numbering
- **QuickBooks CSV Export** — Export invoices as QuickBooks-compatible CSV for accounting
- **Email Reminders** — Log tenant reminders with stage tracking (Phase 2: Resend.com)
- **Admin Panel** — User management, full Excel database export/import, email log audit
- **Activity Log** — Every data change is logged with user name, action, and timestamp

---

## 🛠️ Tech Stack

| Layer               | Technology                             |
| ------------------- | -------------------------------------- |
| Frontend            | Vanilla HTML5, CSS3, JavaScript (ES6+) |
| Database            | Supabase (PostgreSQL)                  |
| Hosting             | Vercel                                 |
| PDF Generation      | jsPDF (client-side)                    |
| Excel Export/Import | SheetJS / xlsx.js (client-side)        |
| QuickBooks Export   | CSV (client-side, no API required)     |
| Email Reminders     | Resend.com (Phase 2)                   |

---

## 📁 Project Structure

asre-property-management-dashboard/
├── assets/
│ ├── icons/ # GIF icons for dashboard cards
│ └── logo/ # Company logo files
├── css/
│ └── main.css # Shared stylesheet
├── js/
│ ├── auth.js # Login, logout, session management
│ ├── shared.js # Shared utilities, nav, activity logging
│ └── supabase.js # Supabase client
├── index.html # Login screen
├── dashboard.html # Main dashboard — 8 summary cards
├── properties.html # Our Properties — building, floor, unit CRUD
├── vacancy.html # Vacancy List
├── upcoming.html # Upcoming Vacancy
├── bounce.html # Bounce Check Tracker
├── maintenance.html # Maintenance Tracker
├── invoices.html # Invoice Generator
├── emails.html # Email Reminders
└── admin.html # Admin Panel

---

## 🗄️ Database Schema

Built on Supabase (PostgreSQL) with 10 tables:

| Table                  | Purpose                              |
| ---------------------- | ------------------------------------ |
| `users`                | Team member accounts                 |
| `buildings`            | Property buildings                   |
| `floors`               | Floors within buildings              |
| `units`                | Individual units with tenant details |
| `bounce_checks`        | Bounced cheque records per unit      |
| `maintenance_requests` | Maintenance requests per unit        |
| `invoices`             | Generated invoice records            |
| `invoice_rates`        | Default rates per invoice type       |
| `email_logs`           | Email reminder log                   |
| `activity_log`         | System activity audit trail          |

---

## 🧾 Invoice Types

| Type                  | Code    |
| --------------------- | ------- |
| Renewal Fee           | ASRE-RE |
| Ejari Fee             | ASRE-EJ |
| Maintenance Quotation | ASRE-MQ |
| Check Hold Fee        | ASRE-CH |
| Bounced Check Penalty | ASRE-BP |
| Check Swap Fee        | ASRE-CS |
| Commission            | ASRE-CM |
| Check Received        | ASRE-CR |
| Acknowledgement       | ASRE-AC |

All invoices include **5% VAT** and are auto-numbered by type and year.

---

## 🚀 Deployment

- **Hosting:** Vercel (auto-deploys on every push to `main`)
- **Database:** Supabase (Middle East — Bahrain region)
- **Live URL:** https://asre-property-management-dashboard.vercel.app

---

## 📧 Email Reminders (Phase 2)

Email sending via **Resend.com** is designed and ready to activate. Pending DNS verification for `alsheebanirealestate.ae`. All reminder actions are currently logged to the database.

---

## 🔐 Access

This application is for **internal use only** by the Al Sheebani Real Estate property management team. No public access. Login required for all pages.

---

## 📌 Pending Items

- [ ] Remaining 7 dashboard GIF icons
- [ ] Final maintenance category list
- [ ] Invoice PDF background/letterhead template
- [ ] Company TRN number for VAT invoices
- [ ] Resend.com DNS verification for email sending
- [ ] Acknowledgement invoice type details

---

## 👨‍💻 Developed By

Digital Marketing & IT Department  
Ahmed Al Sheebani Real Estate  
Dubai, United Arab Emirates

---

_For internal use only — Ahmed Al Sheebani Real Estate © 2026_
