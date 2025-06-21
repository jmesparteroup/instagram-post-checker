import React from 'react';
import { CheckCircle, Clock, AlertCircle, Loader2 } from 'lucide-react';
import { Card, CardContent } from './card';

export interface ProgressStep {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'completed' | 'error';
  message?: string;
  progress?: number;
}

interface ProgressIndicatorProps {
  steps: ProgressStep[];
  overallProgress: number;
  className?: string;
}

export function ProgressIndicator({ 
  steps, 
  overallProgress, 
  className = '' 
}: ProgressIndicatorProps) {
  const getStepIcon = (step: ProgressStep) => {
    switch (step.status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'active':
        return <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStepColor = (step: ProgressStep) => {
    switch (step.status) {
      case 'completed':
        return 'text-green-700 dark:text-green-300';
      case 'active':
        return 'text-blue-700 dark:text-blue-300';
      case 'error':
        return 'text-red-700 dark:text-red-300';
      default:
        return 'text-gray-500 dark:text-gray-400';
    }
  };

  return (
    <Card className={`${className}`}>
      <CardContent className="pt-6">
        {/* Overall Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Overall Progress
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {Math.round(overallProgress)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${overallProgress}%` }}
            />
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-4">
          {steps.map((step) => (
            <div key={step.id} className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                {getStepIcon(step)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className={`text-sm font-medium ${getStepColor(step)}`}>
                    {step.label}
                  </h4>
                  {step.progress !== undefined && step.status === 'active' && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {Math.round(step.progress)}%
                    </span>
                  )}
                </div>
                {step.message && (
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    {step.message}
                  </p>
                )}
                {/* Individual step progress bar for active steps */}
                {step.progress !== undefined && step.status === 'active' && (
                  <div className="mt-2">
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1">
                      <div 
                        className="bg-blue-500 h-1 rounded-full transition-all duration-300 ease-out"
                        style={{ width: `${step.progress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default ProgressIndicator; 