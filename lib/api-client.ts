/**
 * API Client for DemoMed Healthcare API with retry logic and pagination support.
 */
import type { Patient, PatientsResponse, AssessmentSubmission, AssessmentResponse } from './types';

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://assessment.ksensetech.com/api';
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || '';

/**
 * Sleep for a specified number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Make an API request with retry logic.
 *
 * Handles:
 * - Rate limiting (429): Retries with exponential backoff
 * - Intermittent failures (500/503): Retries with exponential backoff (~8% chance)
 * - Malformed JSON responses: Retries if JSON parsing fails
 */
async function makeRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  maxRetries: number = 5,
  retryDelay: number = 1000
): Promise<T | null> {
  const url = `${BASE_URL}${endpoint}`;
  let delay = retryDelay;

  // Build headers - only include Content-Type for POST/PUT requests with a body
  const headers: Record<string, string> = {
    'x-api-key': API_KEY,
  };

  // Only add Content-Type if there's a body (POST/PUT requests)
  if (options.body && (options.method === 'POST' || options.method === 'PUT')) {
    headers['Content-Type'] = 'application/json';
  }

  // Merge any additional headers from options
  if (options.headers) {
    if (options.headers instanceof Headers) {
      options.headers.forEach((value, key) => {
        headers[key] = value;
      });
    } else if (Array.isArray(options.headers)) {
      // Handle array of [key, value] pairs
      options.headers.forEach(([key, value]) => {
        headers[key] = value;
      });
    } else {
      // Handle Record<string, string>
      Object.assign(headers, options.headers);
    }
  }

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      // Success
      if (response.status === 200) {
        try {
          const data = await response.json();
          return data as T;
        } catch (jsonError) {
          // Handle malformed JSON responses
          if (attempt < maxRetries - 1) {
            await sleep(delay);
            delay *= 2;
            continue;
          }
          return null;
        }
      }

      // Rate limiting - wait and retry
      if (response.status === 429) {
        if (attempt < maxRetries - 1) {
          await sleep(delay);
          delay *= 2; // Exponential backoff
          continue;
        } else {
          return null;
        }
      }

      // Server errors - retry
      if (response.status === 500 || response.status === 503) {
        if (attempt < maxRetries - 1) {
          await sleep(delay);
          delay *= 2;
          continue;
        } else {
          return null;
        }
      }

      // Other errors - don't retry
      return null;
    } catch (error) {
      if (attempt < maxRetries - 1) {
        await sleep(delay);
        delay *= 2;
      } else {
        return null;
      }
    }
  }

  return null;
}

/**
 * Fetch a page of patients.
 */
export async function getPatients(page: number = 1, limit: number = 5): Promise<PatientsResponse | null> {
  const endpoint = `/patients?page=${page}&limit=${limit}`;
  return makeRequest<PatientsResponse>(endpoint);
}

/**
 * Fetch all patients by paginating through all pages.
 *
 * Handles:
 * - Pagination: Automatically fetches all pages (~10 pages, ~50 patients)
 * - Rate limiting: Adds delays between page requests
 * - Inconsistent responses: Handles multiple response formats and missing fields
 * - Missing patient data: Filters out invalid patients and normalizes field names
 */
