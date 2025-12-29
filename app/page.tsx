'use client';

import { useState, useEffect } from 'react';
import { getPatients, getAllPatients, submitAssessment } from '@/lib/api-client';
import {
  calculatePatientRisk,
  calculateBpRisk,
  calculateTemperatureRisk,
  calculateAgeRisk,
  parseTemperature,
  hasDataQualityIssue
} from '@/lib/risk-scorer';
import type { Patient, PatientWithRisk, AssessmentResponse } from '@/lib/types';

const PATIENTS_PER_PAGE = 20;

export default function Home() {
  const [allPatients, setAllPatients] = useState<PatientWithRisk[]>([]);
  const [displayedPatients, setDisplayedPatients] = useState<PatientWithRisk[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<AssessmentResponse | null>(null);

  // Calculate alert lists from ALL patients
  // High-risk: totalRisk >= 4
  const highRiskPatients = allPatients
    .filter((p) => p.totalRisk >= 4)
    .map((p) => p.patient_id)
    .sort();

  const feverPatients = allPatients
    .filter((p) => p.hasFever)
    .map((p) => p.patient_id)
    .sort();

  const dataQualityIssues = allPatients
    .filter((p) => p.hasDataQualityIssue)
    .map((p) => p.patient_id)
    .sort();

  // Analyze submission results to identify issues
  const analyzeSubmission = () => {
    if (!submissionResult) return null;

    const breakdown = submissionResult.results.breakdown;

    return {
      highRisk: {
        submitted: highRiskPatients,
        expectedCount: breakdown.high_risk.correct,
        matchedCount: breakdown.high_risk.matches,
        incorrectlyIncluded: breakdown.high_risk.submitted - breakdown.high_risk.matches,
        missed: breakdown.high_risk.correct - breakdown.high_risk.matches,
      },
      fever: {
        submitted: feverPatients,
        expectedCount: breakdown.fever.correct,
        matchedCount: breakdown.fever.matches,
        missed: breakdown.fever.correct - breakdown.fever.matches,
      },
      dataQuality: {
        submitted: dataQualityIssues,
        expectedCount: breakdown.data_quality.correct,
        matchedCount: breakdown.data_quality.matches,
        missed: breakdown.data_quality.correct - breakdown.data_quality.matches,
      },
    };
  };

  const analysis = analyzeSubmission();


  // Fetch all patients on initial load
  useEffect(() => {
    async function fetchAllPatients() {
      setLoading(true);
      setError(null);

      try {
        const patients = await getAllPatients(20);

        if (!patients || patients.length === 0) {
          setError('Failed to fetch patients or no patients found.');
          setLoading(false);
          return;
        }

        // Calculate risk scores for each patient
        const patientsWithRisk = patients.map(calculatePatientRisk);

        setAllPatients(patientsWithRisk);
        setTotalPages(Math.ceil(patientsWithRisk.length / PATIENTS_PER_PAGE));
      } catch (err) {
        setError('An error occurred while fetching patients.');
      } finally {
        setLoading(false);
      }
    }

    fetchAllPatients();
  }, []);

  // Update displayed patients when page changes
  useEffect(() => {
    const startIndex = (currentPage - 1) * PATIENTS_PER_PAGE;
    const endIndex = startIndex + PATIENTS_PER_PAGE;
    setDisplayedPatients(allPatients.slice(startIndex, endIndex));
  }, [currentPage, allPatients]);

  // Handle submission
  const handleSubmit = async () => {
    if (submitting) return;

    setSubmitting(true);
    setSubmissionResult(null);

    try {
      const result = await submitAssessment(
        highRiskPatients,
        feverPatients,
        dataQualityIssues
      );

      if (result) {
        setSubmissionResult(result);
      } else {
        setError('Failed to submit assessment. Please try again.');
      }
    } catch (err) {
      setError('An error occurred while submitting the assessment.');
    } finally {
      setSubmitting(false);
    }
  };

  // Get risk badge color
  const getRiskBadgeColor = (risk: number) => {
    if (risk >= 4) return 'bg-red-100 text-red-800';
    if (risk >= 3) return 'bg-orange-100 text-orange-800';
    if (risk >= 2) return 'bg-yellow-100 text-yellow-800';
    return 'bg-green-100 text-green-800';
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-6">
              Healthcare API Assessment
            </h1>

            {/* Alert Lists Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h3 className="text-sm font-medium text-red-800 mb-2">
                  High-Risk Patients (Score ≥ 4)
                </h3>
                <p className="text-2xl font-bold text-red-900">{highRiskPatients.length}</p>
                <p className="text-xs text-red-600 mt-1">
                  {highRiskPatients.join(', ')}
                </p>
              </div>

              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <h3 className="text-sm font-medium text-orange-800 mb-2">
                  Fever Patients (≥ 99.6°F)
                </h3>
                <p className="text-2xl font-bold text-orange-900">{feverPatients.length}</p>
                <p className="text-xs text-orange-600 mt-1">
                  {feverPatients.join(', ')}
                </p>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h3 className="text-sm font-medium text-yellow-800 mb-2">
                  Data Quality Issues
                </h3>
                <p className="text-2xl font-bold text-yellow-900">{dataQualityIssues.length}</p>
                <p className="text-xs text-yellow-600 mt-1">
                  {dataQualityIssues.join(', ')}
                </p>
              </div>
            </div>

            {/* Submit Button */}
            <div className="mb-6">
              <button
                onClick={handleSubmit}
                disabled={submitting || loading}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                {submitting ? 'Submitting...' : 'Submit Assessment'}
              </button>
            </div>

            {/* Submission Results */}
            {submissionResult && (
              <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-green-900 mb-2">
                  Submission Results
                </h3>
                <div className="space-y-2 text-sm">
                  <p>
                    <span className="font-medium">Status:</span> {submissionResult.results.status}
                  </p>
                  <p>
                    <span className="font-medium">Score:</span>{' '}
                    {submissionResult.results.score.toFixed(2)} ({submissionResult.results.percentage}%)
                  </p>
                  <p>
                    <span className="font-medium">Attempt:</span> {submissionResult.results.attempt_number} / 3
                  </p>
                  <p>
                    <span className="font-medium">Remaining Attempts:</span>{' '}
                    {submissionResult.results.remaining_attempts}
                  </p>

                  {/* Breakdown Details */}
                  <div className="mt-4 space-y-2">
                    <div className="bg-white rounded p-3">
                      <p className="font-medium mb-2">High-Risk Patients:</p>
                      <p className="text-xs">
                        Score: {submissionResult.results.breakdown.high_risk.score}/{submissionResult.results.breakdown.high_risk.max} |
                        Matches: {submissionResult.results.breakdown.high_risk.matches}/{submissionResult.results.breakdown.high_risk.correct} correct |
                        Submitted: {submissionResult.results.breakdown.high_risk.submitted} |
                        Expected: {submissionResult.results.breakdown.high_risk.correct}
                      </p>
                      <p className="text-xs text-red-600 mt-1">
                        {submissionResult.results.breakdown.high_risk.submitted - submissionResult.results.breakdown.high_risk.matches} incorrectly included,{' '}
                        {submissionResult.results.breakdown.high_risk.correct - submissionResult.results.breakdown.high_risk.matches} missed
                      </p>
                    </div>
                    <div className="bg-white rounded p-3">
                      <p className="font-medium mb-2">Fever Patients:</p>
                      <p className="text-xs">
                        Score: {submissionResult.results.breakdown.fever.score}/{submissionResult.results.breakdown.fever.max} |
                        Matches: {submissionResult.results.breakdown.fever.matches}/{submissionResult.results.breakdown.fever.correct} correct |
                        Submitted: {submissionResult.results.breakdown.fever.submitted} |
                        Expected: {submissionResult.results.breakdown.fever.correct}
                      </p>
                      <p className="text-xs text-red-600 mt-1">
                        {submissionResult.results.breakdown.fever.correct - submissionResult.results.breakdown.fever.matches} missed
                      </p>
                    </div>
                    <div className="bg-white rounded p-3">
                      <p className="font-medium mb-2">Data Quality Issues:</p>
                      <p className="text-xs">
                        Score: {submissionResult.results.breakdown.data_quality.score}/{submissionResult.results.breakdown.data_quality.max} |
                        Matches: {submissionResult.results.breakdown.data_quality.matches}/{submissionResult.results.breakdown.data_quality.correct} correct |
                        Submitted: {submissionResult.results.breakdown.data_quality.submitted} |
                        Expected: {submissionResult.results.breakdown.data_quality.correct}
                      </p>
                      <p className="text-xs text-red-600 mt-1">
                        {submissionResult.results.breakdown.data_quality.correct - submissionResult.results.breakdown.data_quality.matches} missed
                      </p>
                    </div>
                  </div>

                  {submissionResult.results.feedback.strengths.length > 0 && (
                    <div className="mt-3">
                      <p className="font-medium mb-1">Strengths:</p>
                      <ul className="list-disc list-inside">
                        {submissionResult.results.feedback.strengths.map((strength, idx) => (
                          <li key={idx}>{strength}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {submissionResult.results.feedback.issues.length > 0 && (
                    <div className="mt-3">
                      <p className="font-medium mb-1">Issues:</p>
                      <ul className="list-disc list-inside">
                        {submissionResult.results.feedback.issues.map((issue, idx) => (
                          <li key={idx}>{issue}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Analysis Helper */}
                  {analysis && (
                    <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded p-3">
                      <p className="font-medium text-yellow-900 mb-2">Analysis Helper</p>
                      <div className="text-xs space-y-3">
                        <div>
                          <p className="font-semibold text-yellow-800">High-Risk Patients:</p>
                          <p className="text-yellow-700">
                            Submitted: {analysis.highRisk.submitted.length} |
                            Expected: {analysis.highRisk.expectedCount} |
                            Matched: {analysis.highRisk.matchedCount}
                          </p>
                          <p className="text-red-600 mt-1">
                            ⚠️ {analysis.highRisk.incorrectlyIncluded} incorrectly included, {analysis.highRisk.missed} missed
                          </p>
                          <p className="text-yellow-600 mt-1 font-mono text-xs break-all">
                            Submitted IDs: {analysis.highRisk.submitted.join(', ')}
                          </p>
                          <div className="mt-2">
                            <p className="text-yellow-700 font-semibold">Patients with Risk = 4 (check these):</p>
                            <p className="text-yellow-600 font-mono text-xs">
                              {allPatients
                                .filter(p => p.totalRisk === 4 && analysis.highRisk.submitted.includes(p.patient_id))
                                .map(p => `${p.patient_id} (BP:${p.bpScore} Temp:${p.tempScore} Age:${p.ageScore})`)
                                .join(', ')}
                            </p>
                          </div>
                          <div className="mt-2">
                            <p className="text-yellow-700 font-semibold">Patients with Risk = 3 (might be missed):</p>
                            <p className="text-yellow-600 font-mono text-xs">
                              {allPatients
                                .filter(p => p.totalRisk === 3)
                                .map(p => `${p.patient_id} (BP:${p.bpScore} Temp:${p.tempScore} Age:${p.ageScore})`)
                                .join(', ')}
                            </p>
                          </div>
                        </div>
                        <div>
                          <p className="font-semibold text-yellow-800">Fever Patients:</p>
                          <p className="text-yellow-700">
                            Submitted: {analysis.fever.submitted.length} |
                            Expected: {analysis.fever.expectedCount} |
                            Matched: {analysis.fever.matchedCount}
                          </p>
                          <p className="text-red-600 mt-1">
                            ⚠️ {analysis.fever.missed} missed
                          </p>
                          <p className="text-yellow-600 mt-1 font-mono text-xs">
                            Submitted IDs: {analysis.fever.submitted.join(', ')}
                          </p>
                          <div className="mt-2">
                            <p className="text-yellow-700 font-semibold">Check patients with temp 99.5-99.6°F:</p>
                            <p className="text-yellow-600 font-mono text-xs">
                              {allPatients
                                .filter(p => {
                                  const temp = parseFloat(String(p.temperature));
                                  return !isNaN(temp) && temp >= 99.5 && temp < 99.6;
                                })
                                .map(p => `${p.patient_id} (${p.temperature}°F)`)
                                .join(', ') || 'None'}
                            </p>
                          </div>
                        </div>
                        <div>
                          <p className="font-semibold text-yellow-800">Data Quality Issues:</p>
                          <p className="text-yellow-700">
                            Submitted: {analysis.dataQuality.submitted.length} |
                            Expected: {analysis.dataQuality.expectedCount} |
                            Matched: {analysis.dataQuality.matchedCount}
                          </p>
                          <p className="text-red-600 mt-1">
                            ⚠️ {analysis.dataQuality.missed} missed
                          </p>
                          <p className="text-yellow-600 mt-1 font-mono text-xs">
                            Submitted IDs: {analysis.dataQuality.submitted.join(', ')}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800">{error}</p>
              </div>
            )}

            {/* Patient Table */}
            <div className="overflow-x-auto">
              {loading ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
                  <p className="text-gray-500">Loading patients from API...</p>
                  <p className="text-xs text-gray-400 mt-2">This may take a moment due to rate limiting delays</p>
                </div>
              ) : (
                <>
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Patient ID
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Age
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          BP
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Temp
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          BP Score
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Temp Score
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Age Score
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Total Risk
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Flags
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {displayedPatients.map((patient) => (
                        <tr key={patient.patient_id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {patient.patient_id}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {patient.name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {patient.age}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {patient.blood_pressure}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {patient.temperature}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {patient.bpScore}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {patient.tempScore}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {patient.ageScore}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRiskBadgeColor(
                                patient.totalRisk
                              )}`}
                            >
                              {patient.totalRisk}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <div className="flex flex-col gap-1">
                              {patient.totalRisk >= 4 && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                                  High Risk
                                </span>
                              )}
                              {patient.hasFever && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                                  Fever
                                </span>
                              )}
                              {patient.hasDataQualityIssue && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                                  Data Issue
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Pagination */}
                  <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6 mt-4">
                    <div className="flex-1 flex justify-between sm:hidden">
                      <button
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1 || loading}
                        className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages || loading}
                        className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                    <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm text-gray-700">
                          Page <span className="font-medium">{currentPage}</span> of{' '}
                          <span className="font-medium">{totalPages}</span>
                        </p>
                      </div>
                      <div>
                        <nav
                          className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px"
                          aria-label="Pagination"
                        >
                          <button
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            disabled={currentPage === 1 || loading}
                            className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Previous
                          </button>
                          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                            <button
                              key={page}
                              onClick={() => setCurrentPage(page)}
                              disabled={loading}
                              className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                                currentPage === page
                                  ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                                  : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                              } disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                              {page}
                            </button>
                          ))}
                          <button
                            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages || loading}
                            className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Next
                          </button>
                        </nav>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
