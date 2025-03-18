# Reboot Student Profile Page

A sleek, modern profile page built to explore and visualize student data using GraphQL, hosted at [arraymahdi.github.io](https://arraymahdi.github.io). This project leverages the GraphQL API provided by Reboot01 to display user information and generate insightful statistic graphs with a cosmic-themed UI.

## Project Overview

This project fulfills the objective of learning GraphQL by creating a dynamic profile page. It queries student data from the Reboot01 GraphQL endpoint (`https://learn.reboot01.com/api/graphql-engine/v1/graphql`) and includes a login system using JWT authentication via the signin endpoint (`https://learn.reboot01.com/api/auth/signin`). The front-end is built with HTML, CSS, and JavaScript, featuring SVG-based graphs for data visualization.

### Objectives
- Learn and implement GraphQL queries (normal, nested, and with arguments).
- Create a login page supporting username/email and password authentication.
- Display at least three pieces of user information (e.g., username, total XP, pass/fail ratio).
- Include a mandatory statistics section with at least two SVG graphs (e.g., XP over time, pass/fail ratio).
- Host the project publicly (deployed on GitHub Pages).

### Tech Stack
- **JavaScript**: 100.0 kB (core functionality and GraphQL queries)
- **GraphQL**: 20% (API integration)
- **Front-end**: 48% (HTML/CSS for UI)
- **SVG**: For graph generation
- **Hosting**: GitHub Pages (`arraymahdi.github.io`)

## Features
- **Login Page**: Authenticates users with username/email and password using Basic authentication (base64-encoded) and displays an error message for invalid credentials. Logout functionality included.
- **Profile Page**: Displays user data including:
  - Username
  - Total XP
  - Pass/Fail Ratio
- **Statistics Section**: Two SVG graphs:
  - XP Over Time (line graph)
  - Pass/Fail Ratio (bar graph)
- **UI Design**: A cosmic-themed interface with deep gradients, glowing effects, and a luxurious feel, built with responsive design principles.

## Setup and Deployment

### Prerequisites
- A modern web browser
- GitHub account for hosting
- Access to Reboot01 credentials for testing

### Installation
1. **Clone the Repository**:
   ```bash
   git clone https://github.com/arraymahdi/arraymahdi.github.io.git
   cd arraymahdi.github.io
   ```
2. **Open Locally**:
   - Open `index.html` in a browser to test locally.
3. **Deploy to GitHub Pages**:
   - Push changes to the `main` branch of your GitHub repository.
   - Ensure GitHub Pages is enabled in the repository settings (source: `main` branch).
   - Visit [arraymahdi.github.io](https://arraymahdi.github.io) to see the live site.

### Usage
1. Enter your Reboot01 username or email and password on the login page.
2. Upon successful login, view your profile with personal data and graphs.
3. Click "Logout" to return to the login screen.

## Project Structure
```
├── index.html       # Main HTML file with login and profile sections
├── style.css        # Cosmic-themed CSS for styling
├── script.js        # JavaScript for GraphQL queries, authentication, and SVG graphs
└── README.md        # Project documentation
```

## GraphQL Queries
The project uses the following query types:
- **Normal**: Fetch user ID and login.
- **Nested**: Retrieve results with associated user data.
- **Arguments**: Filter objects by ID.

Example query:
```graphql
{
  user {
    id
    login
    transaction {
      amount
      createdAt
    }
  }
}
```

## Hosting
Hosted on GitHub Pages at [arraymahdi.github.io](https://arraymahdi.github.io). Alternative hosting options include Netlify or Vercel.

## Acknowledgments
- Reboot01 for providing the GraphQL API and project guidelines.
- Inspired by cosmic design trends for an exceptional UI experience.
