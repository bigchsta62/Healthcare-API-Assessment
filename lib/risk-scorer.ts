/**
 * Risk scoring functions for patient data.
 */
import type { Patient, PatientWithRisk } from './types';

/**
 * Parse blood pressure string into systolic and diastolic values.
 */
export function parseBloodPressure(bp: unknown): [number | null, number | null] {
  if (bp === null || bp === undefined || bp === '') {
    return [null, null];
  }

  // Convert to string if not already
  const bpStr = String(bp).trim();

  if (!bpStr || ['N/A', 'INVALID', 'NULL', 'NONE'].includes(bpStr.toUpperCase())) {
    return [null, null];
  }

  // Check for "/" separator
  if (!bpStr.includes('/')) {
    return [null, null];
  }

  const parts = bpStr.split('/');
  if (parts.length !== 2) {
    return [null, null];
  }

  try {
    const systolicStr = parts[0].trim();
    const diastolicStr = parts[1].trim();

    // Check for empty strings (e.g., "150/" or "/90")
    // Must have both systolic and diastolic values
    if (!systolicStr || !diastolicStr || systolicStr.length === 0 || diastolicStr.length === 0) {
      return [null, null];
    }

    // Validate that both parts are numeric strings (only digits)
    // This catches cases like "150/" where diastolic is empty
    if (!/^\d+$/.test(systolicStr) || !/^\d+$/.test(diastolicStr)) {
      return [null, null];
    }

    const systolic = parseInt(systolicStr, 10);
    const diastolic = parseInt(diastolicStr, 10);

    // Final check for NaN (shouldn't happen with regex check above, but defensive)
    if (isNaN(systolic) || isNaN(diastolic)) {
      return [null, null];
    }

    return [systolic, diastolic];
  } catch {
    return [null, null];
  }
}

/**
 * Calculate blood pressure risk score.
 * Rules:
 * - Normal (Systolic <120 AND Diastolic <80): 0 points
 * - Elevated (Systolic 120-129 AND Diastolic <80): 1 point
 * - Stage 1 (Systolic 130-139 OR Diastolic 80-89): 2 points
 * - Stage 2 (Systolic ≥140 OR Diastolic ≥90): 3 points
 *
 * Note: If systolic and diastolic readings fall into different risk categories,
 * use the higher risk stage for scoring.
 */
export function calculateBpRisk(bp: unknown): number {
  const [systolic, diastolic] = parseBloodPressure(bp);

  if (systolic === null || diastolic === null) {
    return 0;
  }

  // Check Stage 2 first (highest risk) - Systolic ≥140 OR Diastolic ≥90 → 3 points
  if (systolic >= 140 || diastolic >= 90) {
    return 3;
  }

  // Check Stage 1 - Systolic 130-139 OR Diastolic 80-89 → 2 points
  if ((systolic >= 130 && systolic < 140) || (diastolic >= 80 && diastolic < 90)) {
    return 2;
  }

  // Check Elevated - Systolic 120-129 AND Diastolic <80 → 1 point
  if (systolic >= 120 && systolic < 130 && diastolic < 80) {
    return 1;
  }

  // Check Normal - Systolic <120 AND Diastolic <80 → 0 points
  if (systolic < 120 && diastolic < 80) {
    return 0;
  }

  // Fallback: Determine individual stages and use higher (for edge cases)
  let sysStage = 0; // Normal
  if (systolic >= 140) {
    sysStage = 3; // Stage 2
  } else if (systolic >= 130) {
    sysStage = 2; // Stage 1
  } else if (systolic >= 120) {
    sysStage = 1; // Elevated
  }

  let diaStage = 0; // Normal
  if (diastolic >= 90) {
    diaStage = 3; // Stage 2
  } else if (diastolic >= 80) {
    diaStage = 2; // Stage 1
  }

  // Use the higher risk stage (as per "higher risk stage" rule)
  return Math.max(sysStage, diaStage);
}

/**
 * Parse temperature value.
 */
