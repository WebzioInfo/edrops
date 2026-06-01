import React from 'react';
import { useField } from 'formik';
import { AlertCircle } from 'lucide-react';

interface InputBoxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  name: string;
  icon?: React.ReactNode;
}

export const InputBox: React.FC<InputBoxProps> = ({ label, icon, ...props }) => {
  const [field, meta] = useField(props.name);

  return (
    <div className="flex flex-col space-y-1.5 w-full">
      <label htmlFor={props.id || props.name} className="text-sm font-medium text-edrops-ocean mb-1">
        {label}
      </label>
      <div className="relative">
        {icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
            {icon}
          </div>
        )}
        <input
          {...field}
          {...props}
          id={props.id || props.name}
          className={`w-full rounded-xl border px-4 py-2.5 outline-none transition-all duration-200 
            ${icon ? 'pl-10' : ''}
            ${
              meta.touched && meta.error
                ? 'border-red-500 bg-red-50 focus:border-red-500 focus:ring-2 focus:ring-red-200'
                : 'border-gray-200 bg-white focus:border-edrops-blue focus:ring-2 focus:ring-edrops-blue/20'
            }
          `}
        />
        {meta.touched && meta.error && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <AlertCircle className="h-5 w-5 text-red-500" />
          </div>
        )}
      </div>
      {meta.touched && meta.error ? (
        <p className="text-sm text-red-500 mt-1">{meta.error}</p>
      ) : null}
    </div>
  );
};
