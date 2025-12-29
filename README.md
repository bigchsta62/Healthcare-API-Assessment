# Healthcare API Assessment - Next.js Application

A patient risk scoring system built with Next.js and Tailwind CSS that integrates with the DemoMed Healthcare API to analyze patient data and identify high-risk patients, fever cases, and data quality issues.

## Overview

This Next.js application provides a web interface to:
- View patient data in a paginated table
- Calculate risk scores based on blood pressure, temperature, and age
- Identify high-risk patients, fever patients, and data quality issues
- Submit assessment results to the API
- View submission feedback and scores

## Features

### Risk Scoring
- **Blood Pressure Risk**: Categorizes BP readings (Normal, Elevated, Stage 1, Stage 2)
- **Temperature Risk**: Identifies normal, low fever, and high fever cases
- **Age Risk**: Categorizes patients by age groups
- **Total Risk Score**: Sum of all individual risk scores

### Data Quality
- Validates and parses blood pressure readings (handles malformed data)
- Validates temperature values
- Validates age values
- Identifies patients with missing or invalid data

### API Integration
- Automatic retry logic for rate limiting (429) and server errors (500, 503)
- Exponential backoff for retries
- Pagination support (20 patients per page)
- Handles inconsistent response formats

### User Interface
- Responsive Tailwind CSS design
- Patient data table with risk scores
- Alert lists summary cards
- Pagination controls
- Submission results display

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd Healthcare-API-Assessment
```

2. Install dependencies:
```bash
npm install
```

## Usage

### Development
Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production
Build and start the production server:
```bash
npm run build
npm start
```

## Configuration

The API key and base URL are configured in `lib/api-client.ts`. Update these values if needed:

```typescript
const BASE_URL = 'https://assessment.ksensetech.com/api';
const API_KEY = 'your-api-key-here';
```

## Project Structure

```
Healthcare-API-Assessment/
├── app/
│   ├── layout.tsx        # Root layout
│   ├── page.tsx          # Main page component
│   └── globals.css        # Global styles with Tailwind
├── lib/
│   ├── api-client.ts     # API client with retry logic
│   ├── risk-scorer.ts    # Risk scoring functions
│   └── types.ts          # TypeScript type definitions
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
├── tailwind.config.ts    # Tailwind CSS configuration
└── README.md            # This file
```

## Risk Scoring Details

### Blood Pressure Risk
- Normal (Systolic <120 AND Diastolic <80): 0 points
- Elevated (Systolic 120-129 AND Diastolic <80): 1 point
- Stage 1 (Systolic 130-139 OR Diastolic 80-89): 2 points
- Stage 2 (Systolic ≥140 OR Diastolic ≥90): 3 points
- Invalid/Missing: 0 points

### Temperature Risk
- Normal (≤99.5°F): 0 points
- Low Fever (99.6-100.9°F): 1 point
- High Fever (≥101.0°F): 2 points
- Invalid/Missing: 0 points

### Age Risk
- Under 40 (<40 years): 0 points
- 40-65 (40-65 years, inclusive): 1 point
- Over 65 (>65 years): 2 points
- Invalid/Missing: 0 points

## Error Handling

The system handles various error scenarios:
- API rate limiting (429 errors) with exponential backoff
- Server errors (500, 503) with retry logic
- Invalid or malformed data in patient records
- Missing required fields
- Network timeouts and connection errors

## Requirements

- Node.js 18+
- npm or yarn

## License

This project is created for assessment purposes.
