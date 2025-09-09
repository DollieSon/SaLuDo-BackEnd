# Candidate Comparison Feature

## Overview

The Candidate Comparison feature allows HR managers and recruiters to compare two candidates side-by-side to make better hiring decisions. This feature provides comprehensive analysis including skills, personality traits, experience, education, and an overall recommendation.

## Features

### 1. Candidate Selection

- **Access**: Navigate to `/compare-candidates` or click "Compare" button in Candidate List
- **Selection Interface**: Choose two candidates from the available list
- **Search & Filter**: Find candidates easily using the search functionality
- **Visual Feedback**: Selected candidates are highlighted with badges

### 2. Comprehensive Comparison

#### Personal Information

- Age comparison with difference calculation
- Experience count comparison
- Certification count comparison
- Application status and role applied

#### Skills Analysis

- **Common Skills**: Skills shared by both candidates with score comparison
- **Unique Skills**: Skills that only one candidate possesses
- **Skill Score Comparison**: Side-by-side comparison of proficiency levels
- **Visual Charts**: Bar chart showing common skills performance

#### Personality Assessment

- **Overall Personality Score**: Aggregate personality assessment for each candidate
- **Category Breakdown**: Comparison across 6 personality categories:
  - Cognitive & Problem Solving
  - Communication & Teamwork
  - Work Ethic & Reliability
  - Growth & Leadership
  - Culture & Personality Fit
  - Bonus Traits
- **Radar Chart**: Visual representation of personality traits

#### Overall Recommendation

The system provides an intelligent recommendation based on:

- **Average Skill Scores** (40% weight)
- **Personality Assessment** (30% weight)
- **Total Skills Count** (20% weight)
- **Experience Count** (10% weight)

### 3. User Interface Components

#### CandidateSelector Component

- Located at: `src/components/CandidateSelector.tsx`
- Allows users to select two candidates for comparison
- Features search functionality and visual selection indicators

#### CandidateComparison Component

- Located at: `src/components/CandidateComparison.tsx`
- Displays comprehensive side-by-side comparison
- Includes interactive charts and detailed analysis

## API Endpoints

### Backend Implementation

#### Comparison Service

- **File**: `services/CandidateComparisonService.ts`
- **Main Method**: `compareCandidates(candidateId1, candidateId2)`
- **Returns**: Detailed comparison data with recommendations

#### REST Endpoint

- **Route**: `GET /api/candidates/:candidateId1/compare/:candidateId2`
- **Response**: JSON object containing complete comparison analysis

### Frontend API Integration

- **File**: `utils/api.ts`
- **Method**: `candidatesApi.compareCandidates(candidateId1, candidateId2)`

## Navigation Routes

### New Routes Added

1. `/compare-candidates` - Candidate selection interface
2. `/compare/:candidateId1/:candidateId2` - Comparison results view

### Access Points

1. **Candidate List**: "Compare" button in the header
2. **Profile Page**: "Compare" button in the candidate profile header

## Styling

### CSS Files

- `CandidateSelector.css` - Styles for candidate selection interface
- `CandidateComparison.css` - Styles for comparison results page
- Updated `CandidateList.css` - Added compare button styles
- Updated `Profile.css` - Added compare button styles

## Usage Instructions

1. **Start Comparison**:

   - Go to Candidate List and click "Compare" button
   - Or visit a candidate profile and click "Compare"

2. **Select Candidates**:

   - Choose first candidate by clicking on their card
   - Choose second candidate by clicking on their card
   - Both candidates will be highlighted with badges

3. **View Comparison**:

   - Click "Compare Candidates" button
   - Review the comprehensive comparison analysis
   - Use the recommendation to make informed decisions

4. **Navigation**:
   - Click "View Profile" to see individual candidate details
   - Use back button to return to previous page

## Technical Implementation

### Backend Logic

- Fetches both candidate profiles including personality data
- Performs statistical analysis and comparisons
- Calculates weighted recommendation scores
- Returns structured comparison data

### Frontend Features

- Responsive design for all screen sizes
- Interactive charts using Recharts library
- Real-time search and filtering
- Error handling and loading states

### Data Processing

- Skill comparison by skill ID
- Personality score aggregation by categories
- Age and experience calculations
- Recommendation algorithm with weighted factors

## Future Enhancements

1. **Bulk Comparison**: Compare more than 2 candidates
2. **Export Functionality**: Export comparison reports to PDF
3. **Custom Weights**: Allow users to adjust recommendation criteria weights
4. **Historical Comparisons**: Save and view previous comparisons
5. **Team Collaboration**: Share comparisons with team members
6. **Advanced Filters**: Filter candidates by specific criteria before comparison

## Benefits

1. **Objective Decision Making**: Data-driven candidate evaluation
2. **Time Efficiency**: Quick side-by-side analysis
3. **Comprehensive View**: Holistic candidate assessment
4. **Visual Insights**: Charts and graphs for better understanding
5. **Recommendation System**: AI-assisted hiring decisions
