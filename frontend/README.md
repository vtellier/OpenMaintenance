# OpenMaintenance Frontend

This is the React frontend for OpenMaintenance, a free and open-source web app for tracking maintenance tasks.

## Development

### Prerequisites
- Node.js
- npm

### Setup
1. Navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm start
   ```
   The app will open at [http://localhost:3000](http://localhost:3000).

### Build
To build the app for production:
```bash
npm run build
```
This creates a `build` directory with optimized and minified files.

## Deployment
To deploy the frontend with the Go backend:
1. Build the React app:
   ```bash
   npm run build
   ```
2. Copy the build files to the backend's static directory:
   ```bash
   cp -r build ../static
   ```
3. Run the Go backend to serve the React app:
   ```bash
   go run main.go
   ```
