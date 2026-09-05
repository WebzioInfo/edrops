import React from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';

export interface DataErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  colSpan?: number;
  isTableRow?: boolean;
  compact?: boolean;
}

export const DataErrorState: React.FC<DataErrorStateProps> = ({
  title = 'Unable to Load Data',
  message = 'An error occurred while fetching data from the server. Please check your network connection and try again.',
  onRetry,
  colSpan,
  isTableRow = false,
  compact = false,
}) => {
  const content = (
    <div
      className={`flex flex-col items-center justify-center text-center ${
        compact ? 'p-6' : 'p-10 sm:p-14'
      }`}
    >
      <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mb-3 shadow-2xs border border-rose-100">
        <AlertTriangle className="w-6 h-6" />
      </div>
      <h3 className="text-base font-bold text-[#16324F] mb-1">{title}</h3>
      <p className="text-xs text-[#64748B] max-w-sm mb-4 leading-relaxed font-medium">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-2xs transition-all cursor-pointer active:scale-98"
        >
          <RotateCw className="w-3.5 h-3.5" />
          <span>Try Again</span>
        </button>
      )}
    </div>
  );

  if (colSpan !== undefined || isTableRow) {
    return (
      <tr>
        <td colSpan={colSpan || 1} className="py-8">
          {content}
        </td>
      </tr>
    );
  }

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-2xs overflow-hidden">
      {content}
    </div>
  );
};

export default DataErrorState;
