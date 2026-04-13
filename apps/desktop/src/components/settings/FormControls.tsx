import { useState } from 'react';
import styles from './FormControls.module.css';

/* ─── TextInput ─────────────────────────────────────────────────────── */
interface TextInputProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  type?: 'text' | 'password';
}

export function TextInput({ label, value, onChange, placeholder, type = 'text' }: TextInputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

  return (
    <div className={styles.field}>
      <span className={styles.label}>{label}</span>
      <div className={styles.inputWrapper}>
        <input
          className={`${styles.input} ${isPassword ? styles.inputWithToggle : ''}`}
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
        />
        {isPassword && (
          <button
            type="button"
            className={styles.eyeButton}
            onClick={() => setShowPassword((v) => !v)}
            tabIndex={-1}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── ToggleSwitch ──────────────────────────────────────────────────── */
interface ToggleSwitchProps {
  label: string;
  checked: boolean;
  onChange: (val: boolean) => void;
}

export function ToggleSwitch({ label, checked, onChange }: ToggleSwitchProps) {
  return (
    <div className={styles.toggleField}>
      <span className={styles.toggleLabel}>{label}</span>
      <label className={styles.toggle}>
        <input
          className={styles.toggleInput}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className={styles.toggleTrack} />
        <span className={styles.toggleThumb} />
      </label>
    </div>
  );
}

/* ─── RadioGroup ────────────────────────────────────────────────────── */
interface RadioGroupProps<T extends string> {
  label?: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (val: T) => void;
}

export function RadioGroup<T extends string>({ label, options, value, onChange }: RadioGroupProps<T>) {
  return (
    <div className={styles.field}>
      {label && <span className={styles.label}>{label}</span>}
      <div className={styles.radioGroup}>
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`${styles.radioButton} ${value === opt.value ? styles.radioButtonActive : ''}`}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── NumberInput ───────────────────────────────────────────────────── */
interface NumberInputProps {
  label: string;
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

export function NumberInput({ label, value, onChange, min = 1, max = 100, step = 1 }: NumberInputProps) {
  const decrement = () => onChange(Math.max(min, value - step));
  const increment = () => onChange(Math.min(max, value + step));

  return (
    <div className={styles.field}>
      <span className={styles.label}>{label}</span>
      <div className={styles.numberWrapper}>
        <button
          type="button"
          className={styles.numberStepper}
          onClick={decrement}
          disabled={value <= min}
          aria-label="Decrease"
        >
          −
        </button>
        <input
          className={styles.numberInput}
          type="number"
          value={value}
          min={min}
          max={max}
          onChange={(e) => {
            const n = parseInt(e.target.value, 10);
            if (!isNaN(n)) onChange(Math.min(max, Math.max(min, n)));
          }}
        />
        <button
          type="button"
          className={styles.numberStepper}
          onClick={increment}
          disabled={value >= max}
          aria-label="Increase"
        >
          +
        </button>
      </div>
    </div>
  );
}
