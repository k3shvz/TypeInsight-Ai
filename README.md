# TypeInsight AI

TypeInsight AI is a modern, responsive, privacy-first typing analytics web app. It analyzes typing behavior only after explicit opt-in and stores aggregate metrics locally in the browser.

## Privacy Model

- Requires explicit consent before metrics collection begins.
- Does not store, transmit, or export the actual text typed.
- Processes typing statistics locally in the browser.
- Saves only anonymized aggregate metrics such as WPM, accuracy, backspace count, pause count, duration, confidence, and key-frequency heatmap data.
- Includes a delete action to clear all locally stored analytics.

## Features

- Real-time WPM, accuracy, error rate, and confidence cards.
- AI-style performance summary, personalized suggestions, trend analysis, fatigue detection, and productivity insights.
- Typing rhythm chart rendered with Canvas.
- Keyboard heatmap that tracks key frequency only.
- Session history with local persistence.
- CSV export and print-to-PDF analytics export.
- Light and dark mode support.
- Responsive layout for desktop, tablet, and mobile.
- Accessibility basics including skip link, focus states, semantic regions, dialog labels, and reduced-motion support.

## Run

Open `index.html` in a modern browser. No server or build step is required.

## Files

- `index.html` - Application markup and dashboard structure.
- `styles.css` - Responsive glassmorphism design system.
- `app.js` - Local-only analytics, charting, heatmap, history, exports, and privacy controls.