export async function getAllPatients(limit: number = 20): Promise<Patient[] | null> {
  const allPatients: Patient[] = [];
  let page = 1;
  let hasNext = true;
  let consecutiveFailures = 0;
  const maxConsecutiveFailures = 3;

  while (hasNext) {
    // Ensure sequential processing - await each request before proceeding
    let response: PatientsResponse | null = null;
    let retryCount = 0;
    const maxPageRetries = 3;

    // Retry logic for individual page requests
    while (retryCount < maxPageRetries && response === null) {
      response = await getPatients(page, limit);

      if (response === null) {
        retryCount++;
        if (retryCount < maxPageRetries) {
          // Exponential backoff for failed page requests
          const backoffDelay = Math.min(1000 * Math.pow(2, retryCount), 5000);
          await sleep(backoffDelay);
        }
      }
    }

    if (response === null) {
      consecutiveFailures++;

      if (consecutiveFailures >= maxConsecutiveFailures) {
        break;
      }

      // Wait longer before trying next page after failure
      await sleep(2000);
      page++;
      continue;
    }

    // Reset consecutive failures on success
    consecutiveFailures = 0;

    // Handle different response formats (inconsistent responses)
    let patients: Patient[] = [];
    const responseAny = response as any;

    // Try multiple possible response formats
    if (Array.isArray(response)) {
      // Response is directly an array of patients
      patients = response;
    } else if (responseAny?.data && Array.isArray(responseAny.data)) {
      // Standard format: { data: [...], pagination: {...} }
      patients = responseAny.data;
    } else if (responseAny?.patients && Array.isArray(responseAny.patients)) {
      // Alternative format: { patients: [...] }
      patients = responseAny.patients;
    } else if (responseAny?.results && Array.isArray(responseAny.results)) {
      // Another alternative: { results: [...] }
      patients = responseAny.results;
    } else {
      // Unknown format, try to extract any array
      // Try to find any array in the response
      for (const key in responseAny) {
        if (Array.isArray(responseAny[key])) {
          patients = responseAny[key];
          break;
        }
      }
    }

    // Filter out invalid patients (handle missing fields)
    const validPatients = patients.filter((p: any) => {
      // At minimum, patient should have an ID
      return p && (p.patient_id || p.id || p.patientId || p.PatientID);
    });

    // Normalize patient IDs to ensure consistency (handle inconsistent field names)
    const normalizedPatients = validPatients.map((p: any) => {
      // Ensure patient_id field exists with a valid value
      if (!p.patient_id) {
        p.patient_id = p.id || p.patientId || p.PatientID;
      }
      // Ensure other required fields have defaults if missing (handle missing fields)
      if (!p.name) p.name = '';
      if (!p.age) p.age = '';
      if (!p.gender) p.gender = '';
      if (!p.blood_pressure) p.blood_pressure = '';
      if (!p.temperature) p.temperature = '';
      if (!p.visit_date) p.visit_date = '';
      if (!p.diagnosis) p.diagnosis = '';
      if (!p.medications) p.medications = '';
      return p as Patient;
    });

    if (normalizedPatients.length === 0) {
      // No valid patients on this page, check if we should continue
      if (page === 1) {
        // If first page has no patients, something is wrong
        break;
      }
      // If later pages have no patients, we're done
      hasNext = false;
      break;
    }

    allPatients.push(...normalizedPatients);

    // Check pagination (handle inconsistent pagination formats)
    let paginationInfo: any = null;
    if (responseAny?.pagination) {
      paginationInfo = responseAny.pagination;
    } else if (responseAny?.meta) {
      paginationInfo = responseAny.meta;
    } else if (responseAny?.pageInfo) {
      paginationInfo = responseAny.pageInfo;
    }

    if (paginationInfo) {
      // Use pagination info if available
      hasNext = paginationInfo.hasNext !== undefined
        ? paginationInfo.hasNext
        : paginationInfo.has_next !== undefined
        ? paginationInfo.has_next
        : (paginationInfo.page < paginationInfo.totalPages);
      page++;
    } else {
      // No pagination info - infer from data
      if (normalizedPatients.length < limit) {
        // Got fewer patients than requested, assume we're done
        hasNext = false;
      } else {
        // Got full page, continue to next page
        page++;
        // Safety check to avoid infinite loops
        if (page > 100) {
          break;
        }
      }
    }

    // Delay between requests to avoid rate limiting
    // Use a longer base delay and increase with each page to be more conservative
    // This helps avoid hitting rate limits when fetching multiple pages
    // Minimum 800ms delay, increasing with each page
    const delayMs = Math.max(800, 500 + (page * 100));

    await sleep(delayMs);
  }

  return allPatients.length > 0 ? allPatients : null;
}

/**
 * Submit assessment results to the API.
 */
export async function submitAssessment(
  highRiskPatients: string[],
  feverPatients: string[],
  dataQualityIssues: string[]
): Promise<AssessmentResponse | null> {
  const endpoint = '/submit-assessment';
  const payload: AssessmentSubmission = {
    high_risk_patients: highRiskPatients,
    fever_patients: feverPatients,
    data_quality_issues: dataQualityIssues,
  };

  return makeRequest<AssessmentResponse>(endpoint, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
