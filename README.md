# Church Sunday School Management System (General Service)

A real-time, cloud-based web application built to digitize general Sunday School service operations, student directories, servant assignments, and weekly attendance tracking.

---

## Key Features
- **Real-Time Cloud Synchronization:** Instant data updates across mobile and desktop devices powered by Google Firebase Firestore.
- **3-Tier Role-Based Access Control (RBAC):** Dedicated permission levels for General Supervisors, Stage Supervisors, and Servants, secured with Salted SHA-256 password hashing.
- **Automated Deduplication:** Built-in logic to prevent and merge duplicate student or servant records.
- **Attendance & Telemetry:** Weekly attendance tracking for Sunday School meetings and liturgical services with automated analytics.
- **Birthday Alerts & WhatsApp Integration:** Monthly birthday notifications with one-click WhatsApp messaging.
- **Digital Curriculum Library:** Centralized access to spiritual books and service materials.

---

## Tech Stack
- **Frontend:** React, TypeScript, Vite, Tailwind CSS (RTL)
- **Backend & Database:** Google Firebase Firestore
- **Security:** Salted SHA-256 Hashing & Firestore Security Rules
- **Deployment:** Vercel