export function parseTemperature(temp: unknown): number | null {
  if (temp === null || temp === undefined || temp === '') {
    return null;
  }

  // If it's already a number, validate and return it
  if (typeof temp === 'number') {
    if (isNaN(temp) || !isFinite(temp)) {
      return null;
    }
    // Round to 1 decimal place to avoid floating point precision issues
    return Math.round(temp * 10) / 10;
  }

  // Convert to string and check for invalid values
  const tempStr = String(temp).trim().toUpperCase();

  // Check for common invalid strings first
  if (['N/A', 'INVALID', 'NULL', 'NONE', 'TEMP_ERROR'].includes(tempStr)) {
    return null;
  }

  // Try to convert to float
  try {
    const tempFloat = parseFloat(tempStr);
    if (isNaN(tempFloat) || !isFinite(tempFloat)) {
      return null;
    }
    // Round to 1 decimal place to avoid floating point precision issues
    // This ensures 99.0, 99, and "99.0" all become 99.0
    return Math.round(tempFloat * 10) / 10;
  } catch {
    return null;
  }
}

/**
 * Calculate temperature risk score.
 */
export function calculateTemperatureRisk(temp: unknown): number {
  const tempValue = parseTemperature(temp);

  if (tempValue === null) {
    return 0;
  }

  // Use explicit comparisons with rounding to avoid floating point precision issues
  // Round to 1 decimal for consistent comparisons
  const roundedTemp = Math.round(tempValue * 10) / 10;

  if (roundedTemp <= 99.5) {
    return 0;
  } else if (roundedTemp <= 100.9) {
    return 1;
  } else {
    return 2;
  }
}

/**
 * Parse age value.
 */
export function parseAge(age: unknown): number | null {
  if (age === null || age === undefined || age === '') {
    return null;
  }

  // Try to convert to int
  try {
    const ageFloat = parseFloat(String(age));
    if (isNaN(ageFloat)) {
      return null;
    }
    const ageInt = Math.floor(ageFloat);
    return ageInt;
  } catch {
    // Check for common invalid strings
    const ageStr = String(age).trim().toUpperCase();
    if (['N/A', 'INVALID', 'NULL', 'NONE', 'UNKNOWN'].includes(ageStr)) {
      return null;
    }
    return null;
  }
}

/**
 * Calculate age risk score.
 */
export function calculateAgeRisk(age: unknown): number {
  const ageValue = parseAge(age);

  if (ageValue === null) {
    return 0;
  }

  if (ageValue < 40) {
    return 0;
  } else if (ageValue <= 65) {
    return 1;
  } else {
    return 2;
  }
}

/**
 * Calculate total risk score for a patient.
 */
export function calculateTotalRisk(patient: Patient): number {
  const bpScore = calculateBpRisk(patient.blood_pressure);
  const tempScore = calculateTemperatureRisk(patient.temperature);
  const ageScore = calculateAgeRisk(patient.age);

  return bpScore + tempScore + ageScore;
}

/**
 * Check if patient has data quality issues.
 */
export function hasDataQualityIssue(patient: Patient): boolean {
  const bp = patient.blood_pressure;
  const temp = patient.temperature;
  const age = patient.age;

  // Check BP
  const [systolic, diastolic] = parseBloodPressure(bp);
  if (systolic === null || diastolic === null) {
    return true;
  }

  // Check temperature
  const tempValue = parseTemperature(temp);
  if (tempValue === null) {
    return true;
  }

  // Check age
  const ageValue = parseAge(age);
  if (ageValue === null) {
    return true;
  }

  return false;
}

/**
 * Check if patient has fever (temperature >= 99.6°F).
 */
export function hasFever(patient: Patient): boolean {
  const tempValue = parseTemperature(patient.temperature);
  if (tempValue === null) {
    return false;
  }

  // Use rounded value for consistent comparison
  // Round to 1 decimal to avoid floating point precision issues
  const roundedTemp = Math.round(tempValue * 10) / 10;
  return roundedTemp >= 99.6;
}

/**
 * Calculate all risk scores and flags for a patient.
 */
export function calculatePatientRisk(patient: Patient): PatientWithRisk {
  const bpScore = calculateBpRisk(patient.blood_pressure);
  const tempScore = calculateTemperatureRisk(patient.temperature);
  const ageScore = calculateAgeRisk(patient.age);
  const totalRisk = bpScore + tempScore + ageScore;

  return {
    ...patient,
    bpScore,
    tempScore,
    ageScore,
    totalRisk,
    hasFever: hasFever(patient),
    hasDataQualityIssue: hasDataQualityIssue(patient),
  };
}
