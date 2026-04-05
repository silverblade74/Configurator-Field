# Church Volunteer Management App — Architecture Document

## 1. System Architecture

```
┌──────────────────────────────────────────────────────┐
│                     FRONTEND                         │
│           React + Vite + Tailwind CSS                │
│                                                      │
│  ┌────────────┐ ┌────────────┐ ┌──────────────────┐ │
│  │   Login /   │ │ Volunteer  │ │     Admin        │ │
│  │  Register   │ │ Dashboard  │ │   Dashboard      │ │
│  └────────────┘ └────────────┘ └──────────────────┘ │
│  ┌────────────┐ ┌────────────┐ ┌──────────────────┐ │
│  │   Events    │ │ Leaderboard│ │ Badges/Milestones│ │
│  └────────────┘ └────────────┘ └──────────────────┘ │
│                                                      │
│  Auth Context ←→ Firebase Auth                       │
│  Firestore Service ←→ Firebase Firestore             │
└──────────────────────┬───────────────────────────────┘
                       │ HTTPS
┌──────────────────────▼───────────────────────────────┐
│                  FIREBASE BACKEND                     │
│                                                      │
│  ┌────────────────┐  ┌────────────────────────────┐  │
│  │ Authentication │  │      Cloud Firestore       │  │
│  │ Email + Google │  │  (NoSQL Document Database)  │  │
│  └────────────────┘  └────────────────────────────┘  │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │            Firestore Security Rules             │  │
│  │   (Role-based access: admin, leader, volunteer) │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
                       │
┌──────────────────────▼───────────────────────────────┐
│                    HOSTING                            │
│              Vercel (Free Tier)                       │
│          Static site deployment + CDN                 │
└──────────────────────────────────────────────────────┘
```

**Key architectural decisions:**
- **No backend server** — Firebase handles auth, database, and security rules. This eliminates server costs and complexity.
- **Client-side rendering** — React SPA deployed as static files to Vercel CDN.
- **Firestore security rules** — All access control enforced at the database level.

---

## 2. Database Schema (Firestore Collections)

### `users`
| Field          | Type       | Description                              |
|---------------|------------|------------------------------------------|
| uid           | string     | Firebase Auth UID (doc ID)               |
| email         | string     | User email                               |
| displayName   | string     | Full name                                |
| photoURL      | string     | Profile photo URL                        |
| phone         | string     | Phone number                             |
| role          | string     | `volunteer` / `ministry_leader` / `admin`|
| ministries    | string[]   | Array of ministry IDs                    |
| totalHours    | number     | Cumulative service hours                 |
| totalPoints   | number     | Cumulative gamification points           |
| badges        | string[]   | Array of earned badge IDs                |
| streak        | number     | Current weekly serving streak            |
| lastServedDate| timestamp  | Last check-out date                      |
| createdAt     | timestamp  | Account creation                         |
| updatedAt     | timestamp  | Last profile update                      |

### `ministries`
| Field         | Type      | Description                |
|--------------|-----------|----------------------------|
| name         | string    | Ministry name              |
| description  | string    | About this ministry        |
| leaderName   | string    | Name of the ministry leader|
| contactEmail | string    | Contact email              |
| memberCount  | number    | Number of active members   |
| createdAt    | timestamp | Creation date              |

### `events`
| Field          | Type      | Description                     |
|---------------|-----------|----------------------------------|
| title         | string    | Event name                       |
| description   | string    | Event details                    |
| date          | timestamp | Date and time of event           |
| location      | string    | Venue / address                  |
| ministryId    | string    | Associated ministry (or empty)   |
| maxVolunteers | number    | Capacity limit (null = unlimited)|
| durationHours | number    | Expected duration                |
| signupCount   | number    | Current number of signups        |
| createdAt     | timestamp | Creation date                    |

