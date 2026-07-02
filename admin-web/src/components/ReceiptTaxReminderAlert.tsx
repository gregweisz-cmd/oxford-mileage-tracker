import React from 'react';
import { Alert, AlertTitle } from '@mui/material';
import { ReceiptTaxReminderResult } from '../utils/receiptTaxReminder';

interface ReceiptTaxReminderAlertProps {
  reminder: ReceiptTaxReminderResult | null;
}

export function ReceiptTaxReminderAlert({ reminder }: ReceiptTaxReminderAlertProps) {
  if (!reminder) return null;

  return (
    <Alert severity="info" sx={{ mb: 2 }}>
      <AlertTitle>{reminder.title}</AlertTitle>
      {reminder.message}
    </Alert>
  );
}
