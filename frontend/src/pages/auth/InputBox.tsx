import { useState } from 'react';
import { Field, ErrorMessage } from 'formik';

interface InputBoxProps {
  type: string;
  name: string;
  placeholder: string;
  icon: string;
  autoComplete?: string;
  disabled?: boolean;
}

const InputBox = ({ type, name, placeholder, icon, autoComplete, disabled }: InputBoxProps) => {
  const [showPassword, setShowPassword] = useState(false);

  const isPassword = type === 'password';
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

  return (
    <div className="input-box">
      <Field
        type={inputType}
        name={name}
        id={name}
        placeholder={placeholder}
        autoComplete={autoComplete}
        disabled={disabled}
        aria-label={placeholder}
        aria-describedby={`${name}-error`}
      />

      {isPassword ? (
        <button
          type="button"
          className="toggle-password"
          onClick={() => setShowPassword((prev) => !prev)}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
          tabIndex={0}
        >
          <i className={`bx ${showPassword ? 'bx-hide' : 'bx-show'}`} />
        </button>
      ) : (
        <i className={`bx ${icon} input-icon`} aria-hidden="true" />
      )}

      <ErrorMessage
        name={name}
        component="span"
        className="input-error-msg"
        id={`${name}-error`}
      />
    </div>
  );
};

export default InputBox;