### `eventSignups`
| Field        | Type      | Description                                           |
|-------------|-----------|-------------------------------------------------------|
| eventId     | string    | Reference to event                                     |
| userId      | string    | Reference to user                                      |
| userName    | string    | Denormalized user name for display                     |
| status      | string    | `signed_up` / `checked_in` / `checked_out` / `no_show`|
| checkedInAt | timestamp | Check-in time                                          |
| checkedOutAt| timestamp | Check-out time                                         |
| hoursLogged | number    | Computed hours for this session                        |
| createdAt   | timestamp | Signup time                                            |

### `attendanceLogs`
| Field        | Type      | Description                |
|-------------|-----------|----------------------------|
| userId      | string    | Reference to user          |
| signupId    | string    | Reference to eventSignup   |
| eventId     | string    | Reference to event         |
| checkedInAt | timestamp | When they checked in       |
| checkedOutAt| timestamp | When they checked out      |
| hoursLogged | number    | Computed hours             |
| createdAt   | timestamp | Log creation time          |

### `serviceHours`
| Field   | Type      | Description                |
|--------|-----------|----------------------------|
| userId | string    | Reference to user          |
| eventId| string    | Reference to event         |
| hours  | number    | Hours served               |
| points | number    | Points earned              |
| date   | timestamp | Date of service            |

---

## 3. UI Wireframe Descriptions

### Login Page
- Centered card with church logo/icon at top
- Email + password fields
- "Sign In" button (primary blue)
- Google sign-in button with Google logo
- "Don't have an account? Sign up" link at bottom
- Mobile-first: full-width on small screens, max-w-md centered on desktop

### Register Page
- Same centered card layout as Login
- Fields: Full Name, Email, Password, Confirm Password
- Google sign-up alternative
- "Already have an account? Sign in" link

### Volunteer Dashboard
- Welcome header with name and level badge
- 4 stat cards in a row: Total Hours, Points, Streak, Badges
- Two-column layout below:
  - Left: Upcoming Events (list of signed-up events)
  - Right: Recent Activity (last 5 completed events with hours)
- Bottom: Badge showcase (earned badges with icons)

### Events Page
- Filter bar: Upcoming/Past toggle + Ministry dropdown
- 3-column responsive grid of event cards
- Each card: Ministry tag, title, description, date/time, location, volunteer count
- "Sign Up" or "Cancel Signup" action button per card

### Ministries Page
- 3-column grid of ministry cards
- Each card: Icon, name, description, leader, contact, member count

### Leaderboard Page
- Toggle: By Points / By Hours
- Top-3 podium (larger cards with rank icons: crown, silver medal, bronze medal)
- Full table below: Rank, Avatar, Name, Hours, Points, Level
- Current user's row highlighted in blue

### Badges Page
- Section 1: Badge grid (earned = golden border, locked = grayed out with lock icon)
- Section 2: Hour milestones with progress bars

### Profile Page
- Avatar circle with initial, name, level, role
- Editable fields: Display Name, Phone
- Stats row: Hours, Points, Badges

---

## 4. Admin Dashboard Layout

**5-tab interface:**

| Tab | Content |
|-----|---------|
| **Overview** | 4 stat cards (Volunteers, Hours, Events, Ministries) + Top-10 volunteers table |
| **Events** | Create event form + events table with delete actions |
| **Ministries** | Create ministry form + ministry cards with delete |
| **Users** | User table with role dropdown (volunteer/leader/admin) |
| **Check-In** | Select event → view signups → Check In / Check Out buttons per volunteer |

---

## 5. Volunteer Dashboard Layout

```
┌─────────────────────────────────────────────────┐
│ Welcome, [Name]!          [Browse Events →]     │
│ Gold Level · Next milestone: 100h               │
├────────┬────────┬────────┬────────────────────── │
│ Hours  │ Points │ Streak │ Badges               │
│ 52h    │ 620    │ 8 wks  │ 5 of 9              │
├────────┴────────┴────────┴────────────────────── │
│                                                  │
│  Upcoming Events     │  Recent Activity         │
│  ┌───────────────┐   │  ┌───────────────┐       │
│  │ Youth Retreat  │   │  │ Sunday Setup  │       │
│  │ Apr 12 @ 9am  │   │  │ 3h · +30 pts  │       │
│  └───────────────┘   │  └───────────────┘       │
│                                                  │
│  Your Badges: ⭐🕐🔥🏆📅                       │
└─────────────────────────────────────────────────┘
```

