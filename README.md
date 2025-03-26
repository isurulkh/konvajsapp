# Polygon Drawing Tool

A React-based interactive polygon drawing tool built with Konva.js that allows users to create, edit, and measure polygons with precision.

## Features

- **Interactive Drawing**: Click to create polygon vertices, with automatic closing when clicking near the starting point
- **Grid System**: Optional grid display with snap-to-grid functionality for precise drawing
- **Measurement Tools**: Real-time calculations of:
  - Polygon area
  - Perimeter length
  - Width and height dimensions
- **Editing Capabilities**:
  - Drag vertices to adjust polygon shape
  - Delete vertices with right-click
  - Move entire polygon
  - Zoom in/out functionality
- **Customization Options**:
  - Adjustable line thickness
  - Color selection
  - Scale/DPI settings for accurate measurements
  - Toggle dimension display

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

## Running the Application

1. Start the development server:
   ```bash
   npm start
   ```
2. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage Guide

### Drawing a Polygon
1. Click anywhere on the canvas to start drawing
2. Continue clicking to add vertices
3. Close the polygon by clicking near the starting point

### Editing
- **Move Vertices**: Hover over a vertex and drag
- **Delete Vertices**: Right-click on a vertex
- **Move Polygon**: Click and drag anywhere on the polygon
- **Zoom**: Use mouse wheel to zoom in/out

### Measurement Settings
- Adjust scale and DPI settings for accurate real-world measurements
- Toggle dimension display using the toolbar
- View real-time measurements as you draw or edit

## Dependencies

- React
- Konva.js
- React-Konva

## Development Scripts

- `npm start`: Runs the app in development mode
- `npm test`: Launches the test runner
- `npm run build`: Builds the app for production
- `npm run eject`: Ejects from Create React App