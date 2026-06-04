import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Box, InputAdornment, Popover, TextField, SxProps, Theme } from '@mui/material';
import { CalendarToday as CalendarIcon } from '@mui/icons-material';
import { DateCalendar } from '@mui/x-date-pickers/DateCalendar';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs, { Dayjs } from 'dayjs';

export interface FormDatePickerProps {
  label: string;
  /** ISO date string YYYY-MM-DD */
  value: string;
  onChange: (value: string) => void;
  /** Month shown when value is empty (YYYY-MM-DD). Defaults to today. */
  initialCalendarDate?: string;
  error?: boolean;
  helperText?: string;
  showStartIcon?: boolean;
  size?: 'small' | 'medium';
  sx?: SxProps<Theme>;
}

function resolveCalendarAnchor(value: string, initialCalendarDate?: string): Dayjs {
  if (value && dayjs(value).isValid()) {
    return dayjs(value);
  }
  if (initialCalendarDate && dayjs(initialCalendarDate).isValid()) {
    return dayjs(initialCalendarDate);
  }
  return dayjs();
}

const MemoizedDateCalendar = React.memo(
  function MemoizedDateCalendar({
    dayValue,
    viewMonth,
    onMonthChange,
    onSelect,
  }: {
    dayValue: Dayjs | null;
    viewMonth: Dayjs;
    onMonthChange: (month: Dayjs) => void;
    onSelect: (newValue: Dayjs | null) => void;
  }) {
    return (
      <DateCalendar
        value={dayValue}
        referenceDate={viewMonth}
        onMonthChange={onMonthChange}
        onYearChange={onMonthChange}
        onChange={onSelect}
      />
    );
  },
  (prev, next) =>
    prev.dayValue?.format('YYYY-MM-DD') === next.dayValue?.format('YYYY-MM-DD') &&
    prev.viewMonth.format('YYYY-MM') === next.viewMonth.format('YYYY-MM')
);

/**
 * Date control that opens a calendar when the user clicks anywhere on the field.
 * MUI DatePicker's default field uses segmented month/day/year inputs, which feels
 * like text selection instead of opening a calendar.
 */
export function FormDatePicker({
  label,
  value,
  onChange,
  initialCalendarDate,
  error,
  helperText,
  showStartIcon = true,
  size = 'medium',
  sx,
}: FormDatePickerProps) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState<Dayjs>(() =>
    resolveCalendarAnchor(value, initialCalendarDate)
  );

  const dayValue = value && dayjs(value).isValid() ? dayjs(value) : null;
  const displayValue = dayValue?.isValid() ? dayValue.format('MM/DD/YYYY') : '';

  useEffect(() => {
    if (open) {
      setViewMonth(resolveCalendarAnchor(value, initialCalendarDate));
    }
  }, [open, value, initialCalendarDate]);

  const handleSelect = useCallback(
    (newValue: Dayjs | null) => {
      if (newValue?.isValid()) {
        onChange(newValue.format('YYYY-MM-DD'));
        setViewMonth(newValue);
      }
      setOpen(false);
    },
    [onChange]
  );

  const handleMonthChange = useCallback((month: Dayjs) => {
    setViewMonth(month);
  }, []);

  const openCalendar = () => setOpen(true);

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box ref={anchorRef} sx={{ width: '100%', ...sx }}>
        <TextField
          fullWidth
          size={size}
          label={label}
          value={displayValue}
          error={error}
          helperText={helperText}
          onClick={openCalendar}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              openCalendar();
            }
          }}
          inputProps={{
            readOnly: true,
            'aria-haspopup': 'dialog',
            'aria-expanded': open,
          }}
          InputProps={{
            readOnly: true,
            startAdornment: showStartIcon ? (
              <InputAdornment position="start">
                <CalendarIcon color="action" />
              </InputAdornment>
            ) : undefined,
            endAdornment: (
              <InputAdornment position="end">
                <CalendarIcon color="action" sx={{ cursor: 'pointer' }} />
              </InputAdornment>
            ),
          }}
          sx={{
            '& .MuiInputBase-root': { cursor: 'pointer' },
            '& .MuiInputBase-input': { cursor: 'pointer' },
          }}
        />
        <Popover
          open={open}
          anchorEl={anchorRef.current}
          onClose={() => setOpen(false)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        >
          <MemoizedDateCalendar
            dayValue={dayValue}
            viewMonth={viewMonth}
            onMonthChange={handleMonthChange}
            onSelect={handleSelect}
          />
        </Popover>
      </Box>
    </LocalizationProvider>
  );
}

export default FormDatePicker;