---

## 6. Leaderboard Logic

```
Ranking Algorithm:
1. Query users where role == "volunteer"
2. Order by totalPoints DESC (or totalHours for hours view)
3. Limit to top 50
4. Highlight current user's row

Monthly Leaderboard (future enhancement):
- Add monthlyPoints field to users
- Reset on 1st of each month via Cloud Function
- Separate "This Month" / "All Time" toggle
```

---

## 7. Badge & Gamification Logic

### Points System
| Action                    | Points |
|--------------------------|--------|
| Per hour served          | 10     |
| First event bonus        | 25     |
| 4-week streak bonus      | 15     |
| Milestone: 1h reached    | 10     |
| Milestone: 10h reached   | 50     |
| Milestone: 25h reached   | 100    |
| Milestone: 50h reached   | 200    |
| Milestone: 100h reached  | 500    |
| Milestone: 250h reached  | 1,000  |
| Milestone: 500h reached  | 2,500  |

### Badge Definitions
| Badge ID    | Name       | Icon | Condition             |
|------------|------------|------|-----------------------|
| first_event| First Step | ⭐   | totalHours > 0        |
| hours_10   | Dedicated  | 🕐   | totalHours >= 10      |
| hours_50   | Committed  | 🔥   | totalHours >= 50      |
| hours_100  | Champion   | 🏆   | totalHours >= 100     |
| hours_250  | Legend     | 👑   | totalHours >= 250     |
| streak_4   | Consistent | 📅   | streak >= 4 weeks     |
| streak_12  | Faithful   | 💎   | streak >= 12 weeks    |
| points_500 | Rising Star| 🌟   | totalPoints >= 500    |
| points_2000| All Star   | ✨   | totalPoints >= 2,000  |

### Levels
| Level | Name     | Points Required |
|-------|----------|----------------|
| 1     | Newcomer | 0              |
| 2     | Bronze   | 500            |
| 3     | Silver   | 1,000          |
| 4     | Gold     | 2,000          |
| 5     | Platinum | 5,000          |

### Streak Logic
- A week counts as "served" if the volunteer checks out of at least one event
- Streak increments each consecutive week with at least one check-out
- Missing a full week resets the streak to 0

---

## 8. Starter Code Structure

```
church-volunteer-app/
├── public/
│   └── vite.svg                    # App favicon
├── src/
│   ├── components/
│   │   ├── EmptyState.jsx          # Empty state placeholder
│   │   ├── Layout.jsx              # Main layout with navbar + outlet
│   │   ├── Navbar.jsx              # Top navigation bar (responsive)
│   │   ├── ProtectedRoute.jsx      # Auth + role guard wrapper
│   │   └── StatCard.jsx            # Reusable stat display card
│   ├── contexts/
│   │   └── AuthContext.jsx          # Auth state, login, register, logout
│   ├── pages/
│   │   ├── AdminDashboard.jsx       # Admin panel (5 tabs)
│   │   ├── Badges.jsx              # Badge + milestone display
│   │   ├── Events.jsx              # Event listing + signup
│   │   ├── Leaderboard.jsx         # Points/hours leaderboard
│   │   ├── Login.jsx               # Email + Google login
│   │   ├── Ministries.jsx          # Ministry listing
│   │   ├── Profile.jsx             # User profile editor
│   │   ├── Register.jsx            # Account registration
│   │   └── VolunteerDashboard.jsx  # Volunteer home dashboard
│   ├── services/
│   │   └── firestore.js            # All Firestore CRUD operations
│   ├── utils/
│   │   └── gamification.js         # Points, levels, milestones logic
│   ├── App.jsx                     # Router configuration
│   ├── firebase.js                 # Firebase initialization
│   ├── index.css                   # Tailwind directives + custom classes
│   └── main.jsx                    # React entry point
├── .env.example                    # Environment variable template
├── .gitignore                      # Git ignore rules
├── ARCHITECTURE.md                 # This document
├── firestore.indexes.json          # Composite index definitions
├── firestore.rules                 # Firestore security rules
├── index.html                      # HTML entry point
├── package.json                    # Dependencies
├── postcss.config.js               # PostCSS config
├── tailwind.config.js              # Tailwind config
└── vite.config.js                  # Vite build config
```

