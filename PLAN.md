# Recipe Management App - Implementation Plan

## 1. Project Overview
A self-hosted, web-based, mobile-friendly application for managing, sharing, and viewing recipes. The app will be deployed via Docker on a home server and utilizes Google OAuth for user management.

## 2. Tech Stack
* **Framework:** Next.js (App Router) with TypeScript
* **Styling:** Tailwind CSS + shadcn/ui (for fast, accessible components)
* **Database:** PostgreSQL
* **ORM:** Prisma
* **Auth:** NextAuth.js (Google Provider)
* **Storage:** Local file system via Docker Volumes (for recipe images)
* **Deployment:** Docker Compose (App + Database)

## 3. Database Schema Requirements (Prisma)
The database must support the following models and relationships:
* **User:** ID, Email, Name, Role (ADMIN, USER), Google Provider ID.
* **Recipe:** ID, Title, Description, Instructions, ImagePath, Visibility (PRIVATE, PUBLIC), AuthorID (Relation to User).
* **Ingredient:** ID, Name.
* **Tag:** ID, Name.
* **RecipeIngredient:** Join table linking Recipe and Ingredient, including `Quantity` and `Unit` fields.
* **RecipeTag:** Join table linking Recipe and Tag.
* **UserHeartedTag:** Join table linking User and Tag (for personalized dashboard headers).

## 4. User Roles & Authentication
* **Authentication:** Strictly handled via Google OAuth. 
* **Admin Profile:** Can view, edit, and delete ALL recipes, ingredients, and tags on the server.
* **Common Profile:** Can create, view, edit, and delete their OWN recipes. Can view their own recipes and any recipe marked as `PUBLIC`.
* **Visibility:** Users can toggle their own recipes between `PRIVATE` and `PUBLIC`. 

## 5. Core Application Features
### 5.1 UI/UX Layout
* **Responsiveness:** Mobile-first design. 
* **Navigation:** Top navigation bar containing a Hamburger menu for mobile.
* **Actions Menu:** Create Recipe, View All Tags, View All Recipes, Account Settings, Login/Logout.
* **Recipe Cards:** Used globally to display recipes. Layout: Image on the left (or top on small mobile screens), bold title, short description, and small pill-badges for tags/ingredients if space permits.

### 5.2 Main Dashboard (Index Page)
The main page layout must be dynamically generated based on user preferences:
1.  **Hearted Tags Sections:** For every tag a user has "hearted", render a Header with the tag name. Below the header, render a horizontally scrollable or grid-based list of Recipe Cards that have that tag.
2.  **Divider:** A visual line/separator indicating the end of the hearted sections.
3.  **All Recipes List:** An alphabetical, paginated (or infinite scroll) list of all recipes the user has permission to view.
4.  **Filtering:** A robust multi-select filter allowing users to filter the "All Recipes" view by multiple tags and ingredients simultaneously.

### 5.3 Recipe Management (CRUD)
* **Creation/Editing:** A form to input Title, Description, and Instructions.
* **Dynamic Inputs:** Users can dynamically add/remove ingredients and tags within the form. If an ingredient or tag doesn't exist in the database, it should be created seamlessly.
* **Image Upload:** A file input to attach an image. The backend must save this to a local public directory (e.g., `/public/uploads/recipes`) and store the path in the DB.

## 6. Deployment Strategy
* **Docker Compose:** Create a `docker-compose.yml` that defines two services:
    1.  `db`: The PostgreSQL database instance with a persistent volume.
    2.  `app`: The Next.js application, built via a `Dockerfile`.
* **Volumes:** Ensure the `uploads` directory is mapped to a persistent volume on the host machine so images survive container restarts.
* **Environment Variables:** Provide a `.env.example` detailing `DATABASE_URL`, `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, and `GOOGLE_CLIENT_SECRET`.

## 7. Recommended Implementation Phases for Agent
1.  **Phase 1:** Scaffold Next.js project, setup Tailwind/shadcn, define Docker & Postgres environment.
2.  **Phase 2:** Define Prisma schema, run initial migrations, and implement NextAuth with Google.
3.  **Phase 3:** Build backend API routes/Server Actions for CRUD operations on Recipes, Tags, and Ingredients.
4.  **Phase 4:** Implement image upload logic handling local file storage.
5.  **Phase 5:** Build out UI components (Nav, Recipe Card, Forms).
6.  **Phase 6:** Assemble the Main Dashboard logic (Hearted Tags headers, alphabetical list, complex multi-filtering).

## 8. Post-Core Additions (Future Enhancements)
Once the core functionality is stable, the following features should be implemented:
* **8.1 Image Optimization:** Integrate an image processing library (like `sharp`) into the upload pipeline to automatically compress and resize uploaded images to standard dimensions before saving them to disk, optimizing server storage.
* **8.2 Serving Scaling:** Add a `Servings` integer to the Recipe model. Implement frontend UI controls to double, halve, or custom-scale the recipe, which will dynamically recalculate and display the updated ingredient quantities.
* **8.3 URL Import/Scraping:** Build a feature allowing users to paste a URL from popular recipe websites. The backend should automatically scrape and parse the title, ingredients, instructions, and main image, populating the "Create Recipe" form automatically to save manual entry time.