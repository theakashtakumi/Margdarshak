import { OpportunityRecord } from './repositories.ts';

function formatIcsDate(isoString: string): string {
  const d = new Date(isoString);
  return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

export function generateOpportunityIcs(opp: OpportunityRecord): string {
  const now = new Date().toISOString();
  const dtstamp = formatIcsDate(now);
  const uid = `margdarshak-${opp.id}-${Date.now()}@margdarshak.gov.in`;

  // Determine start & end times
  let dtstart = dtstamp;
  let dtend = dtstamp;

  if (opp.deadline) {
    dtend = formatIcsDate(opp.deadline);
    if (opp.opening_date) {
      dtstart = formatIcsDate(opp.opening_date);
    } else {
      // Default to 1 day prior to deadline for reminder window
      const d = new Date(opp.deadline);
      d.setDate(d.getDate() - 1);
      dtstart = formatIcsDate(d.toISOString());
    }
  }

  const cleanDescription = (opp.description + '\n\nEligibility: ' + opp.eligibility_summary + '\n\nOfficial Portal: ' + opp.official_url + '\nVerified Source: ' + opp.official_source_url)
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
    .replace(/\n/g, '\\n');

  const cleanSummary = `${opp.title} Deadline`.replace(/,/g, '\\,');

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Margdarshak Civic Clarity//Student Opportunity Monitor//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${dtstart}`,
    `DTEND:${dtend}`,
    `SUMMARY:${cleanSummary}`,
    `DESCRIPTION:${cleanDescription}`,
    `URL:${opp.official_url}`,
    'STATUS:CONFIRMED',
    'BEGIN:VALARM',
    'TRIGGER:-P3D',
    'ACTION:DISPLAY',
    `DESCRIPTION:Reminder: 3 days remaining for ${cleanSummary}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
}
