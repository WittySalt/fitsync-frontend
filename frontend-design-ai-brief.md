# FitSync Frontend Design Brief for AI UI Generation

## 1. Product Context

FitSync is a fitness and diet management application backed by a Spring Boot service-oriented backend.

The frontend should be a responsive web application for:

- user onboarding
- profile and preference setup
- body metric tracking
- goal management
- workout planning and logging
- nutrition and meal logging
- progress visualization
- dashboard summaries

The product should feel like a practical health and training companion, not a marketing landing page.

Reference style direction:

- Keep-like mobile fitness app structure
- fast daily logging
- clear progress feedback
- simple settings grouped by health, training, nutrition, reminders, and privacy

Do not copy Keep branding or visual identity. Use it only as an interaction reference.

---

## 2. Target Frontend Stack

Preferred project direction:

- Angular 18+
- TypeScript
- Angular Router
- Reactive Forms
- Angular Material
- Tailwind CSS
- RxJS
- HTTP Interceptors
- Route Guards
- Chart.js or ng2-charts

State management:

- start with Angular services and RxJS
- add NgRx only if app state becomes complex enough

---

## 3. Design Principles

The UI should prioritize:

- fast daily actions
- clear health and fitness summaries
- low-friction forms
- readable charts
- strong empty states
- mobile-first layouts
- desktop layouts with more data density

Avoid:

- landing-page style hero sections
- decorative dashboards with no workflow value
- oversized cards for every section
- social-feed-first design
- medical diagnosis wording
- AI-generated health claims without deterministic data support

Tone:

- calm
- practical
- direct
- health-aware
- not overly playful

---

## 4. Main Navigation

Mobile bottom navigation:

```text
Home | Workout | Nutrition | Progress | Me
```

Desktop sidebar navigation:

```text
Dashboard
Workout
Nutrition
Progress
Profile
Settings
```

Global actions:

- add body metric
- log meal
- start workout
- add goal

---

## 5. Application Routes

Suggested route map:

```text
/auth/login
/auth/register
/auth/callback
/logout/callback

/onboarding
/dashboard

/workout
/workout/plans
/workout/plans/new
/workout/plans/:planId
/workout/sessions
/workout/sessions/new
/workout/sessions/:sessionId
/workout/exercises

/nutrition
/nutrition/meals
/nutrition/meals/new
/nutrition/meals/:mealId
/nutrition/foods
/nutrition/custom-foods

/progress
/progress/body
/progress/goals

/me
/settings/profile
/settings/preferences
/settings/goals
/settings/notifications
/settings/privacy
```

---

## 6. Auth Experience

Auth should support FitSync-owned Angular pages backed by Cognito User Pool APIs as the target flow.

Expected flow:

1. user signs up in the FitSync auth page
2. frontend calls Cognito `SignUp`
3. user confirms the email code in the FitSync auth page
4. frontend calls Cognito `ConfirmSignUp`
5. frontend signs in with Cognito `InitiateAuth`
6. frontend calls `POST /api/v1/auth/bootstrap` with the Cognito ID token
7. frontend stores the returned local FitSync JWT
8. frontend calls `GET /api/v1/auth/me`
9. protected routes become available

Temporary compatibility screens may support:

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/register`

Auth UI states:

- loading while submitting auth forms
- loading while hydrating current user
- invalid confirmation code error
- expired session
- unauthenticated route guard redirect

Security constraints:

- do not store client secrets in frontend code
- send bearer token through an HTTP interceptor
- never expose raw tokens in UI

---

## 7. Onboarding Flow

The onboarding should be a short multi-step flow after first sign-in.

### Step 1: Basic Profile

Fields:

- display name
- first name
- last name
- gender
- birth date
- height
- activity level
- timezone

API:

```text
PUT /api/v1/users/me/profile
```

### Step 2: Body Metrics

Fields:

- weight
- body fat rate
- waist
- hip
- chest
- arm
- thigh
- calf
- measured at
- note

API:

```text
POST /api/v1/users/me/body-metrics
```

### Step 3: Goals

Goal types:

- weight
- calories
- protein
- workout frequency
- steps

Fields:

- target value
- target unit
- target date
- status
- notes

API:

```text
PUT /api/v1/users/me/goals/{goalType}
```

### Step 4: Training Preferences

Fields:

- fitness level
- training location
- weekly workout days
- preferred duration
- preferred workout time
- intensity preference

API:

```text
PUT /api/v1/users/me/preferences
```

### Step 5: Nutrition and Notifications

Nutrition fields:

- dietary pattern
- meal frequency
- calorie tracking mode
- macro preference
- water goal

Notification fields:

- push enabled
- email enabled
- workout reminder
- meal reminder
- weigh-in reminder
- goal progress reminder
- marketing emails
- quiet hours

API:

```text
PUT /api/v1/users/me/preferences
```

Onboarding completion:

- mark `onboardingCompleted=true` in the profile payload
- route to `/dashboard`

---

## 8. Dashboard Page

Purpose:

- one glance at today
- quick entry into common logging workflows

Initial API composition:

```text
GET /api/v1/users/me
GET /api/v1/users/me/body-metrics/latest
GET /api/v1/workouts/sessions/latest
GET /api/v1/nutrition/meals/latest
GET /api/v1/nutrition/summary/daily?date={today}&timezone={timezone}
GET /api/v1/users/me/goals?status=ACTIVE
```

Future replacement:

```text
GET /api/v1/analytics/dashboard
```

Primary sections:

- greeting and current date
- today's calories
- protein progress
- latest body metrics
- latest workout
- latest meal
- active goals
- quick actions

Suggested dashboard layout:

```text
Header
- avatar
- display name
- date
- add button

