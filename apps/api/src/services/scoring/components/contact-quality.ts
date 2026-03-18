/**
 * Contact Quality Component (30 points)
 * Evaluates the quality and completeness of contact information
 */

import type { CrmContact, CrmLead } from '@agios/db/schema';
import type { ComponentScore } from '../types';

/**
 * Decision-maker job titles/keywords
 */
const DECISION_MAKER_KEYWORDS = [
  'ceo',
  'cfo',
  'coo',
  'cto',
  'cmo',
  'founder',
  'co-founder',
  'owner',
  'president',
  'director',
  'vp',
  'vice president',
  'head of',
  'chief',
  'partner',
  'managing director',
];

/**
 * Email validation regex (basic)
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Phone validation regex (international format, flexible)
 */
const PHONE_REGEX = /^\+?[\d\s\-\(\)]{8,}$/;

/**
 * Score contact quality based on contact and lead data
 *
 * Scoring breakdown:
 * - Valid email: 10 points
 * - Valid phone: 10 points
 * - LinkedIn profile: 5 points
 * - Decision-maker title: 5 points
 *
 * @param contact - CRM contact (may be null if lead not converted)
 * @param lead - CRM lead
 * @returns Component score with details
 */
export function scoreContactQuality(
  contact: CrmContact | null,
  lead: CrmLead
): ComponentScore {
  const details: ComponentScore['details'] = {};
  let score = 0;

  // Email validation (10 points)
  const email = contact?.email || lead.email;
  if (email && EMAIL_REGEX.test(email)) {
    score += 10;
    details.email = {
      points: 10,
      maxPoints: 10,
      value: email,
      reason: 'Valid email address provided',
    };
  } else {
    details.email = {
      points: 0,
      maxPoints: 10,
      value: email || null,
      reason: email ? 'Invalid email format' : 'No email provided',
    };
  }

  // Phone validation (10 points)
  const phone = contact?.phone || lead.phone;
  if (phone && PHONE_REGEX.test(phone)) {
    score += 10;
    details.phone = {
      points: 10,
      maxPoints: 10,
      value: phone,
      reason: 'Valid phone number provided',
    };
  } else {
    details.phone = {
      points: 0,
      maxPoints: 10,
      value: phone || null,
      reason: phone ? 'Invalid phone format' : 'No phone number provided',
    };
  }

  // LinkedIn profile (5 points)
  const linkedinUrl = contact?.customFields?.linkedinUrl as string | undefined;
  if (linkedinUrl && linkedinUrl.includes('linkedin.com')) {
    score += 5;
    details.linkedin = {
      points: 5,
      maxPoints: 5,
      value: linkedinUrl,
      reason: 'LinkedIn profile available',
    };
  } else {
    details.linkedin = {
      points: 0,
      maxPoints: 5,
      value: linkedinUrl || null,
      reason: 'No LinkedIn profile found',
    };
  }

  // Decision-maker title (5 points)
  const title = (contact?.title || '').toLowerCase();
  const isDecisionMaker = DECISION_MAKER_KEYWORDS.some((keyword) => {
    // Use word boundary matching to avoid false positives
    // e.g., "coo" should not match "coordinator"
    const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    return regex.test(title);
  });

  if (isDecisionMaker && title) {
    score += 5;
    details.decisionMaker = {
      points: 5,
      maxPoints: 5,
      value: contact?.title,
      reason: 'Decision-maker title detected',
    };
  } else {
    details.decisionMaker = {
      points: 0,
      maxPoints: 5,
      value: contact?.title || null,
      reason: title ? 'Not a decision-maker role' : 'No title provided',
    };
  }

  return {
    score,
    max: 30,
    details,
  };
}
