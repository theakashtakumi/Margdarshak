export interface DeadlineInfo {
  state: 'open' | 'closing_soon' | 'expired' | 'unannounced';
  label: string;
  daysRemaining: number | null;
  formattedDate: string;
}

export function calculateDeadlineInfo(deadlineIso: string | null): DeadlineInfo {
  if (!deadlineIso) {
    return {
      state: 'unannounced',
      label: 'Dates Pending Notification',
      daysRemaining: null,
      formattedDate: 'Official dates awaiting announcement'
    };
  }

  const deadline = new Date(deadlineIso);
  const now = new Date();

  if (isNaN(deadline.getTime())) {
    return {
      state: 'unannounced',
      label: 'Invalid Date',
      daysRemaining: null,
      formattedDate: 'Unspecified'
    };
  }

  const diffTime = deadline.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
  const formattedDate = deadline.toLocaleDateString('en-IN', options);

  if (diffDays < 0) {
    return {
      state: 'expired',
      label: 'Application Closed',
      daysRemaining: diffDays,
      formattedDate
    };
  }

  if (diffDays <= 15) {
    return {
      state: 'closing_soon',
      label: diffDays === 0 ? 'Closes Today' : `${diffDays} Day${diffDays > 1 ? 's' : ''} Remaining`,
      daysRemaining: diffDays,
      formattedDate
    };
  }

  return {
    state: 'open',
    label: `${diffDays} Days Remaining`,
    daysRemaining: diffDays,
    formattedDate
  };
}
