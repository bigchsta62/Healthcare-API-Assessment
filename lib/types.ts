/**
 * Type definitions for the Healthcare API Assessment.
 */

export interface Patient {
  patient_id: string;
  name: string;
  age: number | string;
  gender: string;
  blood_pressure: string;
  temperature: number | string;
  visit_date: string;
  diagnosis: string;
  medications: string;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface Metadata {
  timestamp: string;
  version: string;
  requestId: string;
}

export interface PatientsResponse {
  data: Patient[];
  pagination: PaginationInfo;
  metadata: Metadata;
}

export interface AssessmentSubmission {
  high_risk_patients: string[];
  fever_patients: string[];
  data_quality_issues: string[];
}

export interface BreakdownDetails {
  score: number;
  max: number;
  correct: number;
  submitted: number;
  matches: number;
}

export interface AssessmentBreakdown {
  high_risk: BreakdownDetails;
  fever: BreakdownDetails;
  data_quality: BreakdownDetails;
}

export interface AssessmentFeedback {
  strengths: string[];
  issues: string[];
}

export interface AssessmentResults {
  score: number;
  percentage: number;
  status: string;
  breakdown: AssessmentBreakdown;
  feedback: AssessmentFeedback;
  attempt_number: number;
  remaining_attempts: number;
  is_personal_best: boolean;
  can_resubmit: boolean;
}

export interface AssessmentResponse {
  success: boolean;
  message: string;
  results: AssessmentResults;
}

export interface PatientWithRisk extends Patient {
  bpScore: number;
  tempScore: number;
  ageScore: number;
  totalRisk: number;
  hasFever: boolean;
  hasDataQualityIssue: boolean;
}