---

## 9. Deployment Instructions

### Prerequisites
- Node.js 18+
- A Firebase project (free Spark plan)
- A Vercel account (free)

### Step 1: Firebase Setup
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a new project (disable Google Analytics if not needed)
3. **Enable Authentication:**
   - Go to Authentication → Sign-in method
   - Enable "Email/Password"
   - Enable "Google" (add your domain to authorized domains)
4. **Create Firestore Database:**
   - Go to Firestore Database → Create Database
   - Start in production mode
   - Choose a region close to your users
5. **Deploy Security Rules:**
   - Copy `firestore.rules` content into Firestore → Rules tab
   - Publish
6. **Deploy Indexes:**
   - Install Firebase CLI: `npm install -g firebase-tools`
   - Run: `firebase login && firebase init firestore`
   - Run: `firebase deploy --only firestore:indexes`
7. **Get Config:**
   - Go to Project Settings → General → Your Apps → Web App
   - Copy the config values

### Step 2: Local Development
```bash
cd church-volunteer-app
cp .env.example .env
# Fill in your Firebase config values in .env

npm install
npm run dev
```

### Step 3: Deploy to Vercel
```bash
# Option A: Vercel CLI
npm install -g vercel
vercel

# Option B: GitHub Integration
# 1. Push code to GitHub
# 2. Go to vercel.com → Import Project → Select repo
# 3. Set environment variables (from .env)
# 4. Deploy
```

**Vercel Environment Variables to set:**
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

### Step 4: Create First Admin
1. Register a new account via the app
2. Go to Firebase Console → Firestore → users collection
3. Find your user document
4. Change `role` from `"volunteer"` to `"admin"`
5. Refresh the app — you'll now see the Admin tab

---

## 10. Estimated Monthly Cost

| Service         | Free Tier Limits                       | Estimated Cost |
|----------------|----------------------------------------|----------------|
| **Firebase Auth**   | 10K auth/month, unlimited users    | **$0**         |
| **Firestore**       | 50K reads, 20K writes, 20K deletes/day | **$0**     |
| **Vercel Hosting**  | 100GB bandwidth, unlimited deploys | **$0**         |
| **Custom Domain**   | Optional (Namecheap/Google Domains)| **$1–12/year** |
| **Email (SendGrid)**| 100 emails/day on free tier        | **$0**         |

### Total: $0/month for a small church (< 200 volunteers)

**When you'd need to pay:**
- Over 50K Firestore reads/day → Firebase Blaze plan (pay-as-you-go, ~$0.06 per 100K reads)
- Over 100 emails/day → SendGrid Essentials ($20/month)
- Custom domain: $1–12/year depending on registrar

**Scaling estimate for 500+ active volunteers:**
- Firebase: ~$5–15/month
- Vercel: Still free
- Email: ~$20/month if using notifications

---

## Future Enhancements

1. **Email Notifications** — Firebase Cloud Functions + SendGrid for event reminders
2. **Monthly Leaderboard Reset** — Scheduled Cloud Function on the 1st of each month
3. **PWA Support** — Add service worker for offline access and push notifications
4. **CSV Export** — Download attendance reports as CSV from admin dashboard
5. **Self Check-In** — QR code per event, volunteers scan to check themselves in
6. **Ministry-Specific Dashboards** — Ministry leaders see only their team's data
7. **Volunteer Availability** — Set weekly availability, auto-suggest events
8. **SMS Notifications** — Twilio integration for text reminders
