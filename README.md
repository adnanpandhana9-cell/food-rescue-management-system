# Food Rescue Management System (FRMS)

A full-stack three-tier web application built according to the **Software Engineering SRS, DFDs (Level 0, 1, 2), and Use Case Diagram**.

## Architecture (SRS Section 5.2)
- **Presentation Layer (`client/`)**: React + Vite responsive web interface supporting desktop, tablet, and mobile viewports.
- **Application Layer (`server/`)**: Node.js + Express REST API implementing authentication, role-based access control (`provider`, `seeker`, `admin`), input validation, food listing CRUD, request/approval workflows, distribution tracking, notifications, and admin reports/backups.
- **Data Layer (`server/db.js`)**: Persistent SQLite database (`node:sqlite`) mapping directly to DFD Data Stores **D1–D5**:
  - `users` (D1: User Database)
  - `food_listings` (D2: Food Database)
  - `food_requests` (D3: Request Database)
  - `distributions` (D4: Distribution Database)
  - `notifications` & `activity_records` (D5: Records & Notifications Database)

## User Interfaces (SRS Section 3.1)
1. Home Page (`/`)
2. Registration Page (`/register`)
3. Login Page (`/login`)
4. Food Provider Dashboard (`/provider/dashboard`)
5. Food Seeker Dashboard (`/seeker/dashboard`)
6. Admin Control Center (`/admin/dashboard`)
7. Food Listings & Search Page (`/foods`)
8. Food Details Page (`/foods/:id`)
9. Food Request Submission Page (`/foods/:id/request`)
10. Request & Distribution Management Page (`/requests`)
11. User Profile Page (`/profile`)
12. Notification Interface (`/notifications`)
13. Logout functionality in the navigation bar

## Demo Accounts
- **Food Provider**: `provider@frms.org` / `Provider@123`
- **Food Seeker**: `seeker@frms.org` / `Seeker@123`
- **Admin**: `admin@frms.org` / `Admin@123`

## Running the Application
```bash
npm install
npm run build
npm start
```
The server starts on `http://localhost:3000`.

For development with hot-reloading frontend + backend:
```bash
npm run dev
```

## Running Tests
```bash
npm test
```