Today Summary
- calories consumed / target
- protein / target
- weight
- BMI

Quick Actions
- Log Meal
- Start Workout
- Record Weight
- Update Goal

Activity Feed
- latest meal
- latest workout
- latest body metric

Goal Progress
- compact progress rows
```

Loading states:

- skeleton metric cards
- disabled quick actions while auth state is unresolved

Empty states:

- no body metric: prompt to record weight
- no meal: prompt to log first meal
- no workout: prompt to start or create a plan
- no goal: prompt to set a target

---

## 9. Workout Feature

Main tabs:

```text
Plans | Sessions | Exercises
```

### Workout Plans

APIs:

```text
GET /api/v1/workouts/plans
POST /api/v1/workouts/plans
GET /api/v1/workouts/plans/{planId}
PUT /api/v1/workouts/plans/{planId}
DELETE /api/v1/workouts/plans/{planId}
```

UI:

- plan list
- status filter: draft, active, archived
- create plan form
- edit plan form
- plan detail screen
- archive action

Plan form fields:

- name
- description
- goal focus
- workout type
- difficulty
- estimated duration
- exercise blueprint

Exercise blueprint fields:

- exercise
- sequence
- target sets
- target reps
- target weight
- target duration
- target distance
- rest seconds
- notes
- optional set targets

### Workout Sessions

APIs:

```text
GET /api/v1/workouts/sessions
POST /api/v1/workouts/sessions
GET /api/v1/workouts/sessions/latest
GET /api/v1/workouts/sessions/{sessionId}
PUT /api/v1/workouts/sessions/{sessionId}
DELETE /api/v1/workouts/sessions/{sessionId}
```

UI:

- calendar or date-range list
- status filter: planned, in progress, completed, cancelled
- create session from plan
- create manual session
- session detail
- correction/edit flow
- delete mistaken session

Session form fields:

- plan
- name
- workout type
- status
- source
- started at
- completed at
- duration
- calories burned
- perceived exertion
- notes
- exercise logs

### Exercises

APIs:

```text
GET /api/v1/workouts/exercises
POST /api/v1/workouts/exercises
```

Filters:

- search query
- exercise type
- primary muscle group
- equipment
- difficulty

UI:

- exercise catalog
- custom exercise creation
- compact filters
- exercise cards with type, muscle group, equipment, and difficulty

---

## 10. Nutrition Feature

Main tabs:

```text
Today | Meals | Foods | Custom Foods
```

### Today Nutrition

API:

```text
GET /api/v1/nutrition/summary/daily?date={date}&timezone={timezone}
```

UI:

- calorie progress
- protein, carbs, fat progress
- meal count
- remaining values
- add meal action

### Meal Logging

APIs:

```text
GET /api/v1/nutrition/meals
POST /api/v1/nutrition/meals
GET /api/v1/nutrition/meals/latest
GET /api/v1/nutrition/meals/{mealId}
PUT /api/v1/nutrition/meals/{mealId}
DELETE /api/v1/nutrition/meals/{mealId}
```

Meal groups:

- breakfast
- lunch
- dinner
- snack
- supper
- other

Meal fields:

- meal type
- name
- source
- consumed at
- timezone
- note
- items

Meal item fields:

- food name
- brand name
- quantity
- unit
- serving size
- serving unit
- calories
- protein
- carbs
- fat
- fiber
- sugar
- sodium
- nutrient details

### Food Search

APIs:

```text
GET /api/v1/nutrition/foods/search?q={query}
GET /api/v1/nutrition/foods/{foodId}
GET /api/v1/nutrition/foods/{foodId}/servings
GET /api/v1/nutrition/barcodes/{barcode}
POST /api/v1/nutrition/foods/{foodId}/clone
```

UI:

- search input
- food result list
- serving selector
- quantity input
- add to meal action
- barcode lookup placeholder
- clone food action

### Custom Foods

APIs:

```text
GET /api/v1/nutrition/custom-foods
POST /api/v1/nutrition/custom-foods
GET /api/v1/nutrition/custom-foods/{customFoodId}
PUT /api/v1/nutrition/custom-foods/{customFoodId}
DELETE /api/v1/nutrition/custom-foods/{customFoodId}
```

UI:

- custom food list
- create custom food
- edit custom food
- delete custom food

---

## 11. Progress Feature

Initial APIs:

```text
GET /api/v1/users/me/body-metrics
GET /api/v1/users/me/body-metrics/trends
GET /api/v1/users/me/goals
```

Future analytics APIs:

```text
GET /api/v1/analytics/body/trends
GET /api/v1/analytics/workouts/summary
GET /api/v1/analytics/nutrition/summary
GET /api/v1/analytics/goals/progress
```

UI:

- body metric trend chart
- weight change card
- BMI trend
- body fat trend
- waist trend
- goal progress list
- date range filter

Chart requirements:

- readable labels
- empty-state handling
- date range selection
- metric toggle
- mobile-friendly chart height

---

## 12. Profile and Settings

Settings groups:

```text
Account
Profile
Goals
Training
Nutrition
Notifications
Privacy and App
```

### Account

Fields and actions:

- avatar
- display name
- email
- sign out

### Profile

Fields:

- display name
- first name
- last name
- avatar URL
- birth date
- gender
- height
- activity level
- timezone
- bio

API:

```text
GET /api/v1/users/me/profile
PUT /api/v1/users/me/profile
```

### Preferences

APIs:

```text
GET /api/v1/users/me/preferences
PUT /api/v1/users/me/preferences
```

App preferences:

- preferred units
- language
- timezone
- privacy level
- data sharing consent

Training preferences:

- fitness level
- training location
- weekly workout days
- preferred duration
- preferred workout time
- intensity preference

Nutrition preferences:

- dietary pattern
- meal frequency
- calorie tracking mode
- macro preference
- water goal

Notification preferences:

- push enabled
- email enabled
- workout reminder
- meal reminder
- weigh-in reminder
- goal progress reminder
- marketing emails
- quiet hours

### Goals

APIs:

```text
GET /api/v1/users/me/goals
PUT /api/v1/users/me/goals/{goalType}
```

UI:

- active goals
- paused goals
- completed goals
- goal creation/edit form

---

## 13. Visual Direction

Recommended palette:

- health green for completion and body progress
- blue for workout
- orange for nutrition
- neutral gray for structure
- limited purple for analytics accents only

Avoid a one-note palette dominated by one hue.

Layout:

- mobile-first
- bottom nav on mobile
- sidebar on desktop
- fixed top context header
- cards only for repeated records or summary blocks
- avoid card-inside-card layouts

Components:

- icon buttons for compact actions
- segmented controls for tabs and filters
- toggles for notification settings
- sliders or steppers for numeric targets when useful
- date pickers for date ranges and body metric timestamps
- forms with inline validation messages

Cards:

- maximum 8px border radius unless the chosen design system enforces otherwise
- clear hierarchy
- no decorative bokeh, gradient orbs, or purely atmospheric backgrounds

Typography:

- compact headings inside dashboards and forms
- no viewport-width-based font scaling
- no negative letter spacing

---

## 14. Required UX States

Every data-backed page should include:

- loading state
- error state
- empty state
- retry action when useful
- form validation errors
- disabled submitting state
- success feedback after mutation

Mutation flows should:

- prevent duplicate submit
- show server validation errors
- preserve user input after failed submit
- route or refresh data after success

---

## 15. API Error Handling

Assume backend returns structured API errors.

Frontend behavior:

- show field-level validation where possible
- show page-level alert for load failures
- show auth expiration state for 401
- show access denied state for 403
- show not found state for owned resource 404
- do not expose stack traces or raw technical details to users

---

## 16. Backend Capability Notes

Currently implemented or designed backend domains:

- auth-service
- user-service
- workout-service
- nutrition-service
- analytics-service design
- recommendation-service design
- notification-service design

Important implementation note:

- dashboard can initially compose user, workout, and nutrition APIs
- once analytics-service is implemented, dashboard should use analytics APIs
- recommendation and notification UI should remain lightweight placeholders until those services expose stable product APIs
- current gateway code may need route support for workout and nutrition APIs before a single frontend base URL can be used

---

## 17. Suggested MVP Delivery Order

### MVP 1

- auth shell
- protected app layout
- onboarding
- profile
- preferences
- goals
- body metrics
- basic dashboard

### MVP 2

- workout plans
- workout sessions
- exercise catalog

### MVP 3

- meal logging
- food search
- custom foods
- daily nutrition summary

### MVP 4

- progress charts
- analytics API integration
- recommendation placeholders
- notification settings polish

---

## 18. Design Output Expected from AI

When using this brief with a UI design AI, ask it to produce:

- responsive app shell
- mobile and desktop layouts
- high-fidelity screens for the main routes
- reusable component system
- form layouts
- dashboard cards
- empty/loading/error states
- navigation behavior
- color and typography tokens

Minimum screen set:

```text
Login
Onboarding
Dashboard
Workout Plans
Workout Session Form
Exercise Catalog
Nutrition Today
Meal Form
Food Search
Progress
Profile Settings
Notification Settings
```

The generated design should be implementation-ready for Angular with Angular Material and Tailwind CSS.
